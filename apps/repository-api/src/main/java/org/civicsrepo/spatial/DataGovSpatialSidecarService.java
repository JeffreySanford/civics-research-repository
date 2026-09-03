package org.civicsrepo.spatial;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusProfileActivation;
import org.civicsrepo.federation.CorpusProfileActivationStore;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionEvidence;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionEvidenceStore;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.spatial.DataGovSpatialGeometryAnalyzer.Bounds;
import org.civicsrepo.spatial.DataGovSpatialGeometryAnalyzer.GeometryAnalysis;
import org.civicsrepo.spatial.DataGovSpatialGeometryAnalyzer.Point;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Rebuilds the Data.gov spatial sidecar without mutating retained C2 research metadata. */
@Service
public class DataGovSpatialSidecarService {
    static final int SCHEMA_VERSION = 1;
    static final int MAX_PAGE_SIZE = 1_000;
    static final int MAX_PAGES = 2_000;
    static final long EXPECTED_C2_DATA_GOV_RECORDS = 500_000;
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);

    private final String searchUrl;
    private final String apiKey;
    private final ResearchSpatialSidecarStore sidecarStore;
    private final FederatedMetadataCatalog metadataCatalog;
    private final CorpusProfileActivationStore activationStore;
    private final FederatedCompositeCorpusProjectionEvidenceStore projectionEvidenceStore;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Autowired
    public DataGovSpatialSidecarService(
            @Value("${civics.federation.data-gov.search-url:https://api.gsa.gov/technology/datagov/v4/search}")
                    String searchUrl,
            @Value("${civics.federation.data-gov.api-key:DEMO_KEY}") String apiKey,
            ResearchSpatialSidecarStore sidecarStore,
            FederatedMetadataCatalog metadataCatalog,
            CorpusProfileActivationStore activationStore,
            FederatedCompositeCorpusProjectionEvidenceStore projectionEvidenceStore) {
        this(
                searchUrl,
                apiKey,
                sidecarStore,
                metadataCatalog,
                activationStore,
                projectionEvidenceStore,
                HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build(),
                new ObjectMapper(),
                Clock.systemUTC());
    }

    DataGovSpatialSidecarService(
            String searchUrl,
            String apiKey,
            ResearchSpatialSidecarStore sidecarStore,
            FederatedMetadataCatalog metadataCatalog,
            CorpusProfileActivationStore activationStore,
            FederatedCompositeCorpusProjectionEvidenceStore projectionEvidenceStore,
            HttpClient httpClient,
            ObjectMapper objectMapper,
            Clock clock) {
        this.searchUrl = stripTrailingQuestionMark(requireText(searchUrl, "searchUrl"));
        this.apiKey = requireText(apiKey, "apiKey");
        this.sidecarStore = sidecarStore;
        this.metadataCatalog = metadataCatalog;
        this.activationStore = activationStore;
        this.projectionEvidenceStore = projectionEvidenceStore;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public DataGovSpatialSidecarRefreshResult rebuild(int pageSize, int maxPages) {
        int safePageSize = requireRange(pageSize, 1, MAX_PAGE_SIZE, "pageSize");
        int safeMaxPages = requireRange(maxPages, 1, MAX_PAGES, "maxPages");
        requirePersonalApiKey();
        FederatedCompositeCorpusProjectionEvidence projectionEvidence = requireActiveC2Projection();
        long retainedDataGov = metadataCatalog.count(FederatedSourceSystem.DATA_GOV);
        if (retainedDataGov != EXPECTED_C2_DATA_GOV_RECORDS) {
            throw new IllegalStateException(
                    "Data.gov spatial sidecar requires the exact retained C2 Data.gov population of 500,000 records; found "
                            + retainedDataGov
                            + ".");
        }

        OffsetDateTime snapshotAt = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        String buildId = UUID.randomUUID().toString();
        ResearchSpatialSidecarBuild build = new ResearchSpatialSidecarBuild(
                buildId,
                FederatedSourceSystem.DATA_GOV,
                SCHEMA_VERSION,
                snapshotAt,
                snapshotAt,
                projectionEvidence.compositionSha256(),
                projectionEvidence.projectionId(),
                ResearchSpatialSidecarBuild.Status.RUNNING,
                0,
                null,
                null);
        sidecarStore.beginBuild(build);

        int pagesFetched = 0;
        long sourceRowsFetched = 0;
        long publisherShapeRows = 0;
        long sourceQuarantinedShapeRows = 0;
        String cursor = null;
        try {
            while (true) {
                if (pagesFetched >= safeMaxPages) {
                    throw new IllegalStateException(
                            "Data.gov spatial sidecar reached maxPages=" + safeMaxPages + " before source traversal completed.");
                }
                JsonNode page = fetchPage(cursor, safePageSize);
                JsonNode results = page.get("results");
                if (results == null || !results.isArray()) {
                    throw new IllegalStateException("Data.gov spatial sidecar response is missing results.");
                }
                pagesFetched += 1;
                sourceRowsFetched += results.size();

                List<ResearchSpatialSidecarRecord> records = new ArrayList<>();
                for (JsonNode dataset : results) {
                    JsonNode shape = geometryNode(dataset.get("spatial_shape"));
                    if (shape != null) {
                        publisherShapeRows += 1;
                    }
                    ResearchSpatialSidecarRecord record = toRecord(dataset, shape, build);
                    if (shape != null && record.geometryStatus() == SpatialGeometryStatus.QUARANTINED) {
                        sourceQuarantinedShapeRows += 1;
                    }
                    records.add(record);
                }
                sidecarStore.upsertRetainedBatch(buildId, records);

                String nextCursor = optionalText(page.get("after"));
                if (nextCursor != null && results.isEmpty()) {
                    throw new IllegalStateException(
                            "Data.gov spatial sidecar received an empty page with a continuation cursor.");
                }
                if (nextCursor == null) {
                    break;
                }
                cursor = nextCursor;
            }
            ResearchSpatialSidecarBuild completed = sidecarStore.completeAndActivate(buildId);
            return new DataGovSpatialSidecarRefreshResult(
                    completed,
                    pagesFetched,
                    sourceRowsFetched,
                    publisherShapeRows,
                    completed.rowCount(),
                    sourceQuarantinedShapeRows);
        } catch (RuntimeException exception) {
            sidecarStore.failBuild(buildId, exception.getMessage());
            throw exception;
        }
    }

    private FederatedCompositeCorpusProjectionEvidence requireActiveC2Projection() {
        CorpusProfileActivation activation = activationStore
                .findActive()
                .orElseThrow(() -> new IllegalStateException("No active discovery projection is recorded."));
        if (activation.profile() != CorpusProfile.FEDERATED_1M) {
            throw new IllegalStateException(
                    "Data.gov spatial sidecar requires active corpus profile FEDERATED_1M; found " + activation.profile() + ".");
        }
        return projectionEvidenceStore.findRecent(CorpusProfile.FEDERATED_1M, 100).stream()
                .filter(evidence -> evidence.projectionId().equals(activation.projectionId()))
                .filter(evidence -> evidence.federatedRecordCount() == 1_000_000L)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "Active FEDERATED_1M projection is missing its composition-to-projection evidence."));
    }

    private JsonNode fetchPage(String cursor, int pageSize) {
        HttpRequest request = HttpRequest.newBuilder(searchUri(cursor, pageSize))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json")
                .header("X-Api-Key", apiKey)
                .GET()
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 429) {
                String retryAfter = response.headers().firstValue("Retry-After").orElse("unknown");
                throw new IllegalStateException("Data.gov spatial sidecar hit HTTP 429; Retry-After=" + retryAfter + ".");
            }
            if (response.statusCode() >= 300) {
                throw new IllegalStateException(
                        "Data.gov spatial sidecar request failed with HTTP " + response.statusCode() + ".");
            }
            return objectMapper.readTree(response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Data.gov spatial sidecar request was interrupted.", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Data.gov spatial sidecar request failed.", exception);
        }
    }

    private URI searchUri(String cursor, int pageSize) {
        String delimiter = searchUrl.contains("?") ? "&" : "?";
        StringBuilder query = new StringBuilder("spatial_filter=geospatial&per_page=")
                .append(pageSize)
                .append("&sort=last_harvested_date");
        if (cursor != null && !cursor.isBlank()) {
            query.append("&after=").append(URLEncoder.encode(cursor.trim(), StandardCharsets.UTF_8));
        }
        return URI.create(searchUrl + delimiter + query);
    }

    private ResearchSpatialSidecarRecord toRecord(
            JsonNode dataset, JsonNode shape, ResearchSpatialSidecarBuild build) {
        String identifier = firstNonBlank(
                optionalText(dataset.get("identifier")),
                optionalText(dataset.path("dcat").get("identifier")));
        if (identifier == null) {
            throw new IllegalStateException("Data.gov spatial result is missing a stable identifier.");
        }

        Point sourceCentroid =
                DataGovSpatialGeometryAnalyzer.normalizeCentroid(dataset.get("spatial_centroid"), objectMapper);
        String rawDcatSpatial = rawValue(dataset.path("dcat").get("spatial"));

        GeometryAnalysis analysis = shape == null ? null : DataGovSpatialGeometryAnalyzer.analyze(shape);
        SpatialGeometryStatus geometryStatus = analysis == null
                ? SpatialGeometryStatus.NO_PUBLISHER_GEOMETRY
                : analysis.status();
        Bounds bounds = analysis != null && analysis.queryable() ? analysis.bounds() : null;

        Point renderPoint = null;
        String renderMethod = null;
        if (geometryStatus == SpatialGeometryStatus.VALID && bounds != null) {
            renderPoint = bounds.center();
            renderMethod = "SHAPE_BOUNDS_CENTER";
        } else if (geometryStatus == SpatialGeometryStatus.ANTIMERIDIAN_CANDIDATE && sourceCentroid != null) {
            renderPoint = sourceCentroid;
            renderMethod = "DATA_GOV_SOURCE_POINT_FOR_ANTIMERIDIAN_CANDIDATE";
        }

        Map<String, Object> provenance = new LinkedHashMap<>();
        provenance.put("sourceSystem", FederatedSourceSystem.DATA_GOV.name());
        provenance.put("sourceIdentifier", identifier);
        provenance.put("sourceSnapshotAt", build.sourceSnapshotAt().toString());
        provenance.put("sourceMatch", "DATA_GOV_GEOSPATIAL_FILTER");
        if (shape != null) {
            provenance.put("geometrySource", "spatial_shape");
        } else {
            provenance.put("geometrySource", "NONE");
        }
        if (sourceCentroid != null) {
            provenance.put("centroidSource", "spatial_centroid");
            provenance.put("centroidMethod", "DATA_GOV_VERTEX_MEAN");
        }
        if (rawDcatSpatial != null) {
            provenance.put("dcatSpatialSource", "dcat.spatial");
        }

        Map<String, Object> validation = new LinkedHashMap<>();
        validation.put("geometryStatus", geometryStatus.name());
        if (analysis == null) {
            validation.put("geometryType", null);
            validation.put("positionCount", 0);
            validation.put("problems", List.of("publisher spatial_shape is absent"));
        } else {
            validation.put("geometryType", analysis.geometryType());
            validation.put("positionCount", analysis.positionCount());
            validation.put("problems", analysis.problems());
            if (analysis.bounds() != null) {
                validation.put("longitudeSpan", analysis.bounds().longitudeSpan());
            }
            if (sourceCentroid != null && analysis.bounds() != null) {
                validation.put("sourceCentroidWithinShapeBounds", sourceCentroid.within(analysis.bounds()));
            }
        }

        return new ResearchSpatialSidecarRecord(
                FederatedSourceSystem.DATA_GOV,
                identifier,
                build.schemaVersion(),
                build.sourceSnapshotAt(),
                build.capturedAt(),
                build.compositionSha256(),
                build.projectionId(),
                shape == null ? null : shape.toString(),
                analysis == null ? null : analysis.geometryType(),
                geometryStatus,
                bounds == null ? null : bounds.minLon(),
                bounds == null ? null : bounds.minLat(),
                bounds == null ? null : bounds.maxLon(),
                bounds == null ? null : bounds.maxLat(),
                sourceCentroid == null ? null : sourceCentroid.lon(),
                sourceCentroid == null ? null : sourceCentroid.lat(),
                sourceCentroid == null ? null : "DATA_GOV_VERTEX_MEAN",
                renderPoint == null ? null : renderPoint.lon(),
                renderPoint == null ? null : renderPoint.lat(),
                renderMethod,
                rawDcatSpatial,
                json(provenance),
                json(validation));
    }

    private JsonNode geometryNode(JsonNode value) {
        if (value == null || value.isNull() || value.isMissingNode()) {
            return null;
        }
        if (value.isObject()) {
            return value;
        }
        if (value.isTextual()) {
            String raw = value.asText().trim();
            if (!raw.startsWith("{")) {
                return value;
            }
            try {
                return objectMapper.readTree(raw);
            } catch (JsonProcessingException ignored) {
                return value;
            }
        }
        return value;
    }

    private String rawValue(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        if (node.isTextual()) {
            String value = node.asText().trim();
            return value.isBlank() ? null : value;
        }
        return node.toString();
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Spatial sidecar evidence JSON could not be serialized.", exception);
        }
    }

    private void requirePersonalApiKey() {
        String normalized = apiKey.trim();
        if (normalized.equalsIgnoreCase("DEMO_KEY")
                || normalized.equalsIgnoreCase("YOUR_DATA_GOV_API_KEY")
                || normalized.equalsIgnoreCase("CHANGE_ME")) {
            throw new IllegalStateException(
                    "Full Data.gov spatial sidecar rebuild requires a personal civics.federation.data-gov.api-key.");
        }
    }

    private String optionalText(JsonNode node) {
        if (node == null || !node.isValueNode() || node.isNull()) {
            return null;
        }
        String value = node.asText("").trim();
        return value.isBlank() ? null : value;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static int requireRange(int value, int minimum, int maximum, String field) {
        if (value < minimum || value > maximum) {
            throw new IllegalArgumentException(field + " must be between " + minimum + " and " + maximum + ".");
        }
        return value;
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private static String stripTrailingQuestionMark(String value) {
        String result = value.trim();
        while (result.endsWith("?")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }
}
