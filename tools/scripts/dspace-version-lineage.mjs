import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  dspaceSessionCookie,
  refreshDspaceSession,
} from './dspace-session.mjs';
import { advanceDspaceWorkflow } from './dspace-workflow.mjs';

const apiBaseUrl =
  process.env.CIVICS_EVIDENCE_API_URL ?? 'http://localhost:8080/api';
const dspaceBaseUrl =
  process.env.DSPACE_BASE_URL ?? 'http://localhost:8081/server';
const adminEmail =
  process.env.CIVICS_DSPACE_ADMIN_EMAIL ??
  process.env.DSPACE_SEED_ADMIN_EMAIL ??
  'admin@civics.local';
const adminPassword =
  process.env.CIVICS_DSPACE_ADMIN_PASSWORD ??
  process.env.DSPACE_SEED_ADMIN_PASSWORD ??
  'local-demo-not-a-secret';
const output = resolve(
  process.env.CIVICS_LINEAGE_EVIDENCE_OUTPUT ??
    'browser-evidence-artifacts/dspace-version-lineage.json',
);
const researchObjectId = 'tiger-line-north-dakota-2025';
const versionSummary = 'Phase C observed DSpace lineage proof';
const readinessTimeoutMs = Number.parseInt(
  process.env.DSPACE_LINEAGE_WAIT_TIMEOUT_MS ?? '60000',
  10,
);
const readinessIntervalMs = Number.parseInt(
  process.env.DSPACE_LINEAGE_WAIT_INTERVAL_MS ?? '1000',
  10,
);

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function apiJson(path, init = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}: ${text}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

function actionTypes(job) {
  return (job.actions ?? []).map((action) => action.actionType);
}

async function sync(mode) {
  return apiJson('/admin/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode, source: 'TIGER_LINE' }),
  });
}

async function login(csrfToken, cookie) {
  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
  };
  if (csrfToken) {
    headers['X-XSRF-TOKEN'] = csrfToken;
  }
  if (cookie) {
    headers.cookie = cookie;
  }

  return fetch(`${dspaceBaseUrl}/api/authn/login`, {
    method: 'POST',
    headers,
    body: new URLSearchParams({ user: adminEmail, password: adminPassword }),
  });
}

async function authenticate() {
  const csrfResponse = await login(null, null);
  const firstCsrf = csrfResponse.headers.get('DSPACE-XSRF-TOKEN');
  const firstCookie = dspaceSessionCookie(csrfResponse);
  requireCondition(
    firstCsrf,
    'DSpace CSRF bootstrap did not return DSPACE-XSRF-TOKEN.',
  );

  const loginResponse = await login(firstCsrf, firstCookie);
  const body = await loginResponse.text();
  requireCondition(
    loginResponse.ok,
    `DSpace login failed with HTTP ${loginResponse.status}: ${body}`,
  );

  const authorization = loginResponse.headers.get('Authorization');
  const csrfToken = loginResponse.headers.get('DSPACE-XSRF-TOKEN') ?? firstCsrf;
  const cookie = dspaceSessionCookie(loginResponse) ?? firstCookie;
  requireCondition(authorization, 'DSpace login did not return Authorization.');
  requireCondition(csrfToken, 'DSpace login did not retain a CSRF token.');
  requireCondition(cookie, 'DSpace login did not retain the XSRF cookie.');

  return { authorization, csrfToken, cookie };
}

function authenticatedHeaders(session, extra = {}) {
  return {
    Authorization: session.authorization,
    'X-XSRF-TOKEN': session.csrfToken,
    Cookie: session.cookie,
    ...extra,
  };
}

