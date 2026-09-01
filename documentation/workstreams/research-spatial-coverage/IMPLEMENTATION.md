# Implementation Sequence

1. Add typed spatial coverage domain values and validation.
2. Add application-owned persistence keyed by stable research-object ID.
3. Add source-specific extraction interfaces and provenance/derivation metadata.
4. Add committed Data.gov/NASA fixtures before live enrichment.
5. Add bounded read APIs and generated client types.
6. Add projection/search fields only after domain/storage evidence is stable.
7. Add browser-visible research coverage only in the following Maps workstream.

Keeping these steps separate prevents UI pressure from weakening provenance or silently turning publisher location into research coverage.
