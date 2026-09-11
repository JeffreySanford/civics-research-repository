from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if old not in text:
        raise SystemExit(f"Anchor not found in {path}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1))


def write(path: str, content: str) -> None:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content)


# OpenAPI: typed engine-provided match evidence remains optional and additive.
replace_once(
    "schemas/openapi/repository-api.yaml",
    """        relevance:\n          $ref: '#/components/schemas/SearchRelevance'\n    FacetGroup:\n""",
    """        relevance:\n          $ref: '#/components/schemas/SearchRelevance'\n        matchEvidence:\n          type: array\n          description: >-\n            Query-specific fields and terms highlighted by the search engine for this result.\n            This explains matched evidence only; it is not an exact score-contribution breakdown.\n          items:\n            $ref: '#/components/schemas/SearchMatchEvidence'\n    FacetGroup:\n""",
)
replace_once(
    "schemas/openapi/repository-api.yaml",
    """    SearchRelevanceModel:\n      type: object\n""",
    """    SearchMatchField:\n      type: string\n      enum: [TITLE, GEOGRAPHY, SUBJECTS, PROGRAM, AUTHORS, SUMMARY, CITATION, PUBLISHER]\n    SearchMatchEvidence:\n      type: object\n      required: [field, label, matchedTerms]\n      properties:\n        field:\n          $ref: '#/components/schemas/SearchMatchField'\n        label:\n          type: string\n          minLength: 1\n          description: Human-readable indexed field label.\n        matchedTerms:\n          type: array\n          minItems: 1\n          maxItems: 5\n          items:\n            type: string\n            minLength: 1\n          description: Query terms or phrases highlighted by the search engine in this field.\n    SearchRelevanceModel:\n      type: object\n""",
)

# Shared TS client exports the new contract types for either Angular consumer.
replace_once(
    "libs/repository/api-client/src/lib/repository-api-client.ts",
    """export type SearchRelevanceModel =\n  components['schemas']['SearchRelevanceModel'];\nexport type FacetGroup = components['schemas']['FacetGroup'];\n""",
    """export type SearchRelevanceModel =\n  components['schemas']['SearchRelevanceModel'];\nexport type SearchMatchEvidence = components['schemas']['SearchMatchEvidence'];\nexport type SearchMatchField = components['schemas']['SearchMatchField'];\nexport type FacetGroup = components['schemas']['FacetGroup'];\n""",
)

