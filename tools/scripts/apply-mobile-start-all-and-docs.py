from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing anchor for {label}")
    return text.replace(old, new, 1)


# Docker Compose: make the mobile frontend a first-class stack service with isolated writable
# node_modules/Nx cache volumes so the two Angular containers never race over install/build state.
compose_path = Path("docker-compose.yml")
compose = compose_path.read_text()
if "  census-mobile-frontend:\n" not in compose:
    mobile_service = """

  census-mobile-frontend:
    image: node:24-bookworm-slim
    working_dir: /workspace
    command: sh -c "corepack enable && pnpm install --frozen-lockfile && rm -rf /tmp/nx-workspace-data-mobile && pnpm exec nx run census-mobile-frontend:serve --host=0.0.0.0 --port=4300"
    environment:
      NG_CLI_ANALYTICS: 'false'
      NX_DAEMON: 'false'
      NX_WORKSPACE_DATA_DIRECTORY: /tmp/nx-workspace-data-mobile
      NX_CACHE_DIRECTORY: /nx-cache-mobile
      COREPACK_ENABLE_DOWNLOAD_PROMPT: '0'
    ports:
      - '4300:4300'
    volumes:
      - .:/workspace
      - pnpm-store:/root/.local/share/pnpm/store
      - census-mobile-node-modules:/workspace/node_modules
      - corepack-cache:/root/.cache/node/corepack
      - census-mobile-nx-cache:/nx-cache-mobile
    depends_on:
      - repository-api
"""
    compose = replace_once(
        compose,
        "\n  # Application operational state only",
        mobile_service + "\n  # Application operational state only",
        "mobile compose service",
    )

if "  census-mobile-node-modules:\n" not in compose:
    compose = replace_once(
        compose,
        "  node-modules:\n  corepack-cache:\n",
        "  node-modules:\n  census-mobile-node-modules:\n  corepack-cache:\n  census-mobile-nx-cache:\n",
        "mobile compose volumes",
    )
compose_path.write_text(compose)


# Stack orchestration: include both Angular apps in lifecycle, readiness, and startup reporting.
stack_path = Path("tools/scripts/compose-stack.mjs")
stack = stack_path.read_text()
if "export const MOBILE_UI_URL" not in stack:
    stack = replace_once(
        stack,
        "export const UI_URL = process.env.CIVICS_UI_URL ?? 'http://localhost:4200';\n",
        "export const UI_URL = process.env.CIVICS_UI_URL ?? 'http://localhost:4200';\nexport const MOBILE_UI_URL =\n  process.env.CIVICS_MOBILE_UI_URL ?? 'http://localhost:4300';\n",
        "mobile UI URL",
    )
if "  'census-mobile-frontend',\n" not in stack:
    stack = replace_once(
        stack,
        "  'repository-api',\n  'discovery-ui',\n];",
        "  'repository-api',\n  'discovery-ui',\n  'census-mobile-frontend',\n];",
        "stack service list",
    )
