from pathlib import Path

path = Path("schemas/openapi/repository-api.yaml")
text = path.read_text()

path_anchor = "  /admin/solr/overview:\n"
path_block = """  /admin/corpus/storage:
    get:
      tags: [Admin]
      operationId: getCorpusStorageOverview
      summary: Corpus profile definitions and historical measured local storage footprints.
      responses:
        '200':
          description: Corpus profiles with recent storage history.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CorpusStorageOverview'
        '500':
          $ref: '#/components/responses/InternalServerError'
  /admin/corpus/storage/capture:
    post:
      tags: [Admin]
      operationId: captureCorpusStorage
      summary: Capture the current active corpus storage footprint as historical evidence.
      responses:
        '200':
          description: Newly captured measured storage footprint.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CorpusStorageMeasurement'
        '500':
          $ref: '#/components/responses/InternalServerError'

"""
if "/admin/corpus/storage:" not in text:
    if text.count(path_anchor) != 1:
        raise SystemExit("Expected exactly one admin solr overview path anchor")
    text = text.replace(path_anchor, path_block + path_anchor, 1)

schema_anchor = "    RepositorySource:\n"
schema_block = """    CorpusProfile:
      type: string
      description: >-
        Stable local corpus profile. FEDERATED_10K/100K/1M describe target federated metadata counts
        in addition to the curated repository records; FULL has no fixed count.
      enum: [CURATED_DEMO, FEDERATED_10K, FEDERATED_100K, FEDERATED_1M, FULL]
    DeploymentTopology:
      type: string
      description: Runtime topology associated with a storage measurement.
      enum: [DOCKER_COMPOSE, KIND_CLUSTER, OTHER]
    CorpusStorageMeasurement:
      type: object
      required:
        - id
        - profile
        - topology
        - activeProjectionCount
        - retainedFederatedCount
        - totalMeasuredLocalBytes
        - capturedAt
      properties:
        id:
          type: string
        profile:
          $ref: '#/components/schemas/CorpusProfile'
        topology:
          $ref: '#/components/schemas/DeploymentTopology'
        activeProjectionCount:
          type: integer
          format: int64
          minimum: 0
          description: Documents in the active Solr/OpenSearch discovery projection at capture time.
        retainedFederatedCount:
          type: integer
          format: int64
          minimum: 0
          description: Federated metadata records retained locally whether or not they are active in search.
        projectionId:
          type: string
          pattern: '^[0-9a-f]{64}$'
        applicationPostgresBytes:
          type: integer
          format: int64
          minimum: 0
          description: PostgreSQL database size when the runtime supports an authoritative measurement.
        dspaceStoredBytes:
          type: integer
          format: int64
          minimum: 0
          description: DSpace ORIGINAL bitstream bytes reported by DSpace.
        solrIndexBytes:
          type: integer
          format: int64
          minimum: 0
          description: Public discovery Solr core index bytes reported by Solr CoreAdmin.
        openSearchIndexBytes:
          type: integer
          format: int64
          minimum: 0
          description: OpenSearch comparison index store bytes reported by index stats.
        totalMeasuredLocalBytes:
          type: integer
          format: int64
          minimum: 0
          description: Sum of known measured components; absent components remain unknown, not zero evidence.
        capturedAt:
          type: string
          format: date-time
    CorpusProfileSummary:
      type: object
      required: [profile, label, active]
      properties:
        profile:
          $ref: '#/components/schemas/CorpusProfile'
        label:
          type: string
        active:
          type: boolean
          description: Whether this profile describes the currently active discovery projection.
        targetFederatedRecordCount:
          type: integer
          format: int64
          minimum: 0
          description: Fixed federated-record target when the profile has one.
        latestMeasurement:
          $ref: '#/components/schemas/CorpusStorageMeasurement'
    CorpusStorageOverview:
      type: object
      required: [activeProfile, profiles, history]
      properties:
        activeProfile:
          $ref: '#/components/schemas/CorpusProfile'
        profiles:
          type: array
          items:
            $ref: '#/components/schemas/CorpusProfileSummary'
        history:
          type: array
          items:
            $ref: '#/components/schemas/CorpusStorageMeasurement'

"""
if "    CorpusProfile:\n" not in text:
    if text.count(schema_anchor) != 1:
        raise SystemExit("Expected exactly one RepositorySource schema anchor")
    text = text.replace(schema_anchor, schema_block + schema_anchor, 1)

path.write_text(text)
