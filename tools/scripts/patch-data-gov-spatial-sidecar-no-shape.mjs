import { readFile, writeFile } from 'node:fs/promises';

const STORE_PATH =
  'apps/repository-api/src/main/java/org/civicsrepo/spatial/JdbcResearchSpatialSidecarStore.java';
const SERVICE_PATH =
  'apps/repository-api/src/main/java/org/civicsrepo/spatial/DataGovSpatialSidecarService.java';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) {
    return source;
  }
  if (!source.includes(before)) {
    throw new Error(`Missing ${label} patch anchor.`);
  }
  return source.replace(before, after);
}

let store = await readFile(STORE_PATH, 'utf8');
store = replaceRequired(
  store,
  '                            geometry_json text not null,\n                            geometry_type text not null,',
  '                            geometry_json text,\n                            geometry_type text,',
  'nullable geometry columns',
);
store = replaceRequired(
  store,
  '        statement.setString(6, record.geometryJson());\n        statement.setString(7, record.geometryType());',
  '        setString(statement, 6, record.geometryJson());\n        setString(statement, 7, record.geometryType());',
  'nullable update geometry binding',
);
store = replaceRequired(
  store,
  '        statement.setString(9, record.geometryJson());\n        statement.setString(10, record.geometryType());',
  '        setString(statement, 9, record.geometryJson());\n        setString(statement, 10, record.geometryType());',
  'nullable insert geometry binding',
);
await writeFile(STORE_PATH, store);

let service = await readFile(SERVICE_PATH, 'utf8');
service = replaceRequired(
  service,
  '        long quarantinedRows = 0;',
  '        long sourceQuarantinedShapeRows = 0;',
  'source quarantine counter',
);
service = replaceRequired(
  service,
  `                for (JsonNode dataset : results) {
                    JsonNode shape = geometryNode(dataset.get("spatial_shape"));
                    if (shape == null) {
                        continue;
                    }
                    publisherShapeRows += 1;
                    ResearchSpatialSidecarRecord record = toRecord(dataset, shape, build);
                    if (record.geometryStatus() == SpatialGeometryStatus.QUARANTINED) {
                        quarantinedRows += 1;
                    }
                    records.add(record);
                }`,
  `                for (JsonNode dataset : results) {
                    JsonNode shape = geometryNode(dataset.get("spatial_shape"));
                    if (shape != null) {
                        publisherShapeRows += 1;
                    }
                    ResearchSpatialSidecarRecord record = toRecord(dataset, shape, build);
                    if (shape != null && record.geometryStatus() == SpatialGeometryStatus.QUARANTINED) {
                        sourceQuarantinedShapeRows += 1;
                    }
                    records.add(record);
                }`,
  'retain no-shape source rows',
);
service = replaceRequired(
  service,
  '                    quarantinedRows);',
  '                    sourceQuarantinedShapeRows);',
  'source quarantine result',
);

const methodStart = service.indexOf('    private ResearchSpatialSidecarRecord toRecord(');
const methodEnd = service.indexOf('    private JsonNode geometryNode(', methodStart);
if (methodStart < 0 || methodEnd < 0) {
  throw new Error('Missing toRecord method anchors.');
}
const newToRecord = `    private ResearchSpatialSidecarRecord toRecord(
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

`;
service = service.slice(0, methodStart) + newToRecord + service.slice(methodEnd);
await writeFile(SERVICE_PATH, service);
