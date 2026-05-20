import { router } from 'expo-router';
import { getOrCreateConversation } from '@/utils/chatApi';

export async function openChatWithParticipant(participantId: number): Promise<void> {
  const conversation = await getOrCreateConversation(participantId);
  router.push({
    pathname: '/chat/[conversationId]',
    params: { conversationId: String(conversation.id) },
  });
}