# Solr: request highlighting only for real queries and transform it into typed evidence.
replace_once(
    "apps/repository-api/src/main/java/org/civicsrepo/search/SolrSearchClient.java",
    """import java.util.LinkedHashMap;\nimport java.util.List;\n""",
    """import java.util.LinkedHashMap;\nimport java.util.LinkedHashSet;\nimport java.util.List;\n""",
)
replace_once(
    "apps/repository-api/src/main/java/org/civicsrepo/search/SolrSearchClient.java",
    """import org.civicsrepo.generated.dto.SearchResponse;\nimport org.civicsrepo.generated.dto.SearchResult;\n""",
    """import org.civicsrepo.generated.dto.SearchMatchEvidence;\nimport org.civicsrepo.generated.dto.SearchMatchField;\nimport org.civicsrepo.generated.dto.SearchResponse;\nimport org.civicsrepo.generated.dto.SearchResult;\n""",
)
replace_once(
    "apps/repository-api/src/main/java/org/civicsrepo/search/SolrSearchClient.java",
    """    private static final String CURSOR_SORT = \"score desc,id asc\";\n""",
    """    private static final String CURSOR_SORT = \"score desc,id asc\";\n    private static final String HIGHLIGHT_PRE = \"[[[\";\n    private static final String HIGHLIGHT_POST = \"]]\]";\n    private static final int MAX_MATCH_TERMS_PER_FIELD = 5;\n""".replace("]]\\]", "]]"),
)
replace_once(
    "apps/repository-api/src/main/java/org/civicsrepo/search/SolrSearchClient.java",
    """            for (JsonNode document : response.path(\"docs\")) {\n                results.add(withRelevance(new SearchResult(\n                                text(document, \"id\"),\n                                text(document, \"title_s\"),\n                                ResearchObjectType.fromValue(text(document, \"contentType_s\")),\n                                ResearchProgram.fromValue(text(document, \"program_s\")),\n                                text(document, \"publisher_s\"),\n                                text(document, \"summary_txt\"),\n                                URI.create(text(document, \"sourceUrl_s\")),\n                                ResearchObjectOrigin.fromValue(text(document, \"origin_s\")),\n                                SourceSystem.fromValue(text(document, \"sourceSystem_s\")))\n                        .programName(text(document, \"programName_s\"))\n                        .geography(text(document, \"geography_s\"))\n                        .vintageYear(integer(document, \"vintageYear_i\"))\n                        .accessLevel(accessLevel(document)), document, maxScore, relevanceEnabled));\n            }\n""",
    """            JsonNode highlighting = root.path(\"highlighting\");\n            for (JsonNode document : response.path(\"docs\")) {\n                SearchResult result = withRelevance(new SearchResult(\n                                text(document, \"id\"),\n                                text(document, \"title_s\"),\n                                ResearchObjectType.fromValue(text(document, \"contentType_s\")),\n                                ResearchProgram.fromValue(text(document, \"program_s\")),\n                                text(document, \"publisher_s\"),\n                                text(document, \"summary_txt\"),\n                                URI.create(text(document, \"sourceUrl_s\")),\n                                ResearchObjectOrigin.fromValue(text(document, \"origin_s\")),\n                                SourceSystem.fromValue(text(document, \"sourceSystem_s\")))\n                        .programName(text(document, \"programName_s\"))\n                        .geography(text(document, \"geography_s\"))\n                        .vintageYear(integer(document, \"vintageYear_i\"))\n                        .accessLevel(accessLevel(document)), document, maxScore, relevanceEnabled);\n                results.add(withMatchEvidence(\n                        result, highlighting.path(text(document, \"id\")), relevanceEnabled));\n            }\n""",
)
replace_once(
    "apps/repository-api/src/main/java/org/civicsrepo/search/SolrSearchClient.java",
    """    private Double decimal(JsonNode parent, String field) {\n""",
    """    private SearchResult withMatchEvidence(\n            SearchResult result, JsonNode highlightedDocument, boolean relevanceEnabled) {\n        if (!relevanceEnabled || !highlightedDocument.isObject()) {\n            return result;\n        }\n\n        List<SearchMatchEvidence> evidence = new ArrayList<>();\n        addMatchEvidence(evidence, highlightedDocument, \"title_txt\", SearchMatchField.TITLE, \"Title\");\n        addMatchEvidence(\n                evidence, highlightedDocument, \"geography_txt\", SearchMatchField.GEOGRAPHY, \"Geography\");\n        addMatchEvidence(evidence, highlightedDocument, \"subjects_txt\", SearchMatchField.SUBJECTS, \"Subjects\");\n        addMatchEvidence(evidence, highlightedDocument, \"programName_s\", SearchMatchField.PROGRAM, \"Program\");\n        addMatchEvidence(evidence, highlightedDocument, \"authors_txt\", SearchMatchField.AUTHORS, \"Authors\");\n        addMatchEvidence(evidence, highlightedDocument, \"summary_txt\", SearchMatchField.SUMMARY, \"Summary\");\n        addMatchEvidence(\n                evidence, highlightedDocument, \"citation_txt\", SearchMatchField.CITATION, \"Citation\");\n        addMatchEvidence(\n                evidence, highlightedDocument, \"publisher_txt\", SearchMatchField.PUBLISHER, \"Publisher\");\n\n        return evidence.isEmpty() ? result : result.matchEvidence(evidence);\n    }\n\n    private void addMatchEvidence(\n            List<SearchMatchEvidence> evidence,\n            JsonNode highlightedDocument,\n            String solrField,\n            SearchMatchField field,\n            String label) {\n        LinkedHashSet<String> terms = new LinkedHashSet<>();\n        JsonNode snippets = highlightedDocument.path(solrField);\n        if (!snippets.isArray()) {\n            return;\n        }\n\n        for (JsonNode snippetNode : snippets) {\n            String snippet = snippetNode.asText(\"\");\n            int offset = 0;\n            while (offset < snippet.length() && terms.size() < MAX_MATCH_TERMS_PER_FIELD) {\n                int start = snippet.indexOf(HIGHLIGHT_PRE, offset);\n                if (start < 0) {\n                    break;\n                }\n                int valueStart = start + HIGHLIGHT_PRE.length();\n                int end = snippet.indexOf(HIGHLIGHT_POST, valueStart);\n                if (end < 0) {\n                    break;\n                }\n                String term = snippet.substring(valueStart, end).replaceAll(\"\\\\s+\", \" \").trim();\n                if (!term.isBlank() && term.length() <= 120) {\n                    terms.add(term);\n                }\n                offset = end + HIGHLIGHT_POST.length();\n            }\n            if (terms.size() >= MAX_MATCH_TERMS_PER_FIELD) {\n                break;\n            }\n        }\n\n        if (!terms.isEmpty()) {\n            evidence.add(new SearchMatchEvidence(field, label, List.copyOf(terms)));\n        }\n    }\n\n    private Double decimal(JsonNode parent, String field) {\n""",
)
replace_once(
    "apps/repository-api/src/main/java/org/civicsrepo/search/SolrSearchClient.java",
    """        if (!criteria.query().isBlank()) {\n            params.add(\"fl=\" + encode(\"*,score\"));\n        }\n""",
    """        if (!criteria.query().isBlank()) {\n            params.add(\"fl=\" + encode(\"*,score\"));\n            params.add(\"hl=true\");\n            params.add(\"hl.method=unified\");\n            params.add(\"hl.fl=\"\n                    + encode(\"title_txt,geography_txt,subjects_txt,programName_s,authors_txt,\"\n                            + \"summary_txt,citation_txt,publisher_txt\"));\n            params.add(\"hl.simple.pre=\" + encode(HIGHLIGHT_PRE));\n            params.add(\"hl.simple.post=\" + encode(HIGHLIGHT_POST));\n            params.add(\"hl.snippets=3\");\n            params.add(\"hl.fragsize=160\");\n        }\n""",
)

