import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshDspaceSession } from './dspace-session.mjs';

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
