#!/usr/bin/env python3
"""
generate_recs.py

Usage:
  python generate_recs.py --csv /path/to/movies_metadata.csv --out-dir ./site --max-rows 1000 --top-n 10

Outputs:
  - ./site/recommendations.json
  - (does not write index.html; the repo's index.html will read recommendations.json)
"""
import os
import json
import argparse
from pathlib import Path
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel
from tqdm import tqdm

def clean_title(t):
    if pd.isna(t):
        return None
    # Simple cleanup; keep uniqueness case-insensitive
    return str(t).strip()

def extract_year_from_title(title):
    # Some datasets include "(1999)" in title column; optional
    import re
    m = re.search(r'\((\d{4})\)', str(title))
    return m.group(1) if m else None

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--csv', required=True, help='Path to movies_metadata.csv')
    p.add_argument('--out-dir', default='site', help='Output directory to save recommendations.json')
    p.add_argument('--max-rows', type=int, default=1000, help='Max rows to process (keeps memory small)')
    p.add_argument('--top-n', type=int, default=10, help='Top N recommendations per movie')
    p.add_argument('--random-seed', type=int, default=42)
    args = p.parse_args()

    csv_path = Path(args.csv)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    top_n = args.top_n

    print("Loading CSV:", csv_path)
    df = pd.read_csv(csv_path, low_memory=False)

    # Prefer columns: title, overview, release_date / year / poster_path (optional)
    # Normalize column names (lowercase)
    df.columns = [c.lower() for c in df.columns]

    # Common column names
    title_col = None
    for c in ('title','name'):
        if c in df.columns:
            title_col = c; break
    if title_col is None:
        raise RuntimeError("No title column found in CSV (expected 'title' or 'name')")

    overview_col = None
    for c in ('overview','description','plot','summary'):
        if c in df.columns:
            overview_col = c; break
    if overview_col is None:
        raise RuntimeError("No overview/description column found in CSV.")

    poster_col = None
    for c in ('poster_path','poster','image','posterurl','poster_url'):
        if c in df.columns:
            poster_col = c; break

    year_col = None
    for c in ('year','release_year','release_date'):
        if c in df.columns:
            year_col = c; break

    # Keep only entries with title + overview
    df = df[[title_col, overview_col] + ([poster_col] if poster_col else []) + ([year_col] if year_col else [])]
    df = df.dropna(subset=[title_col, overview_col])
    df[title_col] = df[title_col].apply(clean_title)
    df = df.drop_duplicates(subset=[title_col])
    df = df.reset_index(drop=True)

    if args.max_rows:
        df = df.iloc[:args.max_rows].copy()

    print(f"Using {len(df)} movies (first {args.max_rows})")

    # Build TF-IDF
    print("Computing TF-IDF on overviews...")
    tfidf = TfidfVectorizer(stop_words='english', max_df=0.85)
    tfidf_matrix = tfidf.fit_transform(df[overview_col].astype(str))

    # Cosine similarity using linear_kernel (fast)
    print("Computing cosine similarity matrix (may use a while)...")
    cosine_sim = linear_kernel(tfidf_matrix, tfidf_matrix)

    titles = df[title_col].tolist()
    print("Preparing recommendations...")
    recommendations = {}

    for idx, title in enumerate(tqdm(titles, desc="movies")):
        sim_scores = list(enumerate(cosine_sim[idx]))
        # sort by score descending
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
        # skip itself (first entry)
        top_indices = [i for i,score in sim_scores[1:top_n+1]]
        recs = []
        for i in top_indices:
            item = {'title': titles[i]}
            if poster_col and not pd.isna(df.iloc[i][poster_col]):
                item['poster'] = str(df.iloc[i][poster_col])
            if year_col and not pd.isna(df.iloc[i][year_col]):
                item['year'] = str(df.iloc[i][year_col])
            # include similarity score for debugging (rounded)
            item['score'] = float(round(sim_scores[top_indices.index(i)+1][1], 4)) if sim_scores else None
            recs.append(item)
        # Option: include source movie metadata
        src = {}
        if poster_col and not pd.isna(df.iloc[idx][poster_col]):
            src['poster'] = str(df.iloc[idx][poster_col])
        if year_col and not pd.isna(df.iloc[idx][year_col]):
            src['year'] = str(df.iloc[idx][year_col])
        recommendations[title] = {'source': src, 'recs': recs}

    out_path = out_dir / 'recommendations.json'
    print("Saving recommendations to:", out_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(recommendations, f, ensure_ascii=False, indent=2)

    print("Done.")

if __name__ == '__main__':
    main()