# Backend cursor tests prove both the Solr request and transformed evidence contract.
replace_once(
    "apps/repository-api/src/test/java/org/civicsrepo/search/SolrSearchClientCursorTest.java",
    """import org.civicsrepo.generated.dto.SearchRelevanceBand;\n""",
    """import org.civicsrepo.generated.dto.SearchMatchField;\nimport org.civicsrepo.generated.dto.SearchRelevanceBand;\n""",
)
replace_once(
    "apps/repository-api/src/test/java/org/civicsrepo/search/SolrSearchClientCursorTest.java",
    """        assertThat(execution.response().getResults().get(1).getRelevance().getBand())\n                .isEqualTo(SearchRelevanceBand.GOOD);\n\n        String decodedQuery = URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8);\n        assertThat(decodedQuery)\n                .contains(\"cursorMark=*\", \"sort=score desc,id asc\", \"rows=2\", \"fl=*,score\")\n                .doesNotContain(\"start=\");\n""",
    """        assertThat(execution.response().getResults().get(1).getRelevance().getBand())\n                .isEqualTo(SearchRelevanceBand.GOOD);\n        assertThat(execution.response().getResults().get(0).getMatchEvidence()).hasSize(2);\n        assertThat(execution.response().getResults().get(0).getMatchEvidence().get(0).getField())\n                .isEqualTo(SearchMatchField.TITLE);\n        assertThat(execution.response().getResults().get(0).getMatchEvidence().get(0).getMatchedTerms())\n                .containsExactly(\"climate\");\n        assertThat(execution.response().getResults().get(0).getMatchEvidence().get(1).getField())\n                .isEqualTo(SearchMatchField.SUMMARY);\n\n        String decodedQuery = URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8);\n        assertThat(decodedQuery)\n                .contains(\n                        \"cursorMark=*\",\n                        \"sort=score desc,id asc\",\n                        \"rows=2\",\n                        \"fl=*,score\",\n                        \"hl=true\",\n                        \"hl.method=unified\",\n                        \"hl.fl=title_txt,geography_txt,subjects_txt,programName_s,authors_txt,summary_txt,citation_txt,publisher_txt\")\n                .doesNotContain(\"start=\");\n""",
)
replace_once(
    "apps/repository-api/src/test/java/org/civicsrepo/search/SolrSearchClientCursorTest.java",
    """        assertThat(execution.response().getRelevanceModel()).isNull();\n        assertThat(execution.response().getResults().get(0).getRelevance()).isNull();\n\n        String decodedQuery = URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8);\n        assertThat(decodedQuery).doesNotContain(\"fl=*,score\");\n""",
    """        assertThat(execution.response().getRelevanceModel()).isNull();\n        assertThat(execution.response().getResults().get(0).getRelevance()).isNull();\n        assertThat(execution.response().getResults().get(0).getMatchEvidence()).isNull();\n\n        String decodedQuery = URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8);\n        assertThat(decodedQuery).doesNotContain(\"fl=*,score\", \"hl=true\");\n""",
)
replace_once(
    "apps/repository-api/src/test/java/org/civicsrepo/search/SolrSearchClientCursorTest.java",
    """                  \"facet_counts\": {\n                    \"facet_fields\": {\n                      \"programName_s\": [],\n                      \"publisher_s\": [],\n                      \"sourceSystem_s\": [],\n                      \"geography_s\": [],\n                      \"contentType_s\": [],\n                      \"vintageYear_i\": []\n                    }\n                  }\n                }\n""",
    """                  \"facet_counts\": {\n                    \"facet_fields\": {\n                      \"programName_s\": [],\n                      \"publisher_s\": [],\n                      \"sourceSystem_s\": [],\n                      \"geography_s\": [],\n                      \"contentType_s\": [],\n                      \"vintageYear_i\": []\n                    }\n                  },\n                  \"highlighting\": {\n                    \"alpha\": {\n                      \"title_txt\": [\"Alpha [[[climate]]] title\"],\n                      \"summary_txt\": [\"[[[climate]]] summary\"]\n                    },\n                    \"bravo\": {\"title_txt\": [\"Bravo [[[climate]]] title\"]},\n                    \"charlie\": {\"title_txt\": [\"Charlie [[[climate]]] title\"]},\n                    \"delta\": {\"title_txt\": [\"Delta [[[climate]]] title\"]},\n                    \"echo\": {\"title_txt\": [\"Echo [[[climate]]] title\"]}\n                  }\n                }\n""",
)

