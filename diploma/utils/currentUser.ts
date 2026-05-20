import { decodeJwtPayload } from '@/utils/jwt';
import { getAccessToken } from '@/utils/session';

export async function getCurrentUserId(): Promise<number | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const payload = decodeJwtPayload<{ sub?: number }>(token);
  const id = payload?.sub;
  return typeof id === 'number' && Number.isFinite(id) ? id : null;
}
