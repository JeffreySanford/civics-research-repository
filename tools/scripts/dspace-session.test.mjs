import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshDspaceSession } from './dspace-session.mjs';

function responseWith({ csrfToken, cookies = [] } = {}) {
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === 'dspace-xsrf-token'
          ? csrfToken ?? null
          : null;
      },
      getSetCookie() {
        return cookies;
      },
    },
  };
}

test('refreshes the DSpace CSRF token and matching cookie from every response', () => {
  const session = {
    authorization: 'Bearer test',
    csrfToken: 'login-token',
    cookie: 'DSPACE-XSRF-COOKIE=login-token',
  };

  refreshDspaceSession(
    session,
    responseWith({
      csrfToken: 'rotated-token',
      cookies: [
        'DSPACE-XSRF-COOKIE=rotated-token; Path=/server; SameSite=Lax',
      ],
    }),
  );

  assert.equal(session.csrfToken, 'rotated-token');
  assert.equal(session.cookie, 'DSPACE-XSRF-COOKIE=rotated-token');
});

test('retains prior DSpace session fields when a response does not rotate them', () => {
  const session = {
    authorization: 'Bearer test',
    csrfToken: 'current-token',
    cookie: 'DSPACE-XSRF-COOKIE=current-token',
  };

  refreshDspaceSession(session, responseWith());

  assert.equal(session.csrfToken, 'current-token');
  assert.equal(session.cookie, 'DSPACE-XSRF-COOKIE=current-token');
});