# Mobile module + integration.
replace_once(
    "apps/census-mobile-frontend/src/app/app-module.ts",
    """import { SearchRelevanceBadgeComponent } from './components/search-relevance-badge/search-relevance-badge.component';\n""",
    """import { SearchMatchEvidenceComponent } from './components/search-match-evidence/search-match-evidence.component';\nimport { SearchRelevanceBadgeComponent } from './components/search-relevance-badge/search-relevance-badge.component';\n""",
)
replace_once(
    "apps/census-mobile-frontend/src/app/app-module.ts",
    """  declarations: [App, SearchRelevanceBadgeComponent, SearchSummaryComponent],\n""",
    """  declarations: [\n    App,\n    SearchMatchEvidenceComponent,\n    SearchRelevanceBadgeComponent,\n    SearchSummaryComponent,\n  ],\n""",
)
replace_once(
    "apps/census-mobile-frontend/src/app/app.html",
    """        } @if (result.geography) {\n        <p class=\"result-card__detail\">Geography: {{ result.geography }}</p>\n        }\n      </li>\n""",
    """        } @if (result.geography) {\n        <p class=\"result-card__detail\">Geography: {{ result.geography }}</p>\n        }\n\n        <app-search-match-evidence\n          [evidence]=\"result.matchEvidence\"\n        ></app-search-match-evidence>\n      </li>\n""",
)

