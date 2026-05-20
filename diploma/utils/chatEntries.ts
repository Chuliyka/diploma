import type { ChatMessageDto, ChatThreadListEntry } from '@/types/chat-thread';

export function mergeMessageIntoEntries(
  entries: ChatThreadListEntry[],
  message: ChatMessageDto,
  replaceMessageId?: string,
): ChatThreadListEntry[] {
  let next = entries;

  if (replaceMessageId) {
    next = next.filter(
      (entry) => !(entry.kind === 'message' && entry.message.id === replaceMessageId),
    );
  }

  if (next.some((entry) => entry.kind === 'message' && entry.message.id === message.id)) {
    return next;
  }

  return [...next, { kind: 'message', message }];
}
