import { BASE_URL } from '@/constants/api';
import type { ApiChatMessage, ApiConversation } from '@/types/api-chat';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof (data as { message?: string })?.message === 'string'
      ? (data as { message: string }).message
      : 'Помилка запиту до чату';
    throw new Error(message);
  }
  return data as T;
}

export async function fetchConversations(): Promise<ApiConversation[]> {
  const response = await fetchWithAuth(`${BASE_URL}/chat/conversations`);
  const data = await parseJson<ApiConversation[]>(response);
  return Array.isArray(data) ? data : [];
}

export async function getOrCreateConversation(participantId: number): Promise<ApiConversation> {
  const response = await fetchWithAuth(`${BASE_URL}/chat/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId }),
  });
  return parseJson<ApiConversation>(response);
}

export async function fetchConversationMessages(
  conversationId: number,
  take = 50,
  cursorId?: number,
): Promise<ApiChatMessage[]> {
  const params = new URLSearchParams({ take: String(take) });
  if (cursorId) params.set('cursorId', String(cursorId));

  const response = await fetchWithAuth(
    `${BASE_URL}/chat/conversations/${conversationId}/messages?${params.toString()}`,
  );
  const data = await parseJson<ApiChatMessage[]>(response);
  return Array.isArray(data) ? data : [];
}

export async function sendChatMessage(params: {
  conversationId: number;
  text: string;
}): Promise<ApiChatMessage> {
  const response = await fetchWithAuth(`${BASE_URL}/chat/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return parseJson<ApiChatMessage>(response);
}

export async function markConversationRead(conversationId: number): Promise<void> {
  const response = await fetchWithAuth(`${BASE_URL}/chat/conversations/${conversationId}/read`, {
    method: 'PATCH',
  });
  await parseJson(response);
}

export async function findConversationById(
  conversationId: number,
): Promise<ApiConversation | null> {
  const conversations = await fetchConversations();
  return conversations.find((c) => c.id === conversationId) ?? null;
}