write(
    "apps/census-mobile-frontend/src/app/components/search-match-evidence/search-match-evidence.component.ts",
    """import { Component, computed, input } from '@angular/core';\nimport type { SearchMatchEvidence } from 'repository-api-client';\n\n@Component({\n  selector: 'app-search-match-evidence',\n  standalone: false,\n  templateUrl: './search-match-evidence.component.html',\n  styleUrl: './search-match-evidence.component.scss',\n})\nexport class SearchMatchEvidenceComponent {\n  readonly evidence = input<readonly SearchMatchEvidence[] | null>(null);\n  readonly items = computed(() => this.evidence() ?? []);\n}\n""",
)
write(
    "apps/census-mobile-frontend/src/app/components/search-match-evidence/search-match-evidence.component.html",
    """@if (items().length > 0) {\n  <details class=\"match-evidence\">\n    <summary>Why this matched</summary>\n    <div class=\"match-evidence__body\">\n      <p class=\"match-evidence__intro\">\n        The search engine highlighted query terms in these indexed fields.\n      </p>\n      <ul class=\"match-evidence__list\">\n        @for (item of items(); track item.field) {\n          <li>\n            <strong>{{ item.label }}</strong>\n            <span>{{ item.matchedTerms.join(', ') }}</span>\n          </li>\n        }\n      </ul>\n      <p class=\"match-evidence__note\">\n        Matched fields help explain retrieval; they do not represent exact score\n        contribution.\n      </p>\n    </div>\n  </details>\n}\n""",
)
write(
    "apps/census-mobile-frontend/src/app/components/search-match-evidence/search-match-evidence.component.scss",
    """:host {\n  display: block;\n  margin-top: 0.85rem;\n}\n\n.match-evidence {\n  border-top: 1px solid var(--civics-border);\n  padding-top: 0.75rem;\n}\n\n.match-evidence summary {\n  width: fit-content;\n  min-height: 2.75rem;\n  cursor: pointer;\n  color: var(--mat-sys-primary);\n  font-size: 0.875rem;\n  font-weight: 750;\n  line-height: 2.75rem;\n}\n\n.match-evidence summary:focus-visible {\n  outline: 3px solid currentColor;\n  outline-offset: 3px;\n}\n\n.match-evidence__body {\n  padding: 0.25rem 0 0.15rem;\n}\n\n.match-evidence__intro,\n.match-evidence__note {\n  margin: 0;\n  color: var(--civics-text-secondary);\n  font-size: 0.8rem;\n  line-height: 1.45;\n}\n\n.match-evidence__list {\n  display: grid;\n  gap: 0.55rem;\n  margin: 0.75rem 0;\n  padding: 0;\n  list-style: none;\n}\n\n.match-evidence__list li {\n  display: grid;\n  grid-template-columns: minmax(5.5rem, auto) minmax(0, 1fr);\n  gap: 0.65rem;\n  align-items: baseline;\n  padding: 0.55rem 0.65rem;\n  border: 1px solid var(--civics-border);\n  border-radius: var(--civics-radius-sm);\n  background: var(--civics-surface-muted);\n}\n\n.match-evidence__list strong,\n.match-evidence__list span {\n  overflow-wrap: anywhere;\n}\n\n.match-evidence__list span {\n  color: var(--civics-text-secondary);\n  font-size: 0.82rem;\n}\n\n@media (max-width: 360px) {\n  .match-evidence__list li {\n    grid-template-columns: 1fr;\n    gap: 0.2rem;\n  }\n}\n\n@media (forced-colors: active) {\n  .match-evidence__list li {\n    border-color: CanvasText;\n  }\n}\n""",
)
write(
    "apps/census-mobile-frontend/src/app/components/search-match-evidence/search-match-evidence.component.spec.ts",
    """import { ComponentFixture, TestBed } from '@angular/core/testing';\nimport { SearchMatchEvidenceComponent } from './search-match-evidence.component';\n\ndescribe('SearchMatchEvidenceComponent', () => {\n  let fixture: ComponentFixture<SearchMatchEvidenceComponent>;\n\n  beforeEach(async () => {\n    await TestBed.configureTestingModule({\n      declarations: [SearchMatchEvidenceComponent],\n    }).compileComponents();\n    fixture = TestBed.createComponent(SearchMatchEvidenceComponent);\n  });\n\n  it('renders engine-provided fields and terms without claiming score contribution', () => {\n    fixture.componentRef.setInput('evidence', [\n      { field: 'TITLE', label: 'Title', matchedTerms: ['migration'] },\n      {\n        field: 'GEOGRAPHY',\n        label: 'Geography',\n        matchedTerms: ['North Dakota'],\n      },\n    ]);\n    fixture.detectChanges();\n\n    const element = fixture.nativeElement as HTMLElement;\n    expect(element.querySelector('summary')?.textContent).toContain(\n      'Why this matched',\n    );\n    expect(element.textContent).toContain('Title');\n    expect(element.textContent).toContain('migration');\n    expect(element.textContent).toContain('North Dakota');\n    expect(element.textContent).toContain('do not represent exact score contribution');\n  });\n\n  it('renders nothing when the API supplies no match evidence', () => {\n    fixture.detectChanges();\n    expect(\n      (fixture.nativeElement as HTMLElement).querySelector('details'),\n    ).toBeNull();\n  });\n});\n""",
)
write(
    "apps/census-mobile-frontend/src/app/components/search-match-evidence/search-match-evidence.component.stories.ts",
    """import type { Meta, StoryObj } from '@storybook/angular';\nimport { SearchMatchEvidenceComponent } from './search-match-evidence.component';\n\nconst meta: Meta<SearchMatchEvidenceComponent> = {\n  title: 'Mobile Search/Match Evidence',\n  component: SearchMatchEvidenceComponent,\n  parameters: {\n    layout: 'padded',\n    viewport: { defaultViewport: 'mobile320' },\n  },\n};\n\nexport default meta;\ntype Story = StoryObj<SearchMatchEvidenceComponent>;\n\nexport const NorthDakotaMigration: Story = {\n  args: {\n    evidence: [\n      { field: 'TITLE', label: 'Title', matchedTerms: ['migration'] },\n      {\n        field: 'GEOGRAPHY',\n        label: 'Geography',\n        matchedTerms: ['North Dakota'],\n      },\n      {\n        field: 'SUMMARY',\n        label: 'Summary',\n        matchedTerms: ['migration flows'],\n      },\n    ],\n  },\n};\n\nexport const NoEvidence: Story = {\n  args: { evidence: null },\n};\n""",
)

