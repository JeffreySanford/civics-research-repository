# Mobile research-detail navigation

Status: planned after shared search-presentation convergence (PR #92).

## User problem

Search results are currently informative but not actionable. A reader can evaluate rank, match strength, summary, and match evidence, but cannot open the individual research object from the mobile-first application.

## Goal

Make each mobile search result a gateway to the existing authority-neutral research detail contract, while preserving the exact search/filter context for a reliable return journey.

## Proposed interaction

- Give each result a clear `View research object` link; the title may also link to the same destination, but the card itself will not become a giant ambiguous click target.
- Route to `/research/:researchId` using the same canonical Base64URL identity encoding used by `discovery-ui`.
- Render a mobile-first detail page from `RepositoryDatasetsApi.getResearchObject(researchId)`; do not create a mobile-only backend endpoint.
- Put a visible `Back to results` control before the detail heading.
- Prefer browser history when the detail was opened from results, so the original query, filters, scroll/history entry, and URL are restored naturally.
- For a directly opened/deep-linked detail page with no usable search history, fall back to the last explicit search return URL carried in navigation state/query context, otherwise return to `/`.
- Move focus to the detail heading after navigation. Returning should restore focus to the result link that launched the detail when practical; at minimum the results heading must receive deterministic focus.

## Detail states

The mobile page must visibly handle loading, error/not-found, curated DSpace detail, and federated detail. Curated objects may expose repository-owned enrichments; federated objects must keep their external authority/provenance clear. Reuse the existing research-object contract and its authority rules rather than copying desktop presentation wholesale.

## Accessibility and navigation acceptance

1. Keyboard and touch users can open every result without relying on card-click JavaScript.
2. The link has an accessible name identifying the record or action.
3. The detail route is deep-linkable and refresh-safe.
4. `Back to results` restores the exact query and active filters, including URLs such as `?q=North%20Dakota%20migration&type=DATASET`.
5. Browser Back behaves consistently with the visible Back control.
6. Heading/focus behavior is deterministic and verified in Playwright.
7. 320 px reflow, axe/WCAG checks, loading/error states, and both curated/federated fixtures are covered.
8. The detail page does not invent ranking or search evidence; those belong to the originating result/search context.

## Suggested implementation slice

Treat this as the next mobile functional PR after #92. Keep NgRx/RxJS for the asynchronous detail request and local Signals only for synchronous view state if needed. Reuse a shared research-ID codec if the second frontend now justifies extracting the desktop helper.
