import assert from 'node:assert/strict';
import test from 'node:test';
import {
  refreshDspaceSession,
  requestWithDspaceCsrfRetry,
} from './dspace-session.mjs';

function responseWith({ csrfToken, cookies = [] } = {}) {
  return {
    headers: {
      get(name) {
        if (name.toLowerCase() === 'dspace-xsrf-token') {
          return csrfToken ?? null;
        }
        return null;
      },
      getSetCookie() {
        return cookies;
      },
    },
  };
}

function httpResponse(status, body = '', { csrfToken, cookie } = {}) {
  return new Response(body, {
    status,
    headers: {
      ...(csrfToken ? { 'DSPACE-XSRF-TOKEN': csrfToken } : {}),
      ...(cookie
        ? { 'set-cookie': `DSPACE-XSRF-COOKIE=${cookie}; Path=/server` }
        : {}),
    },
  });
}

test('refreshes DSpace CSRF token and cookie', () => {
  const session = {
    authorization: 'Bearer test',
    csrfToken: 'login-token',
    cookie: 'DSPACE-XSRF-COOKIE=login-token',
  };

  refreshDspaceSession(
    session,
    responseWith({
      csrfToken: 'rotated-token',
      cookies: ['DSPACE-XSRF-COOKIE=rotated-token; Path=/server'],
    }),
  );

  assert.equal(session.csrfToken, 'rotated-token');
  assert.equal(session.cookie, 'DSPACE-XSRF-COOKIE=rotated-token');
});

test('retains DSpace session fields without rotation', () => {
  const session = {
    authorization: 'Bearer test',
    csrfToken: 'current-token',
    cookie: 'DSPACE-XSRF-COOKIE=current-token',
  };

  refreshDspaceSession(session, responseWith());

  assert.equal(session.csrfToken, 'current-token');
  assert.equal(session.cookie, 'DSPACE-XSRF-COOKIE=current-token');
});

test('refreshes a stale DSpace CSRF session once and retries the request', async () => {
  const session = {
    authorization: 'Bearer original',
    csrfToken: 'stale',
    cookie: 'DSPACE-XSRF-COOKIE=stale',
  };
  let attempts = 0;
  let refreshes = 0;
  const seenTokens = [];

  const result = await requestWithDspaceCsrfRetry({
    session,
    request: async () => {
      attempts += 1;
      seenTokens.push(session.csrfToken);
      return attempts === 1
        ? httpResponse(403, 'Invalid CSRF token')
        : httpResponse(201, '{"id":102}');
    },
    refreshSession: async () => {
      refreshes += 1;
      Object.assign(session, {
        authorization: 'Bearer refreshed',
        csrfToken: 'fresh',
        cookie: 'DSPACE-XSRF-COOKIE=fresh',
      });
    },
  });

  assert.equal(result.status, 201);
  assert.equal(attempts, 2);
  assert.equal(refreshes, 1);
  assert.deepEqual(seenTokens, ['stale', 'fresh']);
});

test('does not retry an unrelated DSpace 403', async () => {
  const session = {
    authorization: 'Bearer original',
    csrfToken: 'current',
    cookie: 'DSPACE-XSRF-COOKIE=current',
  };
  let attempts = 0;
  let refreshes = 0;

  const result = await requestWithDspaceCsrfRetry({
    session,
    request: async () => {
      attempts += 1;
      return httpResponse(403, 'Access denied');
    },
    refreshSession: async () => {
      refreshes += 1;
    },
  });

  assert.equal(result.status, 403);
  assert.equal(attempts, 1);
  assert.equal(refreshes, 0);
});

test('retries an invalid CSRF failure only once', async () => {
  const session = {
    authorization: 'Bearer original',
    csrfToken: 'stale',
    cookie: 'DSPACE-XSRF-COOKIE=stale',
  };
  let attempts = 0;
  let refreshes = 0;

  const result = await requestWithDspaceCsrfRetry({
    session,
    request: async () => {
      attempts += 1;
      return httpResponse(403, 'Invalid CSRF token');
    },
    refreshSession: async () => {
      refreshes += 1;
      session.csrfToken = 'fresh';
      session.cookie = 'DSPACE-XSRF-COOKIE=fresh';
    },
  });

  assert.equal(result.status, 403);
  assert.equal(attempts, 2);
  assert.equal(refreshes, 1);
});
