#!/usr/bin/env python3
# generate_recs.py
import json, argparse
from pathlib import Path
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--csv', required=True, help='Path to movies_metadata.csv')
    p.add_argument('--out', default='recommendations.json', help='Output JSON path')
    p.add_argument('--max-rows', type=int, default=1000, help='Max number of movies to use')
    p.add_argument('--top-n', type=int, default=10, help='Top-N recommendations per movie')
    args = p.parse_args()

    df = pd.read_csv(args.csv, low_memory=False)
    # normalize column names
    df.columns = [c.lower() for c in df.columns]

    # find title + overview
    if 'title' not in df.columns:
        raise SystemExit("CSV missing 'title' column")
    # try common overview names
    overview_col = None
    for c in ('overview','description','plot','summary'):
        if c in df.columns: overview_col = c; break
    if overview_col is None:
        raise SystemExit("CSV missing overview/description column")

    df = df[['title', overview_col]].dropna()
    df = df.drop_duplicates(subset=['title']).reset_index(drop=True)
    df = df.iloc[:args.max_rows].copy()

    # TF-IDF
    tfidf = TfidfVectorizer(stop_words='english', max_df=0.85)
    tfidf_matrix = tfidf.fit_transform(df[overview_col].astype(str))
    cos_sim = linear_kernel(tfidf_matrix, tfidf_matrix)

    titles = df['title'].tolist()
    out = {}
    for i, t in enumerate(titles):
        sims = list(enumerate(cos_sim[i]))
        sims = sorted(sims, key=lambda x: x[1], reverse=True)
        top_idxs = [idx for idx,score in sims[1:args.top_n+1]]  # skip itself
        out[t] = [titles[j] for j in top_idxs]

    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("Wrote", args.out)

if __name__ == '__main__':
    main()
