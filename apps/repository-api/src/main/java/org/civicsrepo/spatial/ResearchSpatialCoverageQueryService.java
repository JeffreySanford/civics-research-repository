package org.civicsrepo.spatial;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Read-only bounded query facade over one activated versioned research spatial sidecar build. */
@Service
public class ResearchSpatialCoverageQueryService {
    public static final int DEFAULT_FEATURE_LIMIT = 200;
    public static final int MAX_FEATURE_LIMIT = 500;

    private final JdbcClient jdbcClient;
    private final ResearchSpatialSidecarStore sidecarStore;
    private final ObjectMapper objectMapper;

    @Autowired
    public ResearchSpatialCoverageQueryService(JdbcClient jdbcClient, ResearchSpatialSidecarStore sidecarStore) {
        this(jdbcClient, sidecarStore, new ObjectMapper());
    }

    ResearchSpatialCoverageQueryService(
            JdbcClient jdbcClient, ResearchSpatialSidecarStore sidecarStore, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.sidecarStore = sidecarStore;
        this.objectMapper = objectMapper;
    }

    public ResearchSpatialCoverageResponse query(
            String query,
            List<String> programs,
            String publisher,
            FederatedSourceSystem sourceSystem,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            ResearchSpatialViewport viewport,
            int featureLimit) {
        if (sourceSystem == null) {
            throw new IllegalArgumentException("sourceSystem is required.");
        }
        if (viewport == null) {
            throw new IllegalArgumentException("viewport is required.");
        }
        int safeFeatureLimit = requireFeatureLimit(featureLimit);
        Criteria criteria = Criteria.normalize(
                query, programs, publisher, sourceSystem, geography, contentType, vintageYear);
        ResearchSpatialSidecarBuild activeBuild = sidecarStore
                .findActiveBuild(sourceSystem)
                .orElseThrow(() -> new ResearchSpatialCoverageUnavailableException(
                        "No active research spatial sidecar build exists for " + sourceSystem + "."));

        QueryPlan plan = buildCriteriaPlan(activeBuild, criteria);
        SummaryCounts counts = queryCounts(plan, viewport);
        List<ResearchSpatialCoverageFeature> features = queryFeatures(plan, viewport, safeFeatureLimit);
        long omittedFeatures = Math.max(0L, counts.viewportMappedRecords() - features.size());

        ResearchSpatialCoverageSummary summary = new ResearchSpatialCoverageSummary(
                counts.matchingRecords(),
                counts.mappedRecords(),
                counts.unmappedRecords(),
                counts.quarantinedRecords(),
                counts.unanchoredAntimeridianRecords(),
                counts.viewportMappedRecords(),
                features.size(),
                omittedFeatures,
                safeFeatureLimit,
                omittedFeatures > 0);

        return new ResearchSpatialCoverageResponse(
                activeBuild.buildId(),
                sourceSystem.name(),
                activeBuild.schemaVersion(),
                activeBuild.sourceSnapshotAt(),
                activeBuild.capturedAt(),
                activeBuild.compositionSha256(),
                activeBuild.projectionId(),
                criteria.fingerprint(),
                viewport,
                summary,
                features);
    }

    private SummaryCounts queryCounts(QueryPlan plan, ResearchSpatialViewport viewport) {
        String viewportCondition = viewportCondition(viewport);
        String sql = """
                select
                    count(*) as matching_records,
                    coalesce(sum(case when r.geometry_status in ('VALID', 'ANTIMERIDIAN_CANDIDATE') then 1 else 0 end), 0)
                        as mapped_records,
                    coalesce(sum(case when r.geometry_status = 'NO_PUBLISHER_GEOMETRY' then 1 else 0 end), 0)
                        as unmapped_records,
                    coalesce(sum(case when r.geometry_status = 'QUARANTINED' then 1 else 0 end), 0)
                        as quarantined_records,
                    coalesce(sum(case when r.geometry_status = 'ANTIMERIDIAN_CANDIDATE'
                        and (r.render_lon is null or r.render_lat is null) then 1 else 0 end), 0)
                        as unanchored_antimeridian_records,
                    coalesce(sum(case when %s then 1 else 0 end), 0) as viewport_mapped_records
                from research_spatial_sidecar_rows r
                join federated_research_objects f
                  on f.source_system = r.source_system
                 and f.source_identifier = r.source_identifier
                where %s
                """.formatted(viewportCondition, plan.whereClause());

        Map<String, Object> params = new LinkedHashMap<>(plan.params());
        addViewportParams(params, viewport);
        var statement = jdbcClient.sql(sql);
        for (Map.Entry<String, Object> param : params.entrySet()) {
            statement.param(param.getKey(), param.getValue());
        }
        return statement.query(this::mapSummaryCounts).single();
    }

