#!/usr/bin/env python3
# generate_recs.py
# Usage example (PowerShell):
# python .\generate_recs.py --csv "C:\Users\kmmsi\Downloads\movies_metadata.csv\movies_metadata.csv" --out ".\recommendations.json" --max-rows 2000 --top-n 10

import argparse, json
from pathlib import Path
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel
from tqdm import tqdm

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--csv', required=True, help='Path to movies_metadata.csv')
    p.add_argument('--out', default='recommendations.json', help='Output JSON path')
    p.add_argument('--max-rows', type=int, default=1000, help='Max movies to process')
    p.add_argument('--top-n', type=int, default=10, help='Top-N recommendations per movie')
    args = p.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    print("Loading CSV:", csv_path)
    df = pd.read_csv(csv_path, low_memory=False)
    df.columns = [c.lower() for c in df.columns]

    # find columns
    if 'title' not in df.columns:
        raise SystemExit("CSV missing required 'title' column")
    overview_col = None
    for c in ('overview','description','plot','summary'):
        if c in df.columns:
            overview_col = c
            break
    if overview_col is None:
        raise SystemExit("CSV missing overview/description column")

    df = df[['title', overview_col]].dropna().drop_duplicates(subset=['title']).reset_index(drop=True)
    df = df.iloc[:args.max_rows].copy()
    print(f"Using {len(df)} movies (max_rows={args.max_rows})")

    tfidf = TfidfVectorizer(stop_words='english', max_df=0.85)
    tfidf_matrix = tfidf.fit_transform(df[overview_col].astype(str))
    cosine_sim = linear_kernel(tfidf_matrix, tfidf_matrix)

    titles = df['title'].tolist()
    out = {}
    for i, t in enumerate(tqdm(titles, desc="computing")):
        sims = list(enumerate(cosine_sim[i]))
        sims = sorted(sims, key=lambda x: x[1], reverse=True)
        top_idxs = [idx for idx,score in sims[1:args.top_n+1]]  # skip itself
        out[t] = [titles[j] for j in top_idxs]

    out_path = Path(args.out)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("Wrote", out_path)

if __name__ == '__main__':
    main()
