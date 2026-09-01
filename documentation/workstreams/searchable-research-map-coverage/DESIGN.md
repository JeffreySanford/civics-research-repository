# Design Choice

Use server-side aggregation plus viewport/detail-bounded feature retrieval. The browser consumes summaries and capped explicit footprints, while associated research rows use normal/cursor search traversal. MapLibre never becomes a bulk-export mechanism for the million-record corpus.
