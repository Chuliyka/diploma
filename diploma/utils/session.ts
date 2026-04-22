import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'user_phone';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export async function saveSession(phoneNumber: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, phoneNumber);
  console.log('[Session] Saved phone:', phoneNumber);
}

export async function getSession(): Promise<string | null> {
  const phone = await SecureStore.getItemAsync(SESSION_KEY);
  console.log('[Session] Loaded phone:', phone);
  return phone;
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEY),
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
  console.log('[Session] Cleared');
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
  console.log('[Session] Tokens saved');
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}
