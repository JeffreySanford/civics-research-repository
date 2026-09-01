# Design Choice

Expose one engine-neutral opaque continuation token. Internally translate to Solr `cursorMark` or OpenSearch `search_after` while enforcing one deterministic ordering/tie-break contract and binding the token to the effective search/projection state.