# App-level tests exercise integration and blank-browse suppression.
replace_once(
    "apps/census-mobile-frontend/src/app/app.spec.ts",
    """import { SearchRelevanceBadgeComponent } from './components/search-relevance-badge/search-relevance-badge.component';\n""",
    """import { SearchMatchEvidenceComponent } from './components/search-match-evidence/search-match-evidence.component';\nimport { SearchRelevanceBadgeComponent } from './components/search-relevance-badge/search-relevance-badge.component';\n""",
)
replace_once(
    "apps/census-mobile-frontend/src/app/app.spec.ts",
    """  relevance: {\n    rawScore: 10,\n    normalizedScore: 1,\n    band: 'STRONG',\n  },\n""",
    """  relevance: {\n    rawScore: 10,\n    normalizedScore: 1,\n    band: 'STRONG',\n  },\n  matchEvidence: [\n    { field: 'TITLE', label: 'Title', matchedTerms: ['migration'] },\n    {\n      field: 'GEOGRAPHY',\n      label: 'Geography',\n      matchedTerms: ['North Dakota'],\n    },\n  ],\n""",
)
replace_once(
    "apps/census-mobile-frontend/src/app/app.spec.ts",
    """        App,\n        SearchRelevanceBadgeComponent,\n        SearchSummaryComponent,\n""",
    """        App,\n        SearchMatchEvidenceComponent,\n        SearchRelevanceBadgeComponent,\n        SearchSummaryComponent,\n""",
)
replace_once(
    "apps/census-mobile-frontend/src/app/app.spec.ts",
    """  it('summarizes query-wide result types rather than only the visible page', () => {\n""",
    """  it('renders API-provided match evidence as an accessible disclosure', () => {\n    const store = TestBed.inject(Store);\n    const fixture = TestBed.createComponent(App);\n\n    store.dispatch(\n      MobileSearchActions.searchLoaded({ response: searchResponse }),\n    );\n    fixture.detectChanges();\n\n    const compiled = fixture.nativeElement as HTMLElement;\n    const disclosure = compiled.querySelector('app-search-match-evidence');\n    expect(disclosure?.textContent).toContain('Why this matched');\n    expect(disclosure?.textContent).toContain('Title');\n    expect(disclosure?.textContent).toContain('migration');\n    expect(disclosure?.textContent).toContain('North Dakota');\n  });\n\n  it('summarizes query-wide result types rather than only the visible page', () => {\n""",
)
replace_once(
    "apps/census-mobile-frontend/src/app/app.spec.ts",
    """          results: [{ ...visibleResult, relevance: undefined }],\n""",
    """          results: [\n            {\n              ...visibleResult,\n              relevance: undefined,\n              matchEvidence: undefined,\n            },\n          ],\n""",
)
replace_once(
    "apps/census-mobile-frontend/src/app/app.spec.ts",
    """    expect(compiled.querySelector('.results__relevance-note')).toBeNull();\n""",
    """    expect(compiled.querySelector('.results__relevance-note')).toBeNull();\n    expect(compiled.querySelector('app-search-match-evidence details')).toBeNull();\n""",
)

