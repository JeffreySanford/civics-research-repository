const workflowRolesByAction = new Map([
  ['reviewaction', 'reviewer'],
  ['editaction', 'editor'],
  ['finaleditaction', 'finaleditor'],
]);

const approvalActions = new Set(workflowRolesByAction.keys());

export function firstWorkflowTask(json, relation) {
  return json?._embedded?.[relation]?.[0] ?? null;
}

export function workflowApprovalBody(action) {
  if (!approvalActions.has(action)) {
    throw new Error(`Unsupported DSpace workflow action: ${action ?? 'absent'}`);
  }
  return new URLSearchParams({ submit_approve: 'true' }).toString();
}

export function workflowRoleForAction(action) {
  const role = workflowRolesByAction.get(action);
  if (!role) {
    throw new Error(`Unsupported DSpace workflow action: ${action ?? 'absent'}`);
  }
  return role;
}

function requireWorkflow(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function embedded(json, relation) {
  return json?._embedded?.[relation] ?? [];
}

export async function advanceDspaceWorkflow({
  dspace,
  session,
  itemUuid,
  adminEmail,
  dspaceBaseUrl,
  maxSteps = 6,
}) {
  const epersonResult = await dspace(
    `/api/eperson/epersons/search/byEmail?email=${encodeURIComponent(adminEmail)}`,
    session,
    {},
    [200, 204],
  );
  const eperson = epersonResult.json;
  requireWorkflow(
    epersonResult.response.status === 200 && eperson?.uuid,
    `Could not resolve the authenticated DSpace EPerson ${adminEmail}.`,
  );

  const epersonHref =
    eperson?._links?.self?.href ??
    `${dspaceBaseUrl}/api/eperson/epersons/${eperson.uuid}`;
  const transitions = [];

  for (let index = 0; index < maxSteps; index += 1) {
    const itemResult = await dspace(
      `/api/core/items/${encodeURIComponent(itemUuid)}`,
      session,
      {},
      [200, 404],
    );
    if (
      itemResult.response.status === 200 &&
      itemResult.json?.inArchive === true
    ) {
      return transitions;
    }

    const poolResult = await dspace(
      `/api/workflow/pooltasks/search/findAllByItem?uuid=${encodeURIComponent(itemUuid)}&size=100`,
      session,
    );
    const poolTask = firstWorkflowTask(poolResult.json, 'pooltasks');
    requireWorkflow(
      poolTask?.id != null,
      `DSpace workflow item ${itemUuid} is not archived and exposes no pooled task.`,
    );

    const action = poolTask.action;
    const workflowRole = workflowRoleForAction(action);
    const workflowItemResult = await dspace(
      `/api/workflow/workflowitems/search/item?uuid=${encodeURIComponent(itemUuid)}`,
      session,
      {},
      [200, 204],
    );
    const workflowItem = workflowItemResult.json;
    requireWorkflow(
      workflowItemResult.response.status === 200 && workflowItem?.id != null,
      `DSpace item ${itemUuid} did not resolve its WorkflowItem.`,
    );
    const collectionHref = workflowItem?._links?.collection?.href;
    requireWorkflow(
      collectionHref,
      `DSpace WorkflowItem ${workflowItem.id} does not expose its collection.`,
    );

    const groupResult = await dspace(
      `${collectionHref}/workflowGroups/${encodeURIComponent(workflowRole)}`,
      session,
      {},
      [200, 204],
    );
    requireWorkflow(
      groupResult.response.status === 200 && groupResult.json?.uuid,
      `DSpace workflow role ${workflowRole} for pooled task ${poolTask.id} did not resolve its collection group.`,
    );
    const group = groupResult.json;
    const membersHref = group?._links?.epersons?.href;
    requireWorkflow(
      membersHref,
      `DSpace workflow group ${group.uuid} does not expose its EPerson membership link.`,
    );

    const membersResult = await dspace(`${membersHref}?size=100`, session);
    const isMember = embedded(membersResult.json, 'epersons').some(
      (member) => member?.uuid === eperson.uuid,
    );
    if (!isMember) {
      await dspace(
        membersHref,
        session,
        {
          method: 'POST',
          headers: { 'content-type': 'text/uri-list' },
          body: epersonHref,
        },
        [204],
      );
    }

    const poolTaskHref =
      poolTask?._links?.self?.href ??
      `${dspaceBaseUrl}/api/workflow/pooltasks/${poolTask.id}`;
    const claimedResult = await dspace(
      '/api/workflow/claimedtasks',
      session,
      {
        method: 'POST',
        headers: { 'content-type': 'text/uri-list' },
        body: poolTaskHref,
      },
      [201],
    );
    const claimedTask = claimedResult.json;
    requireWorkflow(
      claimedTask?.id != null,
      `DSpace did not return a claimed task for pooled task ${poolTask.id}.`,
    );
    requireWorkflow(
      claimedTask.action === action,
      `DSpace claimed task ${claimedTask.id} changed action from ${action} to ${claimedTask.action ?? 'absent'}.`,
    );

    const claimedTaskHref =
      claimedTask?._links?.self?.href ??
      `${dspaceBaseUrl}/api/workflow/claimedtasks/${claimedTask.id}`;
    await dspace(
      claimedTaskHref,
      session,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: workflowApprovalBody(action),
      },
      [204],
    );

    transitions.push({
      poolTaskId: String(poolTask.id),
      claimedTaskId: String(claimedTask.id),
      groupId: String(group.uuid),
      action,
      addedCiReviewer: !isMember,
    });
  }

  throw new Error(
    `DSpace workflow item ${itemUuid} exceeded ${maxSteps} supported approval steps without archiving.`,
  );
}
