from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def section(text: str, start: str, end: str, label: str) -> tuple[int, int]:
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f"{label}: start marker missing")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f"{label}: end marker missing")
    return start_index, end_index


spec_path = Path("schemas/openapi/repository-api.yaml")
spec = spec_path.read_text()

relevance_schemas = (
    "    SearchRelevanceBand:\n"
    "      type: string\n"
    "      description: Query-relative match-strength band. This is not an absolute relevance percentage.\n"
    "      enum: [STRONG, GOOD, MODERATE, WEAK, LOW]\n"
    "    SearchRelevance:\n"
    "      type: object\n"
    "      required: [rawScore, normalizedScore, band]\n"
    "      properties:\n"
    "        rawScore:\n"
    "          type: number\n"
    "          format: double\n"
    "          minimum: 0\n"
    "          description: Engine-native relevance score. Values are not comparable across unrelated queries or engines.\n"
    "        normalizedScore:\n"
    "          type: number\n"
    "          format: double\n"
    "          minimum: 0\n"
    "          maximum: 1\n"
    "          description: Query-relative score normalized against the strongest result for this query.\n"
    "        band:\n"
    "          $ref: '#/components/schemas/SearchRelevanceBand'\n"
    "    SearchRelevanceModel:\n"
    "      type: object\n"
    "      required: [engine, normalization, calibrated]\n"
    "      properties:\n"
    "        engine:\n"
    "          $ref: '#/components/schemas/SearchComparisonEngine'\n"
    "        normalization:\n"
    "          type: string\n"
    "          minLength: 1\n"
    "          description: Versioned normalization algorithm identifier.\n"
    "        calibrated:\n"
    "          type: boolean\n"
    "          description: True only after band thresholds have been calibrated against judged relevance queries.\n"
)
comparison_marker = "    SearchEngineComparison:\n"
if "    SearchRelevanceBand:\n" not in spec:
    spec = replace_once(
        spec,
        comparison_marker,
        relevance_schemas + comparison_marker,
        "relevance schemas",
    )

result_start, result_end = section(
    spec, "    SearchResult:\n", "    FacetGroup:\n", "SearchResult section"
)
result_section = spec[result_start:result_end]
if "        relevance:\n" not in result_section:
    source_system = (
        "        sourceSystem:\n"
        "          $ref: '#/components/schemas/SourceSystem'\n"
    )
    result_section = replace_once(
        result_section,
        source_system,
        source_system
        + "        relevance:\n"
        + "          $ref: '#/components/schemas/SearchRelevance'\n",
        "SearchResult relevance property",
    )
    spec = spec[:result_start] + result_section + spec[result_end:]

response_start, response_end = section(
    spec, "    SearchResponse:\n", "    SearchCursorPage:\n", "SearchResponse section"
)
response_section = spec[response_start:response_end]
if "        relevanceModel:\n" not in response_section:
    response_section += (
        "        relevanceModel:\n"
        "          $ref: '#/components/schemas/SearchRelevanceModel'\n"
    )
    spec = spec[:response_start] + response_section + spec[response_end:]
spec_path.write_text(spec)

client_path = Path("libs/repository/api-client/src/lib/repository-api-client.ts")
client = client_path.read_text()
search_result_export = "export type SearchResult = components['schemas']['SearchResult'];\n"
if "export type SearchRelevance =" not in client:
    client = replace_once(
        client,
        search_result_export,
        search_result_export
        + "export type SearchRelevance = components['schemas']['SearchRelevance'];\n"
        + "export type SearchRelevanceBand = components['schemas']['SearchRelevanceBand'];\n"
        + "export type SearchRelevanceModel = components['schemas']['SearchRelevanceModel'];\n",
        "API client relevance exports",
    )
client_path.write_text(client)

solr_path = Path(
    "apps/repository-api/src/main/java/org/civicsrepo/search/SolrSearchClient.java"
)
solr = solr_path.read_text()

results_init = "            List<SearchResult> results = new ArrayList<>();\n"
if "boolean relevanceEnabled" not in solr:
    solr = replace_once(
        solr,
        results_init,
        results_init
        + "            boolean relevanceEnabled = !criteria.query().isBlank();\n"
        + '            Double maxScore = relevanceEnabled ? decimal(response, "maxScore") : null;\n',
        "Solr relevance setup",
    )

if "results.add(withRelevance(new SearchResult(" not in solr:
    solr = replace_once(
        solr,
        "                results.add(new SearchResult(\n",
        "                results.add(withRelevance(new SearchResult(\n",
        "Solr result wrapper",
    )
    solr = replace_once(
        solr,
        "                        .accessLevel(accessLevel(document)));\n",
        "                        .accessLevel(accessLevel(document)), document, maxScore, relevanceEnabled));\n",
        "Solr result relevance attachment",
    )

if "SearchResponse searchResponse = new SearchResponse(" not in solr:
    solr = replace_once(
        solr,
        "            return new SearchResponse(\n",
        "            SearchResponse searchResponse = new SearchResponse(\n",
        "Solr response variable",
    )
    parser_start, parser_end = section(
        solr,
        "    private SearchResponse toSearchResponse(\n",
        "    private Long engineReportedMillis(String responseBody) {\n",
        "Solr response parser",
    )
    parser = solr[parser_start:parser_end]
    parser_catch = "        } catch (JsonProcessingException exception) {\n"
    parser = replace_once(
        parser,
        parser_catch,
        "            if (relevanceEnabled && maxScore != null && maxScore > 0) {\n"
        + "                searchResponse.relevanceModel(SearchRelevanceClassifier.model());\n"
        + "            }\n"
        + "            return searchResponse;\n"
        + parser_catch,
        "Solr response relevance model",
    )
    solr = solr[:parser_start] + parser + solr[parser_end:]

helper_marker = "    private Long engineReportedMillis(String responseBody) {\n"
if "private SearchResult withRelevance(" not in solr:
    helpers = (
        "    private SearchResult withRelevance(\n"
        "            SearchResult result, JsonNode document, Double maxScore, boolean relevanceEnabled) {\n"
        "        if (!relevanceEnabled) {\n"
        "            return result;\n"
        "        }\n\n"
        '        var relevance = SearchRelevanceClassifier.classify(decimal(document, "score"), maxScore);\n'
        "        return relevance == null ? result : result.relevance(relevance);\n"
        "    }\n\n"
        "    private Double decimal(JsonNode parent, String field) {\n"
        "        JsonNode value = parent.path(field);\n"
        "        return value.isNumber() ? value.asDouble() : null;\n"
        "    }\n\n"
    )
    solr = replace_once(solr, helper_marker, helpers + helper_marker, "Solr score helpers")

query_line = (
    '        params.add("q=" + encode(criteria.query().isBlank() ? "*:*" : criteria.query()));\n'
)
if 'params.add("fl=" + encode("*,score"));' not in solr:
    solr = replace_once(
        solr,
        query_line,
        query_line
        + "        if (!criteria.query().isBlank()) {\n"
        + '            params.add("fl=" + encode("*,score"));\n'
        + "        }\n",
        "Solr score field request",
    )
solr_path.write_text(solr)