    private List<ResearchSpatialCoverageFeature> queryFeatures(
            QueryPlan plan, ResearchSpatialViewport viewport, int featureLimit) {
        String sql = """
                select
                    r.source_system,
                    r.source_identifier,
                    f.title,
                    f.publisher,
                    f.program,
                    f.content_type,
                    f.source_url,
                    r.geometry_status,
                    r.geometry_json,
                    r.render_lon,
                    r.render_lat,
                    r.render_point_method
                from research_spatial_sidecar_rows r
                join federated_research_objects f
                  on f.source_system = r.source_system
                 and f.source_identifier = r.source_identifier
                where %s
                  and %s
                order by lower(f.title), r.source_identifier
                limit :featureLimit
                """.formatted(plan.whereClause(), viewportCondition(viewport));

        Map<String, Object> params = new LinkedHashMap<>(plan.params());
        addViewportParams(params, viewport);
        params.put("featureLimit", featureLimit);
        var statement = jdbcClient.sql(sql);
        for (Map.Entry<String, Object> param : params.entrySet()) {
            statement.param(param.getKey(), param.getValue());
        }
        return statement.query(this::mapFeature).list();
    }

    private QueryPlan buildCriteriaPlan(ResearchSpatialSidecarBuild build, Criteria criteria) {
        StringBuilder where = new StringBuilder("r.build_id = :buildId and r.source_system = :sourceSystem");
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("buildId", build.buildId());
        params.put("sourceSystem", criteria.sourceSystem().name());

        if (!criteria.publisher().isBlank()) {
            where.append(" and lower(f.publisher) = :publisher");
            params.put("publisher", criteria.publisher());
        }
        if (!criteria.programs().isEmpty()) {
            where.append(" and lower(f.program) in (");
            for (int index = 0; index < criteria.programs().size(); index++) {
                if (index > 0) {
                    where.append(", ");
                }
                String parameter = "program" + index;
                where.append(':').append(parameter);
                params.put(parameter, criteria.programs().get(index));
            }
            where.append(')');
        }
        if (criteria.contentType() != null) {
            where.append(" and f.content_type = :contentType");
            params.put("contentType", criteria.contentType().getValue());
        }

        // Current federated Data.gov discovery documents do not project geography or vintageYear.
        // Preserve the shared Discovery contract by treating either filter as no-match instead of
        // fabricating fields that are absent from the authoritative federated projection.
        if (!criteria.geography().isBlank() || criteria.vintageYear() != null) {
            where.append(" and 1 = 0");
        }

        List<String> queryTerms = criteria.queryTerms();
        if (!queryTerms.isEmpty()) {
            String haystack = "lower(f.title || ' ' || f.summary || ' ' || f.publisher || ' ' || f.program)";
            where.append(" and (");
            for (int index = 0; index < queryTerms.size(); index++) {
                if (index > 0) {
                    where.append(" + ");
                }
                String parameter = "queryTerm" + index;
                where.append("case when position(:")
                        .append(parameter)
                        .append(" in ")
                        .append(haystack)
                        .append(") > 0 then 1 else 0 end");
                params.put(parameter, queryTerms.get(index));
            }
            where.append(") >= :requiredQueryTerms");
            params.put("requiredQueryTerms", requiredQueryTerms(queryTerms.size()));
        }

        return new QueryPlan(where.toString(), params);
    }

    private String viewportCondition(ResearchSpatialViewport viewport) {
        String ordinaryLongitude = viewport.crossesAntimeridian()
                ? "(r.max_lon >= :west or r.min_lon <= :east)"
                : "(r.min_lon <= :east and r.max_lon >= :west)";
        String anchorLongitude = viewport.crossesAntimeridian()
                ? "(r.render_lon >= :west or r.render_lon <= :east)"
                : "(r.render_lon between :west and :east)";
        return """
                (
                    (
                        r.geometry_status = 'VALID'
                        and r.min_lat <= :north
                        and r.max_lat >= :south
                        and %s
                    )
                    or
                    (
                        r.geometry_status = 'ANTIMERIDIAN_CANDIDATE'
                        and r.render_lat between :south and :north
                        and %s
                    )
                )
                """.formatted(ordinaryLongitude, anchorLongitude);
    }

    private void addViewportParams(Map<String, Object> params, ResearchSpatialViewport viewport) {
        params.put("west", viewport.west());
        params.put("south", viewport.south());
        params.put("east", viewport.east());
        params.put("north", viewport.north());
    }