# 320px browser evidence: disclose the explanation and retain axe/reflow checks.
replace_once(
    "apps/census-mobile-frontend-e2e/src/search-relevance.spec.ts",
    """  vintageYear: 2025,\n  relevance: { rawScore, normalizedScore, band },\n});\n""",
    """  vintageYear: 2025,\n  relevance: { rawScore, normalizedScore, band },\n  matchEvidence:\n    id === 'strong-match'\n      ? [\n          { field: 'TITLE', label: 'Title', matchedTerms: ['migration'] },\n          {\n            field: 'GEOGRAPHY',\n            label: 'Geography',\n            matchedTerms: ['North Dakota'],\n          },\n        ]\n      : undefined,\n});\n""",
)
replace_once(
    "apps/census-mobile-frontend-e2e/src/search-relevance.spec.ts",
    """    await expect(page.getByText('100%')).toHaveCount(0);\n\n    const strongBadge = page.getByLabel(\n""",
    """    await expect(page.getByText('100%')).toHaveCount(0);\n\n    await page.getByText('Why this matched').first().click();\n    await expect(page.getByText('migration', { exact: true })).toBeVisible();\n    await expect(page.getByText('North Dakota', { exact: true })).toBeVisible();\n    await expect(\n      page.getByText('do not represent exact score contribution'),\n    ).toBeVisible();\n\n    const strongBadge = page.getByLabel(\n""",
)
replace_once(
    "apps/census-mobile-frontend-e2e/src/search-relevance.spec.ts",
    """    await expect(page.locator('.results__relevance-note')).toHaveCount(0);\n    await expect(page.getByText('644 matching records')).toBeVisible();\n""",
    """    await expect(page.locator('.results__relevance-note')).toHaveCount(0);\n    await expect(page.locator('.match-evidence')).toHaveCount(0);\n    await expect(page.getByText('644 matching records')).toBeVisible();\n""",
)

