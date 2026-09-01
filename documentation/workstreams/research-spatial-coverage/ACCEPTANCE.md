# Acceptance Criteria

The spatial-coverage workstream is implementation-ready when the following are explicit and testable:

- stable research-object identity keys every coverage record;
- supported shapes are typed rather than arbitrary unvalidated JSON;
- invalid coordinates/bounds are rejected;
- provenance and derivation method are mandatory for derived coverage;
- publisher/institution location cannot silently become research coverage;
- Data.gov and NASA mappings are source-specific and fixture-backed;
- the C2 composition/projection identity is not mutated by sidecar enrichment;
- OpenAPI exposes bounded read contracts rather than bulk geometry dumps;
- semantic HTML can present the same meaningful coverage information later rendered on Maps.
