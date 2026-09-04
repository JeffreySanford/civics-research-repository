# Deferred Maps layer backlog

Issue: #69

These candidates are intentionally parked until the final three Maps slices (#66–#68) are complete. Recording them here preserves useful product/research ideas without silently expanding current scope.

## Promotion rule

A deferred candidate should become an implementation issue only when all of the following are true:

1. the user question it answers is clear;
2. source semantics are authoritative enough to map without misleading inference;
3. geometry/value joins can reuse existing architecture or justify a bounded new contract;
4. the visual has a semantic/accessibility strategy;
5. the layer adds a distinct research capability rather than duplicating another layer;
6. the source can be pinned/provenanced/reproduced appropriately;
7. implementation does not require rewriting the completed C2/C2.1 corpus merely to make data mappable.

## County Business Patterns

### User question

> Where are businesses/jobs concentrated by industry, and how does that vary across counties?

### Candidate model

One conceptual layer: **County business activity**.

Configuration:

- measure: employment / establishments / first-quarter payroll / annual payroll;
- industry: all industries or selected NAICS grouping;
- year/vintage.

### Why revisit

This is probably the strongest follow-up after Population Estimates because it reuses county geometry and the same configurable thematic-value model while demonstrating useful Census business data.

### Guardrail

Do not create a separate checkbox for every measure or industry.

## Business Dynamics Statistics

### User question

> Where is business/employment activity growing or shrinking?

### Candidate model

One conceptual layer: **Business dynamics**.

Strong first measures:

- job creation rate;
- job destruction rate;
- establishment births/deaths;
- firm startups/shutdowns.

### Why revisit

Pairs naturally with LODES: LODES shows where jobs/workflows are located; BDS can show where business/employment activity is changing.

## Repository research by area

### User question

> How many matching repository/search objects explicitly name this administrative area?

### Candidate meaning

Count matching research objects whose metadata explicitly identifies a state/county/other supported administrative geography.

This does **not** mean every publication scientifically studies every location inside the area.

### Why revisit

This may become the clearest high-level Research Coverage summary because it uses explicit administrative metadata and avoids stacking many broad research footprints.

### Likely rendering

County/state choropleth or symbols backed by bounded/cursor-safe search aggregation, with direct access to the matching research-object list.

## NASA CMR research coverage

### User question

> Which NASA Earth-data collections or bounded granules cover this place/time?

### Candidate model

Keep two concepts distinct:

- **NASA collection coverage** — collection-level footprint/bounds;
- **NASA granule coverage** — viewport/time-filtered granules for a selected collection.

### Why revisit

NASA CMR is a stronger explicit-spatial research source than forcing geography onto bibliographic records.

### Guardrails

- collection and granule records are not interchangeable;
- granule delivery must be bounded by collection plus viewport and/or time;
- do not replay/download an unbounded granule population into the browser;
- source semantics/provenance remain explicit.

## Building Permits

### User question

> Where is new housing construction being authorized?

### Candidate model

One conceptual layer: **Building permits**.

Likely first measure: housing units authorized by county, with later place-level symbols only when authoritative place geometry/coordinates are available.

### Why revisit

Useful housing/development complement to population growth and business activity.

## Economic Census

### User question

> How do establishments, employment, payroll, or sales vary by industry and geography?

### Candidate model

Later configurable business thematic layer after the UI/data contract proven by Population Estimates and CBP exists.

### Guardrail

Avoid duplicating CBP controls until a real user/research distinction is established.

## ACS PUMS weighted indicators

### User question

> How do weighted demographic/economic characteristics vary across PUMAs or states?

### Candidate model

Weighted aggregate indicators only.

### Guardrails

- never draw person-level microdata points;
- document survey-weight methodology;
- use authoritative PUMA geometry and correct vintage compatibility;
- expose uncertainty/methodology where the chosen statistic requires it.

## Additional terrain/environment possibilities

After 3DEP terrain is proven, future environment/hazard additions should be evaluated against the existing USGS hydrography + earthquake + terrain set. Avoid adding layers only because a service exists.

Potential examples to research later:

- wildfire/perimeter context from an authoritative federal source;
- flood/hazard context where licensing/service stability and semantics are clear;
- drought/climate context where temporal controls can be explained cleanly.

These are intentionally not commitments and require fresh source validation before promotion.

## What should not become Research Coverage

Do not map the following as research coverage unless the authoritative record explicitly says they are content/site/spatial coverage:

- publisher address;
- laboratory address;
- author affiliation;
- institution headquarters;
- sponsor location.

If affiliation geography is useful later, expose it under a separate analytic concept such as **Research institutions / affiliations**.

## Stable design rules for every promoted candidate

- categories are by research purpose, not publisher;
- one checkbox controls one conceptual layer;
- measure/year/industry/time/source mode are configuration;
- thematic values and geometry remain separate authorities joined by stable IDs;
- research footprints use bounded contracts;
- visuals do not replace semantic equivalents;
- source provenance and failure states are visible;
- no synthetic data merely to keep a layer populated;
- accepted C2/C2.1 timing evidence remains untouched.
