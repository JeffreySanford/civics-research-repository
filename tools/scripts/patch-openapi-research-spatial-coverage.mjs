import { readFile, writeFile } from 'node:fs/promises';

const path = 'schemas/openapi/repository-api.yaml';
let source = await readFile(path, 'utf8');

const endpoint = `  /maps/research-coverage:
    get:
      tags: [Maps]
      operationId: getResearchSpatialCoverage
      summary: Get criteria- and viewport-bounded research coverage.
      description: >-
        Reads one activated, versioned research spatial sidecar build and returns explicit
        matching, mapped, unmapped, quarantined, viewport, truncation, and omitted counts plus a
        deterministic bounded feature set. The browser never receives the complete spatial
        sidecar. A viewport whose west value is greater than east crosses the antimeridian.
      parameters:
        - $ref: '#/components/parameters/SearchQuery'
        - $ref: '#/components/parameters/Program'
        - $ref: '#/components/parameters/Publisher'
        - name: sourceSystem
          in: query
          required: false
          description: Spatial sidecar source system; currently DATA_GOV is the supported active source.
          schema:
            $ref: '#/components/schemas/FederatedSourceSystem'
            default: DATA_GOV
        - $ref: '#/components/parameters/Geography'
        - $ref: '#/components/parameters/ContentType'
        - $ref: '#/components/parameters/VintageYear'
        - name: west
          in: query
          required: true
          description: Western WGS84 longitude. Values greater than east denote a dateline-crossing viewport.
          schema:
            type: number
            format: double
            minimum: -180
            maximum: 180
        - name: south
          in: query
          required: true
          description: Southern WGS84 latitude.
          schema:
            type: number
            format: double
            minimum: -90
            maximum: 90
        - name: east
          in: query
          required: true
          description: Eastern WGS84 longitude.
          schema:
            type: number
            format: double
            minimum: -180
            maximum: 180
        - name: north
          in: query
          required: true
          description: Northern WGS84 latitude; must be greater than or equal to south.
          schema:
            type: number
            format: double
            minimum: -90
            maximum: 90
        - name: limit
          in: query
          required: false
          description: Hard maximum number of map features returned for this viewport.
          schema:
            type: integer
            minimum: 1
            maximum: 500
            default: 200
      responses:
        '200':
          description: Bounded spatial coverage summary and feature set.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ResearchSpatialCoverageResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '500':
          $ref: '#/components/responses/InternalServerError'
        '503':
          $ref: '#/components/responses/ServiceUnavailable'
`;

const schemas = `    ResearchSpatialGeometryStatus:
      type: string
      enum: [VALID, ANTIMERIDIAN_CANDIDATE, NO_PUBLISHER_GEOMETRY, QUARANTINED]
    ResearchSpatialViewport:
      type: object
      required: [west, south, east, north]
      description: >-
        WGS84 viewport. west greater than east represents a viewport that crosses the
        antimeridian; south must be less than or equal to north.
      properties:
        west:
          type: number
          format: double
          minimum: -180
          maximum: 180
        south:
          type: number
          format: double
          minimum: -90
          maximum: 90
        east:
          type: number
          format: double
          minimum: -180
          maximum: 180
        north:
          type: number
          format: double
          minimum: -90
          maximum: 90
    ResearchSpatialCoverageSummary:
      type: object
      required:
        - matchingRecords
        - mappedRecords
        - unmappedRecords
        - quarantinedRecords
        - unanchoredAntimeridianRecords
        - viewportMappedRecords
        - returnedFeatures
        - omittedFeatures
        - featureLimit
        - truncated
      properties:
        matchingRecords:
          type: integer
          format: int64
          minimum: 0
        mappedRecords:
          type: integer
          format: int64
          minimum: 0
        unmappedRecords:
          type: integer
          format: int64
          minimum: 0
        quarantinedRecords:
          type: integer
          format: int64
          minimum: 0
        unanchoredAntimeridianRecords:
          type: integer
          format: int64
          minimum: 0
        viewportMappedRecords:
          type: integer
          format: int64
          minimum: 0
        returnedFeatures:
          type: integer
          minimum: 0
          maximum: 500
        omittedFeatures:
          type: integer
          format: int64
          minimum: 0
        featureLimit:
          type: integer
          minimum: 1
          maximum: 500
        truncated:
          type: boolean
    ResearchSpatialCoverageFeature:
      type: object
      required:
        - sourceSystem
        - sourceIdentifier
        - title
        - publisher
        - program
        - contentType
        - sourceUrl
        - geometryStatus
        - geometry
        - renderLon
        - renderLat
        - renderPointMethod
      properties:
        sourceSystem:
          $ref: '#/components/schemas/FederatedSourceSystem'
        sourceIdentifier:
          type: string
          minLength: 1
        title:
          type: string
          minLength: 1
        publisher:
          type: string
        program:
          type: string
        contentType:
          $ref: '#/components/schemas/ResearchObjectType'
        sourceUrl:
          type: string
          format: uri
        geometryStatus:
          $ref: '#/components/schemas/ResearchSpatialGeometryStatus'
        geometry:
          type: object
          description: Full publisher GeoJSON geometry retained by the active sidecar build.
          additionalProperties: true
        renderLon:
          type: [number, 'null']
          format: double
          minimum: -180
          maximum: 180
        renderLat:
          type: [number, 'null']
          format: double
          minimum: -90
          maximum: 90
        renderPointMethod:
          type: [string, 'null']
    ResearchSpatialCoverageResponse:
      type: object
      required:
        - buildId
        - sourceSystem
        - schemaVersion
        - sourceSnapshotAt
        - capturedAt
        - compositionSha256
        - projectionId
        - criteriaFingerprint
        - viewport
        - summary
        - features
      properties:
        buildId:
          type: string
          minLength: 1
        sourceSystem:
          $ref: '#/components/schemas/FederatedSourceSystem'
        schemaVersion:
          type: integer
          minimum: 1
        sourceSnapshotAt:
          type: string
          format: date-time
        capturedAt:
          type: string
          format: date-time
        compositionSha256:
          type: string
          pattern: '^[0-9a-f]{64}$'
        projectionId:
          type: string
          pattern: '^[0-9a-f]{64}$'
        criteriaFingerprint:
          type: string
          pattern: '^[0-9a-f]{64}$'
        viewport:
          $ref: '#/components/schemas/ResearchSpatialViewport'
        summary:
          $ref: '#/components/schemas/ResearchSpatialCoverageSummary'
        features:
          type: array
          maxItems: 500
          items:
            $ref: '#/components/schemas/ResearchSpatialCoverageFeature'
`;

if (!source.includes('  /maps/research-coverage:\n')) {
  const marker = '  /overlays/census/lodes-flow:\n';
  if (!source.includes(marker)) {
    throw new Error('Could not find Maps endpoint insertion marker.');
  }
  source = source.replace(marker, endpoint + marker);
}

if (!source.includes('    ResearchSpatialCoverageResponse:\n')) {
  const marker = '    DataGovSpatialSidecarStatusResponse:\n';
  if (!source.includes(marker)) {
    throw new Error('Could not find spatial schema insertion marker.');
  }
  source = source.replace(marker, schemas + marker);
}

await writeFile(path, source);