async function dspace(pathOrUrl, session, init = {}, accepted = [200]) {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${dspaceBaseUrl}${pathOrUrl}`;
  const response = await fetch(url, {
    ...init,
    headers: authenticatedHeaders(session, init.headers ?? {}),
  });
  refreshDspaceSession(session, response);
  const text = await response.text();
  if (!accepted.includes(response.status)) {
    throw new Error(
      `${init.method ?? 'GET'} ${url} failed with HTTP ${response.status}: ${text}`,
    );
  }
  return {
    response,
    text,
    json: text ? JSON.parse(text) : null,
  };
}

function metadataValues(item, field) {
  return (item?.metadata?.[field] ?? [])
    .map((entry) => String(entry?.value ?? '').trim())
    .filter(Boolean);
}

function sourceIdentifierMatches(item) {
  return [
    ...metadataValues(item, 'crr.identifier.source'),
    ...metadataValues(item, 'dc.identifier.other'),
  ].some((value) => value.toLowerCase() === researchObjectId.toLowerCase());
}

async function discoverCurrentItem(session) {
  const query = encodeURIComponent(researchObjectId);
  const { json } = await dspace(
    `/api/discover/search/objects?query=${query}&size=25`,
    session,
  );
  const objects = json?._embedded?.searchResult?._embedded?.objects ?? [];
  return objects
    .map((object) => object?._embedded?.indexableObject)
    .filter((item) => item?.type === 'item' && !item?.withdrawn)
    .find(sourceIdentifierMatches);
}

async function waitForArchivedItem(itemUuid, session) {
  const startedAt = Date.now();
  let lastState = 'not yet readable';
  while (Date.now() - startedAt < readinessTimeoutMs) {
    const result = await dspace(
      `/api/core/items/${encodeURIComponent(itemUuid)}`,
      session,
      {},
      [200, 404],
    );
    if (result.response.status === 200) {
      lastState = `inArchive=${result.json?.inArchive}, withdrawn=${result.json?.withdrawn}`;
      if (result.json?.inArchive === true && result.json?.withdrawn !== true) {
        return result.json;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, readinessIntervalMs));
  }
  throw new Error(
    `New DSpace version item ${itemUuid} did not become archived within ${readinessTimeoutMs}ms (${lastState}).`,
  );
}

async function waitForDiscoveryItem(itemUuid, session) {
  const startedAt = Date.now();
  let lastUuid = 'none';
  while (Date.now() - startedAt < readinessTimeoutMs) {
    const item = await discoverCurrentItem(session);
    lastUuid = item?.uuid ?? 'none';
    if (item?.uuid === itemUuid) {
      return item;
    }
    await new Promise((resolve) => setTimeout(resolve, readinessIntervalMs));
  }
  throw new Error(
    `DSpace discovery did not expose new current item ${itemUuid} within ${readinessTimeoutMs}ms (last matched ${lastUuid}).`,
  );
}

const token = Buffer.from(researchObjectId, 'utf8').toString('base64url');
const baseline = await apiJson(`/research/${token}/versions`);
requireCondition(
  baseline.status === 'OBSERVED_CURRENT_ONLY',
  `Expected Phase B baseline OBSERVED_CURRENT_ONLY before creating repository lineage; received ${baseline.status}`,
);
requireCondition(
  baseline.versions?.length === 1,
  `Expected exactly one Phase B observed record; received ${baseline.versions?.length ?? 0}`,
);

const session = await authenticate();
const originalItem = await discoverCurrentItem(session);
requireCondition(
  originalItem?.uuid,
  'Could not resolve the current TIGER item UUID from DSpace discovery.',
);

const createVersion = await dspace(
  `/api/versioning/versions?summary=${encodeURIComponent(versionSummary)}`,
  session,
  {
    method: 'POST',
    headers: { 'content-type': 'text/uri-list' },
    body: `${dspaceBaseUrl}/api/core/items/${originalItem.uuid}`,
  },
  [201],
);
const createdVersion = createVersion.json;
requireCondition(createdVersion?.id, 'DSpace did not return a new version id.');

const linkedItemHref =
  createdVersion?._links?.item?.href ??
  `${dspaceBaseUrl}/api/versioning/versions/${createdVersion.id}/item`;
const draftItem = (await dspace(linkedItemHref, session)).json;
requireCondition(
  draftItem?.uuid,
  'New DSpace version did not expose its linked item UUID.',
);
requireCondition(
  draftItem.uuid !== originalItem.uuid,
  'DSpace version creation did not produce a distinct item UUID.',
);

const issueDate = metadataValues(originalItem, 'dc.date.issued')[0];
requireCondition(
  issueDate,
  'The archived source item did not expose the required dc.date.issued metadata.',
);
if (!metadataValues(draftItem, 'dc.date.issued').includes(issueDate)) {
  await dspace(
    `/api/core/items/${encodeURIComponent(draftItem.uuid)}`,
    session,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json-patch+json' },
      body: JSON.stringify([
        {
          op: 'add',
          path: '/metadata/dc.date.issued/-',
          value: { value: issueDate },
        },
      ]),
    },
  );
}

let workspace = (
  await dspace(
    `/api/submission/workspaceitems/search/item?uuid=${encodeURIComponent(draftItem.uuid)}`,
    session,
  )
).json;
requireCondition(
  workspace?.id,
  'New DSpace version was not represented by a WorkspaceItem.',
);

if (
  workspace.sections?.license &&
  workspace.sections.license.granted !== true
) {
  workspace = (
    await dspace(
      `/api/submission/workspaceitems/${encodeURIComponent(workspace.id)}`,
      session,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json-patch+json' },
        body: JSON.stringify([
          { op: 'add', path: '/sections/license/granted', value: true },
        ]),
      },
    )
  ).json;
}

const workspaceHref =
  workspace?._links?.self?.href ??
  `${dspaceBaseUrl}/api/submission/workspaceitems/${workspace.id}`;
await dspace(
  '/api/workflow/workflowitems',
  session,
  {
    method: 'POST',
    headers: { 'content-type': 'text/uri-list' },
    body: workspaceHref,
  },
  [201],
);

const workflowTransitions = await advanceDspaceWorkflow({
  dspace,
  session,
  itemUuid: draftItem.uuid,
  adminEmail,
  dspaceBaseUrl,
});
requireCondition(
  workflowTransitions.length > 0,
  'DSpace did not require or record a real workflow approval transition.',
);

const archivedItem = await waitForArchivedItem(draftItem.uuid, session);
await waitForDiscoveryItem(draftItem.uuid, session);

// Rebuild the active projection once DSpace discovery exposes the new archived item. The rebuild
// invalidates RepositoryCatalog first, so the public version request cannot be satisfied by the
// pre-version 60-second item cache.
await apiJson('/admin/reindex', { method: 'POST' });

const history = await apiJson(`/research/${token}/versions`);
requireCondition(
  history.status === 'HISTORY_AVAILABLE',
  `Expected HISTORY_AVAILABLE after creating a second real DSpace version; received ${history.status}`,
);
requireCondition(
  history.versions?.length >= 2,
  `Expected at least two observed DSpace versions; received ${history.versions?.length ?? 0}`,
);

const [current, previous] = history.versions;
requireCondition(
  current.current === true,
  'Newest DSpace version must be marked current.',
);
requireCondition(
  previous.current !== true,
  'Prior DSpace version must not be marked current.',
);
requireCondition(
  current.id?.startsWith('dspace-version:'),
  `Expected DSpace-native current version identity; received ${current.id}`,
);
requireCondition(
  previous.id?.startsWith('dspace-version:'),
  `Expected DSpace-native prior version identity; received ${previous.id}`,
);
requireCondition(
  current.versionLabel?.startsWith('Repository version '),
  `Expected explicit repository version label; received ${current.versionLabel ?? 'absent'}`,
);
requireCondition(
  previous.versionLabel?.startsWith('Repository version '),
  `Expected explicit prior repository version label; received ${previous.versionLabel ?? 'absent'}`,
);
requireCondition(
  current.isVersionOf === researchObjectId &&
    previous.isVersionOf === researchObjectId,
  'DSpace versions must retain the canonical research-object identity.',
);
requireCondition(
  current.supersedes === previous.id,
  `Expected adjacency-backed supersedes ${previous.id}; received ${current.supersedes ?? 'absent'}`,
);
requireCondition(
  current.changeNote === versionSummary,
  `Expected DSpace version summary as change note; received ${current.changeNote ?? 'absent'}`,
);
requireCondition(
  current.sourceUrl != null && previous.sourceUrl != null,
  'Cloned DSpace versions should retain the source URL actually recorded on each archived item.',
);

const replayDiff = await sync('DIFF');
const replayActions = actionTypes(replayDiff);
requireCondition(
  replayDiff.status === 'DIFF_COMPLETE',
  `Expected DIFF_COMPLETE after read-only lineage observation; received ${replayDiff.status}`,
);
requireCondition(
  replayActions.includes('SKIP_ITEM'),
  `Expected replay-safe SKIP_ITEM after lineage read; received ${replayActions.join(', ')}`,
);
requireCondition(
  !replayActions.includes('CREATE_ITEM') &&
    !replayActions.includes('UPDATE_ITEM'),
  `Lineage observation must not create/update source metadata (${replayActions.join(', ')})`,
);

const evidence = {
  evidenceVersion: 1,
  researchObjectId,
  baseline: {
    status: baseline.status,
    versionCount: baseline.versions.length,
    versionLabel: baseline.versions[0]?.versionLabel ?? null,
  },
  dspace: {
    originalItemUuid: originalItem.uuid,
    newItemUuid: archivedItem.uuid,
    createdVersionId: String(createdVersion.id),
    createdVersionNumber: String(createdVersion.version ?? ''),
    summary: versionSummary,
    workflowTransitions,
  },
  observedHistory: {
    status: history.status,
    versionCount: history.versions.length,
    versions: history.versions.map((version) => ({
      id: version.id,
      versionLabel: version.versionLabel ?? null,
      versionDate: version.versionDate ?? null,
      current: version.current ?? false,
      isVersionOf: version.isVersionOf ?? null,
      supersedes: version.supersedes ?? null,
      changeNote: version.changeNote ?? null,
      sourceUrl: version.sourceUrl ?? null,
      sourceSha256: version.sourceSha256 ?? null,
      capturedAt: version.capturedAt ?? null,
    })),
  },
  replayDiff: {
    status: replayDiff.status,
    actionTypes: replayActions,
    lineageReadWasNonMutating: true,
  },
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(evidence, null, 2));
