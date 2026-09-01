# API Sketch

Illustrative read shapes only; exact OpenAPI naming belongs to implementation review.

```text
GET /research/spatial/summary?query=...&sourceSystem=...&geographyLevel=STATE
GET /research/spatial/features?query=...&bbox=west,south,east,north&limit=...
```

Responses should carry projection/query identity, truncation/cap metadata and provenance breakdowns. Feature responses must be server-bounded; summary responses should prefer aggregation over row-by-row transfer.
