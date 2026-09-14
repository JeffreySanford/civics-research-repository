import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceDspaceWorkflow,
  firstWorkflowTask,
  workflowApprovalBody,
} from './dspace-workflow.mjs';

test('builds approve command for standard DSpace review actions', () => {
  for (const action of ['reviewaction', 'editaction', 'finaleditaction']) {
    assert.equal(workflowApprovalBody(action), 'submit_approve=true');
  }
});

test('rejects unsupported DSpace workflow actions', () => {
  assert.throws(
    () => workflowApprovalBody('scorereviewaction'),
    /Unsupported DSpace workflow action/,
  );
});

test('reads first task from a DSpace HAL task search', () => {
  assert.deepEqual(
    firstWorkflowTask({ _embedded: { pooltasks: [{ id: 7 }] } }, 'pooltasks'),
    { id: 7 },
  );
  assert.equal(firstWorkflowTask({}, 'pooltasks'), null);
});

test('returns no approval transitions when DSpace archives immediately', async () => {
  const calls = [];
  const dspace = async (path) => {
    calls.push(path);
    if (path.startsWith('/api/eperson/epersons/search/byEmail')) {
      return {
        response: { status: 200 },
        json: { uuid: 'person-1' },
      };
    }
    if (path === '/api/core/items/item-1') {
      return {
        response: { status: 200 },
        json: { inArchive: true },
      };
    }
    throw new Error(`Unexpected DSpace call: ${path}`);
  };

  const transitions = await advanceDspaceWorkflow({
    dspace,
    session: {},
    itemUuid: 'item-1',
    adminEmail: 'admin@example.test',
    dspaceBaseUrl: 'http://dspace',
  });

  assert.deepEqual(transitions, []);
  assert.equal(
    calls.some((path) => path.includes('/api/workflow/pooltasks/')),
    false,
  );
});

test('resolves the default workflow role through the workflow item collection before claiming', async () => {
  const calls = [];
  let itemReads = 0;
  const dspace = async (path, _session, init = {}, accepted = [200]) => {
    calls.push({ path, init, accepted });

    if (path.startsWith('/api/eperson/epersons/search/byEmail')) {
      return {
        response: { status: 200 },
        json: {
          uuid: 'person-1',
          _links: {
            self: {
              href: 'http://dspace/api/eperson/epersons/person-1',
            },
          },
        },
      };
    }
    if (path === '/api/core/items/item-1') {
      itemReads += 1;
      return {
        response: { status: 200 },
        json: { inArchive: itemReads > 1 },
      };
    }
    if (path.startsWith('/api/workflow/pooltasks/search/findAllByItem')) {
      return {
        response: { status: 200 },
        json: {
          _embedded: {
            pooltasks: [
              {
                id: 7,
                action: 'reviewaction',
                _links: {
                  self: {
                    href: 'http://dspace/api/workflow/pooltasks/7',
                  },
                },
              },
            ],
          },
        },
      };
    }
    if (path.startsWith('/api/workflow/workflowitems/search/item')) {
      return {
        response: { status: 200 },
        json: {
          id: 11,
          _links: {
            collection: {
              href: 'http://dspace/api/core/collections/collection-1',
            },
          },
        },
      };
    }
    if (
      path ===
      'http://dspace/api/core/collections/collection-1/workflowGroups/reviewer'
    ) {
      return {
        response: { status: 200 },
        json: {
          uuid: 'group-1',
          _links: {
            epersons: {
              href: 'http://dspace/api/eperson/groups/group-1/epersons',
            },
          },
        },
      };
    }
    if (path === 'http://dspace/api/eperson/groups/group-1/epersons?size=100') {
      return {
        response: { status: 200 },
        json: { _embedded: { epersons: [] } },
      };
    }
    if (
      path === 'http://dspace/api/eperson/groups/group-1/epersons' &&
      init.method === 'POST'
    ) {
      return { response: { status: 204 }, json: null };
    }
    if (path === '/api/workflow/claimedtasks' && init.method === 'POST') {
      return {
        response: { status: 201 },
        json: {
          id: 8,
          action: 'reviewaction',
          _links: {
            self: {
              href: 'http://dspace/api/workflow/claimedtasks/8',
            },
          },
        },
      };
    }
    if (
      path === 'http://dspace/api/workflow/claimedtasks/8' &&
      init.method === 'POST'
    ) {
      return { response: { status: 204 }, json: null };
    }

    throw new Error(`Unexpected DSpace call: ${init.method ?? 'GET'} ${path}`);
  };

  const transitions = await advanceDspaceWorkflow({
    dspace,
    session: {},
    itemUuid: 'item-1',
    adminEmail: 'admin@example.test',
    dspaceBaseUrl: 'http://dspace',
  });

  assert.deepEqual(transitions, [
    {
      poolTaskId: '7',
      claimedTaskId: '8',
      groupId: 'group-1',
      action: 'reviewaction',
      addedCiReviewer: true,
    },
  ]);
  assert.ok(
    calls.some(
      ({ path }) =>
        path ===
        'http://dspace/api/core/collections/collection-1/workflowGroups/reviewer',
    ),
  );
});
