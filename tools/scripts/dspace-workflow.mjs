const approvalActions = new Set([
  'reviewaction',
  'editaction',
  'finaleditaction',
]);

export function firstWorkflowTask(json, relation) {
  return json?._embedded?.[relation]?.[0] ?? null;
}

export function workflowApprovalBody(action) {
  if (!approvalActions.has(action)) {
    throw new Error(`Unsupported DSpace workflow action: ${action ?? 'absent'}`);
  }
  return new URLSearchParams({ submit_approve: 'true' }).toString();
}
