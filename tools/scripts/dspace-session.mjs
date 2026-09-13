function responseCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const combined = response.headers.get('set-cookie');
  return combined ? [combined] : [];
}

export function dspaceSessionCookie(response) {
  for (const value of responseCookies(response)) {
    const direct = value.trim().split(';', 1)[0];
    if (direct.startsWith('DSPACE-XSRF-COOKIE=')) {
      return direct;
    }

    const combined = value.match(/(?:^|,\s*)(DSPACE-XSRF-COOKIE=[^;,\s]+)/);
    if (combined?.[1]) {
      return combined[1];
    }
  }
  return undefined;
}

export function refreshDspaceSession(session, response) {
  const csrfToken = response.headers.get('DSPACE-XSRF-TOKEN');
  const cookie = dspaceSessionCookie(response);
  if (csrfToken) {
    session.csrfToken = csrfToken;
  }
  if (cookie) {
    session.cookie = cookie;
  }
  return session;
}