stack = stack.replace(
    "the discovery-ui container installs with --frozen-lockfile",
    "the Angular UI containers install with --frozen-lockfile",
)
stack = stack.replace(
    "If discovery-ui reported ERR_PNPM_LOCKFILE_CONFIG_MISMATCH:",
    "If an Angular UI reported ERR_PNPM_LOCKFILE_CONFIG_MISMATCH:",
)
if "Mobile Census UI" not in stack:
    stack = replace_once(
        stack,
        "  Discovery UI      ${UI_URL}\n  Repository API    ${API_URL}",
        "  Discovery UI      ${UI_URL}\n  Mobile Census UI  ${MOBILE_UI_URL}\n  Repository API    ${API_URL}",
        "startup URL list",
    )
    stack = replace_once(
        stack,
        "  1. ${UI_URL}/discovery          search and facets, served from the active corpus profile\n  2. ${UI_URL}/datasets/tiger-line-north-dakota-2025\n                                             repository metadata, files, citation, related research\n  3. ${UI_URL}/maps               MapLibre with live USGS overlay and an accessible feature list\n  4. ${UI_URL}/admin/sync         sync plus corpus-profile/storage administration\n  5. ${UI_URL}/evidence           WCAG and Section 508 status\n  6. ${UI_URL}/search-lab         Solr/OpenSearch comparison on the active projection",
        "  1. ${MOBILE_UI_URL}                  mobile-first Census search, rank, and relevance evidence\n  2. ${UI_URL}/discovery          search and facets, served from the active corpus profile\n  3. ${UI_URL}/datasets/tiger-line-north-dakota-2025\n                                             repository metadata, files, citation, related research\n  4. ${UI_URL}/maps               MapLibre with live USGS overlay and an accessible feature list\n  5. ${UI_URL}/admin/sync         sync plus corpus-profile/storage administration\n  6. ${UI_URL}/evidence           WCAG and Section 508 status\n  7. ${UI_URL}/search-lab         Solr/OpenSearch comparison on the active projection",
        "worth-showing list",
    )
stack = stack.replace(
    "Starting the application stack (PostgreSQL, Solr, OpenSearch, Java API, Angular UI)",
    "Starting the application stack (PostgreSQL, Solr, OpenSearch, Java API, Angular UIs)",
)
old_wait = """    announce(
      'Waiting for the Angular UI (first run installs dependencies and builds)',
    );
    await waitFor('Discovery UI', UI_URL, { timeoutMs: 300000 });
"""
new_wait = """    announce(
      'Waiting for both Angular UIs (first run installs dependencies and builds)',
    );
    await Promise.all([
      waitFor('Discovery UI', UI_URL, { timeoutMs: 300000 }),
      waitFor('Mobile Census UI', MOBILE_UI_URL, { timeoutMs: 300000 }),
    ]);
"""
if old_wait in stack:
    stack = stack.replace(old_wait, new_wait, 1)
elif "waitFor('Mobile Census UI'" not in stack:
    raise RuntimeError("Missing anchor for Angular UI readiness")
stack_path.write_text(stack)


# Attached start:all should stream both frontend logs, not make the mobile UI invisible.
entry_path = Path("tools/scripts/stack.mjs")
entry = entry_path.read_text()
entry = entry.replace(
    "Attaching to discovery-ui logs (Ctrl+C to stop)...",
    "Attaching to Angular frontend logs (Ctrl+C to stop)...",
)
entry = entry.replace(
    "docker(['compose', 'logs', '-f', '--tail=50', 'discovery-ui']);",
    "docker([\n    'compose',\n    'logs',\n    '-f',\n    '--tail=50',\n    'discovery-ui',\n    'census-mobile-frontend',\n  ]);",
)
entry_path.write_text(entry)


# Add a direct convenience command without changing dependency resolution.
package_path = Path("package.json")
package = package_path.read_text()
if '"start:mobile"' not in package:
    package = replace_once(
        package,
        '    "start:ui": "pnpm nx run discovery-ui:serve",\n',
        '    "start:ui": "pnpm nx run discovery-ui:serve",\n    "start:mobile": "pnpm nx run census-mobile-frontend:serve --port=4300",\n',
        "start:mobile script",
    )
package_path.write_text(package)


