# Corpus Archives

Corpus archives preserve large retained federated metadata locally so switching discovery profiles never requires re-downloading the same evidence corpus from external publishers.

## Boundary

A corpus archive is a **portable logical backup of normalized federated metadata**, not a copy of Solr or OpenSearch indexes and not a mirror of publisher-owned binaries.

- PostgreSQL retained metadata is authoritative for local federation evidence.
- Solr and OpenSearch remain rebuildable projections.
- DSpace remains the curated repository authority and is not duplicated into a federated archive.
- Publisher files, PDFs, datasets and other binaries remain at their source systems.

Archives are stored below the configured Civics artifacts path (`CIVICS_STORAGE_ARTIFACTS_PATH`, `/var/lib/civics/artifacts` in Docker) so they survive application-container recreation.

## Admin surface

The existing **Admin → Corpus scale & local storage** panel owns archive management because it already distinguishes retained metadata from active search projections.

The panel should list every saved archive with:

| Field | Meaning |
| --- | --- |
| Name | Operator-friendly archive label |
| Profile | Corpus profile represented by the archive |
| Created | Immutable archive creation time |
| Records | Exact archived federated record count |
| Sources | Per-source record counts |
| Size | Compressed archive bytes |
| Archive SHA-256 | Physical archive integrity checksum |
| Corpus/composition SHA-256 | Logical evidence identity when available |
| Integrity | Not checked, verified or failed |
| Freshness | Not checked, no newer marker detected, update available or unknown |
| Last checked | Most recent integrity/freshness check time |

## Actions

### Create archive

Creates a new immutable archive from the selected locally retained corpus/profile. Creating a new archive never modifies an older archive.

For a composite profile such as `FEDERATED_1M`, the archive records the exact source recipe and composition SHA-256 when that evidence exists.

### Verify checksum

Recomputes SHA-256 over the saved archive bytes and compares it with the immutable SHA recorded at creation.

**There is deliberately no `Update checksum` action.** A checksum is evidence. If bytes change, verification must fail. If an intentional corpus change needs preservation, create a new archive with a new creation time and checksum.

### Check freshness

Freshness is distinct from integrity:

- **Integrity** asks whether the saved archive bytes are unchanged.
- **Freshness** asks whether external source metadata appears newer than the marker recorded when the archive was created.

The check is read-only and must never run a harvest.

For current C2 sources:

- **Data.gov**: perform a minimal head probe using `sort=last_harvested_date&per_page=1` and compare the returned `last_harvested_date`/identifier marker with the marker captured at archive creation.
- **DOE OSTI**: perform a minimal head probe using `rows=1&page=1&sort=entry_date&order=desc` and compare the returned `entry_date`/`osti_id` marker with the marker captured at archive creation.

A publisher timeout, authentication failure or HTTP 429 produces `UNKNOWN`; it must never be represented as `CURRENT`.

Because a lightweight head probe cannot prove that no historical record changed without a full source traversal, the positive UI wording should be **“No newer source marker detected”**, not “Source fully current.”

### Restore

Restore is destructive to the currently retained federated catalog and therefore requires explicit confirmation.

Required guardrails:

1. Verify the archive checksum before any catalog mutation.
2. Reject restore when verification fails.
3. Display archive creation time, profile, record count and abbreviated SHA in the confirmation UI.
4. Require an explicit replace operation; never silently overlay an archive on newer retained metadata.
5. Replace retained federated metadata transactionally/batch-wise from the archive.
6. Invalidate source harvest checkpoints/runs and evidence that can no longer be asserted for the replaced corpus.
7. Treat Solr/OpenSearch as stale derived state and require/rebuild the selected projection after restore.
8. Report restored record counts and source counts before declaring success.

### Delete archive

Deletes only the saved archive and its archive manifest. It never deletes the currently retained corpus or active Solr/OpenSearch projection.

Delete requires confirmation showing the archive name, creation time and abbreviated checksum.

## Proposed API

```text
GET    /admin/corpus/archives
POST   /admin/corpus/archives
POST   /admin/corpus/archives/{archiveId}/verify
POST   /admin/corpus/archives/{archiveId}/freshness
POST   /admin/corpus/archives/{archiveId}/restore
DELETE /admin/corpus/archives/{archiveId}
```

Suggested create request:

```json
{
  "profile": "FEDERATED_1M",
  "label": "C2 1M gold master"
}
```

Suggested restore request:

```json
{
  "replaceExisting": true,
  "activateProfileAfterRestore": "FEDERATED_1M"
}
```

## Archive layout

A portable archive should avoid PostgreSQL-version coupling and remain directly readable by repository-api.

```text
/var/lib/civics/artifacts/corpus-archives/<archive-id>/
├── manifest.json
└── federated-records.jsonl.gz
```

`manifest.json` should include at minimum:

```json
{
  "archiveVersion": "civics-corpus-archive/v1",
  "archiveId": "...",
  "label": "C2 1M gold master",
  "profile": "FEDERATED_1M",
  "createdAt": "...",
  "recordCount": 1000000,
  "sourceCounts": {
    "DATA_GOV": 500000,
    "DOE_OSTI": 500000
  },
  "archiveSha256": "...",
  "compositionSha256": "...",
  "sourceFreshnessMarkers": {
    "DATA_GOV": {
      "observedAt": "...",
      "markerTimestamp": "...",
      "markerId": "..."
    },
    "DOE_OSTI": {
      "observedAt": "...",
      "markerTimestamp": "...",
      "markerId": "..."
    }
  }
}
```

## Profile switching after archive creation

Creating or retaining a 1M archive does **not** mean the active search projection must stay at 1M.

The normal operating model remains:

```text
retained local metadata / restored archive
        |
        +-- bounded 100K profile --> Solr + OpenSearch
        |
        +-- exact C2 1M profile --> Solr + OpenSearch
```

Switching from 1M to 100K only rebuilds the derived search projection. The locally retained million-record corpus and its archive remain untouched.