# Revised role-alignment roadmap preserves the current PR stack and pulls process evidence forward.
write(
    "mobile-first/planning/post-pr88-role-alignment-roadmap.md",
    """# Post-PR88 Census Role Alignment Roadmap\n\nStatus: active continuation plan after the relevance/startup and search-summary slices.\n\n## Principle\n\nKeep the existing mobile-first roadmap, but bias new work toward the remaining UI/federal-engineering evidence rather than adding another major search technology. The repository already demonstrates Angular, NgRx/RxJS, Signals, REST/OpenAPI, Solr, DSpace, Spring, PostgreSQL, responsive design, and automated accessibility deeply. The highest-value additions now make the human and requirements process equally visible.\n\n## Current stack\n\n- PR #87: query-relative relevance evidence, rank presentation, 320px browser evidence, and full-stack startup.\n- PR #88: query-wide result-type summary backed by server-provided facet counts.\n\n## Next slices\n\n### PR #89 — Search match evidence / “Why this matched?”\n\n- Use engine highlighting rather than raw Solr `debug/explain`.\n- Add an additive typed `matchEvidence[]` API contract.\n- Keep evidence server-owned; Angular renders rather than infers it.\n- Explain matched indexed fields and terms without claiming exact score contribution.\n- Add component, Storybook, backend, 320px Playwright, and axe evidence.\n\n### PR #90 — Requirements traceability + manual accessibility/usability protocol\n\n- Add stable requirement IDs for the mobile search journey.\n- Map requirement -> acceptance criterion -> implementation surface -> automated evidence -> WCAG/Section 508 criterion where applicable.\n- Add manual keyboard, 200%/400% zoom/reflow, forced-colors, reduced-motion, NVDA/JAWS/VoiceOver evidence templates.\n- Add a small real usability-study protocol covering search, filtering, match explanation, and reproducible/shareable search state.\n- Do not manufacture results; record observations only when actual participants complete the tasks.\n\n### PR #91 — Shared `census-ui` primitives + desktop relevance adoption\n\n- Extract only components with demonstrated cross-app reuse.\n- First candidates: relevance badge, match-evidence disclosure, result metadata/rank primitives, pagination/search input only where interfaces truly align.\n- Keep async/search-domain state in each app; shared UI stays presentational.\n- Consume the same server-owned rank/relevance/match-evidence contract from both Angular applications.\n- Preserve existing `discovery-ui` facets, URL state, focus management, map/detail navigation, and NgRx lifecycle.\n\n### Follow-on — Design lifecycle evidence\n\n- Capture wireframe -> annotated component specification -> Storybook states -> production implementation.\n- Record breakpoint, touch-target, drawer, focus, rank-vs-match-strength, forced-colors, and maintenance decisions.\n- Add Figma only when it improves the design collaboration artifact; do not make Figma a runtime dependency.\n\n### Follow-on — Repository steward/internal workflow\n\n- Add a small internal-facing status/steward surface using existing repository authority, synchronization, projection, and search-health data.\n- Keep privileged mutations separate and explicitly protected; a read-only status slice is sufficient first.\n\n## Explicitly deferred\n\n- Semantic/vector search.\n- Additional OpenSearch sophistication solely for novelty.\n- Client-owned relevance algorithms.\n\nThose are lower-value for the current Census UI-engineering alignment than explainability, traceability, design evidence, user feedback, shared UI discipline, and an internal workflow.\n""",
)
