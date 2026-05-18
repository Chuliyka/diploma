import { BASE_URL } from '../constants/api';
import { clearSession, getAccessToken, getRefreshToken, saveTokens } from './session';
import { router } from 'expo-router';

const NGROK_SKIP_HEADER = 'ngrok-skip-browser-warning';

function isFormDataBody(body: RequestInit['body']) {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function buildHeaders(init: RequestInit, token: string | null): HeadersInit {
  if (isFormDataBody(init.body)) {
    return {
      [NGROK_SKIP_HEADER]: 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  return {
    [NGROK_SKIP_HEADER]: 'true',
    ...(init.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  console.log('[fetchWithAuth] Access token expired — attempting refresh...');
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [NGROK_SKIP_HEADER]: 'true',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    console.warn('[fetchWithAuth] Refresh failed — logging out');
    await clearSession();
    router.replace('/');
    return null;
  }

  const data = await res.json();
  await saveTokens(data.accessToken, data.refreshToken);
  console.log('[fetchWithAuth] Tokens refreshed successfully');
  return data.accessToken;
}

export async function fetchWithAuth(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  let accessToken = await getAccessToken();

  const makeRequest = (token: string | null) =>
    fetch(input, {
      ...init,
      headers: buildHeaders(init, token),
    });

  let response = await makeRequest(accessToken);

  if (response.status === 401) {
    const newToken = await tryRefresh();
    if (newToken) {
      response = await makeRequest(newToken);
    } else {
      console.warn('[fetchWithAuth] Unauthorized and no valid refresh token — clearing session');
      await clearSession();
      router.replace('/');
    }
  }

  return response;
}
