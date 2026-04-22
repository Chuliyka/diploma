import { BASE_URL } from '../constants/api';

export async function updatePresence(phoneNumber: string, isOnline: boolean): Promise<void> {
  if (!phoneNumber) return;

  try {
    await fetch(
      `${BASE_URL}/users/by-phone/status?phoneNumber=${encodeURIComponent(phoneNumber)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline }),
      },
    );
  } catch (error) {
    console.warn('[Presence] Failed to update presence', error);
  }
}
