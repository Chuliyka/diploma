import { BASE_URL } from '@/constants/api';
import type { ApiChatMessage, ApiConversation, ApiChatUser } from '@/types/api-chat';
import type { ChatPreviewDto } from '@/types/chats';
import type { ChatMessageDto, ChatThreadHeaderDto, ChatThreadListEntry } from '@/types/chat-thread';

function photoUrlToAbsolute(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('http')) return photoUrl;
  return `${BASE_URL}${photoUrl}`;
}

export function activityEmojiFromStatus(status: string | null | undefined): string {
  if (!status?.trim()) return '🛍️';
  const match = status.trim().match(/^(\p{Extended_Pictographic})/u);
  return match?.[1] ?? '🛍️';
}

function formatPresenceLabel(user: ApiChatUser): { relative: string; body: string } {
  if (user.isOnline) {
    return { relative: 'Онлайн', body: user.status?.trim() ?? '' };
  }

  if (user.lastSeenAt) {
    const seen = new Date(user.lastSeenAt);
    if (!Number.isNaN(seen.getTime())) {
      const diffMin = Math.floor((Date.now() - seen.getTime()) / 60000);
      if (diffMin < 60) {
        return { relative: `${diffMin} хв тому`, body: user.status?.trim() ?? '' };
      }
    }
  }

  return { relative: '', body: user.status?.trim() ?? '' };
}

export function getPeerFromConversation(
  conversation: ApiConversation,
  currentUserId: number,
): ApiChatUser | null {
  const peer = conversation.participants.find((p) => p.userId !== currentUserId);
  return peer?.user ?? null;
}

export function mapConversationToPreview(
  conversation: ApiConversation,
  currentUserId: number,
): ChatPreviewDto | null {
  const peer = getPeerFromConversation(conversation, currentUserId);
  if (!peer) return null;

  const last = conversation.messages[0];
  const presence = formatPresenceLabel(peer);

  return {
    id: conversation.id,
    participantId: peer.id,
    participantName: peer.name?.trim() || 'Користувач',
    participantAvatarUrl: photoUrlToAbsolute(peer.photoUrl),
    lastMessageText: last?.text ?? '',
    lastMessageAt: conversation.lastMessageAt ?? last?.createdAt ?? conversation.updatedAt,
    unreadCount: conversation._count?.messages ?? 0,
    activityStatusEmoji: activityEmojiFromStatus(peer.status),
    threadStatusRelativeLabel: presence.relative,
    threadStatusBody: presence.body,
  };
}

export function mapConversationToThreadHeader(
  conversation: ApiConversation,
  currentUserId: number,
): ChatThreadHeaderDto | null {
  const peer = getPeerFromConversation(conversation, currentUserId);
  if (!peer) return null;

  const presence = formatPresenceLabel(peer);

  return {
    conversationId: String(conversation.id),
    participantId: String(peer.id),
    participantDisplayName: peer.name?.trim() || 'Користувач',
    participantAvatarUrl: photoUrlToAbsolute(peer.photoUrl),
    activityStatusEmoji: activityEmojiFromStatus(peer.status),
    threadStatusRelativeLabel: presence.relative,
    threadStatusBody: presence.body,
  };
}

function formatTimestampLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const time = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Сьогодні ${time}`;
  return date.toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function mapApiMessageToDto(message: ApiChatMessage, currentUserId: number): ChatMessageDto {
  return {
    id: String(message.id),
    conversationId: String(message.conversationId),
    authorParticipantId: String(message.senderId),
    body: message.text,
    createdAt: message.createdAt,
  };
}

export function mapMessagesToThreadEntries(
  messages: ApiChatMessage[],
  currentUserId: number,
): ChatThreadListEntry[] {
  const chronological = [...messages].reverse();
  const entries: ChatThreadListEntry[] = [];
  let lastDayKey = '';

  chronological.forEach((message, index) => {
    const date = new Date(message.createdAt);
    const dayKey = Number.isNaN(date.getTime())
      ? ''
      : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    if (dayKey && dayKey !== lastDayKey) {
      const label = formatTimestampLabel(message.createdAt);
      if (label) {
        entries.push({ kind: 'timestamp', id: `ts-${dayKey}`, label });
      }
      lastDayKey = dayKey;
    }

    const dto = mapApiMessageToDto(message, currentUserId);
    const prev = chronological[index - 1];
    const showAvatar =
      message.senderId !== currentUserId &&
      (!prev || prev.senderId !== message.senderId);

    entries.push({
      kind: 'message',
      message: { ...dto, showAvatar },
    });
  });

  return entries;
}
