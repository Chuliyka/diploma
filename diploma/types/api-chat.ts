export type ApiChatUser = {
  id: number;
  name: string | null;
  photoUrl: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  status?: string | null;
};

export type ApiChatParticipant = {
  conversationId: number;
  userId: number;
  lastReadAt: string | null;
  user: ApiChatUser;
};

export type ApiChatMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  text: string;
  createdAt: string;
  readAt: string | null;
  sender: ApiChatUser;
};

export type ApiConversation = {
  id: number;
  directKey: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  participants: ApiChatParticipant[];
  messages: ApiChatMessage[];
  _count: { messages: number };
};
