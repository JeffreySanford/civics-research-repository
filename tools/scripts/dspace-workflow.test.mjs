import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