# Document the deliberately deferred desktop convergence after the mobile stack reaches main.
plan_path = Path("mobile-first/planning/post-main-desktop-relevance-adoption.md")
plan_path.write_text("""# Post-main Desktop Search Relevance Adoption

Status: deferred until the mobile-first relevance stack is merged to `main`.

## Goal

Bring the rank + relevance presentation proven in `apps/census-mobile-frontend` into the existing `apps/discovery-ui` search results without creating a second relevance algorithm or changing engine ranking behavior.

The desktop application should present the same evidence the API already returns:

- global result rank;
- engine-native raw score as diagnostic data, not user-facing percentage copy;
- query-relative normalized score owned by the backend;
- `STRONG`, `GOOD`, `MODERATE`, `WEAK`, and `LOW` bands;
- the same green -> yellow-green -> amber -> orange -> red visual progression;
- visible text for every band so color is never the only meaning;
- forced-colors/high-contrast behavior;
- the same explanation that match labels are query-relative evidence, not absolute percentages.

Empty repository browse (`q` blank / engine `*:*`) remains explicitly unscored.

## Why wait until main

The mobile implementation is the proving ground for this presentation. Keeping the desktop change out of the stacked mobile PRs avoids widening the current review surface and lets the new API contract, score transport, normalization metadata, Storybook states, and 320px browser evidence settle first.

Once that work is on `main`, desktop adoption becomes a small convergence change rather than another branch in the search architecture.

## Implementation sequence

1. **Consume the shared contract as-is**
   - Do not calculate relevance in `discovery-ui`.
   - Preserve `SearchResult.relevance` and `SearchResponse.relevanceModel` through the existing NgRx state/selectors.
   - Preserve engine ordering; rank is the returned global position, not a client-side sort.

2. **Promote the proven badge into shared search presentation**
   - The second real consumer justifies extracting the mobile relevance badge into a small shared Angular library/module.
   - Keep the public input semantic (`STRONG | GOOD | MODERATE | WEAK | LOW`) rather than passing colors into the component.
   - Keep rank visually distinct from match strength. Rank answers _where did the engine place this?_ Match strength answers _how strong is this result relative to the best hit in this query?_

3. **Integrate with `apps/discovery-ui/src/app/pages/discovery-page.html`**
   - Add global rank near the existing result metadata.
   - Add the shared relevance badge only when `result.relevance` exists.
   - Add one concise result-list explanation when `relevanceModel` is present.
   - Do not show a badge or relevance explanation for empty browse results.
   - Do not replace provenance, access-level, content-type, or authoritative-source metadata.

4. **Retain desktop behavior**
   - Keep the existing URL-addressable facets, NgRx search lifecycle, pagination focus management, map links, and result-detail navigation unchanged.
   - Do not re-sort results in the component.
   - Do not expose raw Solr/OpenSearch score as a percentage.

5. **Validate parity**
   - Unit/component tests for all five bands and missing relevance.
   - Storybook states for the shared badge and representative result cards.
   - Existing discovery Playwright coverage plus assertions for rank, text label, forced-colors semantics where supported, and no relevance on empty browse.
   - Axe/Section 508 sweep with the badge present.

## Acceptance criteria

- The same API response produces the same rank and match label in both frontends.
- No frontend owns normalization thresholds or score math.
- Empty browse remains unscored in both frontends.
- Rank and match strength remain separate concepts.
- Color is supplementary; text survives monochrome/forced-colors rendering.
- No user-facing copy implies that a normalized score is an absolute probability or percent relevance.
- Existing desktop search, facets, pagination, focus behavior, and research-detail links remain intact.

## Follow-on calibration

The current normalization remains `calibrated: false`. A later judged-query corpus should use representative natural-language and keyword queries (including North Dakota migration) to measure Precision@10, nDCG@10, and reciprocal rank before changing band thresholds or marking a model calibrated.
""")

readme_path = Path("mobile-first/README.md")
readme = readme_path.read_text()
readme = readme.replace("Status: proposed", "Status: active development")
if "Post-main Desktop Search Relevance Adoption" not in readme:
    readme = replace_once(
        readme,
        "- [Validation Plan](planning/validation-plan.md)\n",
        "- [Validation Plan](planning/validation-plan.md)\n- [Post-main Desktop Search Relevance Adoption](planning/post-main-desktop-relevance-adoption.md)\n",
        "README desktop adoption link",
    )
readme_path.write_text(readme)