    private SummaryCounts mapSummaryCounts(ResultSet resultSet, int rowNumber) throws SQLException {
        return new SummaryCounts(
                resultSet.getLong("matching_records"),
                resultSet.getLong("mapped_records"),
                resultSet.getLong("unmapped_records"),
                resultSet.getLong("quarantined_records"),
                resultSet.getLong("unanchored_antimeridian_records"),
                resultSet.getLong("viewport_mapped_records"));
    }

    private ResearchSpatialCoverageFeature mapFeature(ResultSet resultSet, int rowNumber) throws SQLException {
        String geometryJson = resultSet.getString("geometry_json");
        if (geometryJson == null || geometryJson.isBlank()) {
            throw new IllegalStateException("Queryable spatial sidecar row is missing publisher geometry.");
        }
        final JsonNode geometry;
        try {
            geometry = objectMapper.readTree(geometryJson);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Queryable spatial sidecar row contains invalid geometry JSON.", exception);
        }
        return new ResearchSpatialCoverageFeature(
                resultSet.getString("source_system"),
                resultSet.getString("source_identifier"),
                resultSet.getString("title"),
                resultSet.getString("publisher"),
                resultSet.getString("program"),
                ResearchObjectType.fromValue(resultSet.getString("content_type")),
                resultSet.getString("source_url"),
                SpatialGeometryStatus.valueOf(resultSet.getString("geometry_status")),
                geometry,
                nullableDouble(resultSet, "render_lon"),
                nullableDouble(resultSet, "render_lat"),
                resultSet.getString("render_point_method"));
    }

    private Double nullableDouble(ResultSet resultSet, String column) throws SQLException {
        double value = resultSet.getDouble(column);
        return resultSet.wasNull() ? null : value;
    }

    private int requireFeatureLimit(int featureLimit) {
        if (featureLimit < 1 || featureLimit > MAX_FEATURE_LIMIT) {
            throw new IllegalArgumentException(
                    "limit must be between 1 and " + MAX_FEATURE_LIMIT + ".");
        }
        return featureLimit;
    }

    private int requiredQueryTerms(int termCount) {
        if (termCount <= 2) {
            return termCount;
        }
        return (int) Math.ceil(termCount * 2.0 / 3.0);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private record QueryPlan(String whereClause, Map<String, Object> params) {}

    private record SummaryCounts(
            long matchingRecords,
            long mappedRecords,
            long unmappedRecords,
            long quarantinedRecords,
            long unanchoredAntimeridianRecords,
            long viewportMappedRecords) {}

    private record Criteria(
            String query,
            List<String> programs,
            String publisher,
            FederatedSourceSystem sourceSystem,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            String fingerprint) {
        static Criteria normalize(
                String query,
                List<String> programs,
                String publisher,
                FederatedSourceSystem sourceSystem,
                String geography,
                ResearchObjectType contentType,
                Integer vintageYear) {
            String normalizedQuery = ResearchSpatialCoverageQueryService.normalize(query);
            List<String> normalizedPrograms = normalizePrograms(programs);
            String normalizedPublisher = ResearchSpatialCoverageQueryService.normalize(publisher);
            String normalizedGeography = ResearchSpatialCoverageQueryService.normalize(geography);
            String canonical = String.join(
                    "\n",
                    "q=" + normalizedQuery,
                    "program=" + String.join("\u001f", normalizedPrograms),
                    "publisher=" + normalizedPublisher,
                    "sourceSystem=" + sourceSystem.name(),
                    "geography=" + normalizedGeography,
                    "contentType=" + (contentType == null ? "" : contentType.getValue()),
                    "vintageYear=" + (vintageYear == null ? "" : vintageYear));
            return new Criteria(
                    normalizedQuery,
                    normalizedPrograms,
                    normalizedPublisher,
                    sourceSystem,
                    normalizedGeography,
                    contentType,
                    vintageYear,
                    sha256(canonical));
        }

        List<String> queryTerms() {
            if (query.isBlank()) {
                return List.of();
            }
            List<String> terms = new ArrayList<>();
            for (String term : query.split("\\s+")) {
                if (!term.isBlank()) {
                    terms.add(term);
                }
            }
            return List.copyOf(terms);
        }

        private static List<String> normalizePrograms(List<String> programs) {
            if (programs == null || programs.isEmpty()) {
                return List.of();
            }
            return programs.stream()
                    .map(ResearchSpatialCoverageQueryService::normalize)
                    .filter(value -> !value.isBlank())
                    .distinct()
                    .sorted()
                    .toList();
        }
    }
}
