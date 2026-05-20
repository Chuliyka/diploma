import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { BASE_URL } from '@/constants/api';
import type { ApiChatMessage } from '@/types/api-chat';
import {
  fetchConversationMessages,
  findConversationById,
  getOrCreateConversation,
  markConversationRead,
  sendChatMessage,
} from '@/utils/chatApi';
import {
  mapApiMessageToDto,
  mapConversationToThreadHeader,
  mapMessagesToThreadEntries,
} from '@/utils/chatMappers';
import { getCurrentUserId } from '@/utils/currentUser';
import { getAccessToken } from '@/utils/session';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  isOutgoingMessage,
  type ChatMessageDto,
  type ChatThreadHeaderDto,
  type ChatThreadListEntry,
  type ChatThreadPayload,
} from '@/types/chat-thread';

function createOptimisticOutgoingMessage(
  conversationId: string,
  authorParticipantId: string,
  body: string,
): ChatMessageDto {
  return {
    id: `local-${Date.now()}`,
    conversationId,
    authorParticipantId,
    body,
    createdAt: new Date().toISOString(),
  };
}

const ACTIVE_RING = '#D9B5F5';
const SCREEN_BG = '#F5EFFB';

export default function ChatConversationScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ conversationId?: string; participantId?: string }>();
  const rawId = params.conversationId;
  const rawParticipantId = params.participantId;
  const conversationId = Array.isArray(rawId) ? rawId[0] : rawId ?? '';
  const participantIdParam = Array.isArray(rawParticipantId) ? rawParticipantId[0] : rawParticipantId;

  const [thread, setThread] = useState<ChatThreadPayload | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [extraEntries, setExtraEntries] = useState<ChatThreadListEntry[]>([]);
  const listRef = useRef<FlatList<ChatThreadListEntry>>(null);

  const localAuthorId = currentUserId !== null ? String(currentUserId) : '';

  const entries = useMemo(() => {
    if (!thread) return [];
    return [...thread.entries, ...extraEntries];
  }, [thread, extraEntries]);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setExtraEntries([]);

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('Увійдіть у акаунт');
      }
      setCurrentUserId(userId);

      let resolvedConversationId = Number(conversationId);
      if (!Number.isInteger(resolvedConversationId) || resolvedConversationId <= 0) {
        const participantId = Number(participantIdParam);
        if (!Number.isInteger(participantId) || participantId <= 0) {
          throw new Error('Невірний ідентифікатор чату');
        }
        const created = await getOrCreateConversation(participantId);
        resolvedConversationId = created.id;
      }

      const [conversation, messages] = await Promise.all([
        findConversationById(resolvedConversationId),
        fetchConversationMessages(resolvedConversationId),
      ]);

      if (!conversation) {
        throw new Error('Діалог не знайдено');
      }

      const header = mapConversationToThreadHeader(conversation, userId);
      if (!header) {
        throw new Error('Не вдалося завантажити учасників чату');
      }

      setThread({
        header,
        entries: mapMessagesToThreadEntries(messages, userId),
      });

      await markConversationRead(resolvedConversationId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Не вдалося завантажити чат';
      setLoadError(message);
      setThread(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId, participantIdParam]);

  useFocusEffect(
    useCallback(() => {
      void loadThread();
    }, [loadThread]),
  );

  useEffect(() => {
    const numericId = Number(thread?.header.conversationId ?? conversationId);
    if (!Number.isInteger(numericId) || numericId <= 0) return;

    let socket: Socket | null = null;
    let disposed = false;

    const connect = async () => {
      if (disposed) return;
      const token = await getAccessToken();
      if (!token) return;

      socket = io(`${BASE_URL}/chat`, {
        transports: ['websocket'],
        auth: { token },
      });

      socket.on('connect', () => {
        socket?.emit('conversation:join', { conversationId: numericId });
      });

      socket.on('message:new', (payload: ApiChatMessage) => {
        if (payload.conversationId !== numericId) return;
        void getCurrentUserId().then((userId) => {
          if (!userId) return;
          const dto = mapApiMessageToDto(payload, userId);
          setExtraEntries((prev) => {
            if (prev.some((e) => e.kind === 'message' && e.message.id === dto.id)) return prev;
            if (thread?.entries.some((e) => e.kind === 'message' && e.message.id === dto.id)) {
              return prev;
            }
            return [...prev, { kind: 'message', message: dto }];
          });
          if (payload.senderId !== userId) {
            void markConversationRead(numericId);
          }
        });
      });
    };

    void connect();

    return () => {
      disposed = true;
      socket?.disconnect();
    };
  }, [thread?.header.conversationId, conversationId]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/chats');
  }, []);

  const onChatOptionsPress = useCallback(() => {
  }, []);

  const onSendLocationPress = useCallback(() => {
  }, []);

  const onSubmitDraft = useCallback(async () => {
    if (!thread || !draft.trim() || sending) return;

    const text = draft.trim();
    const conversationNumericId = Number(thread.header.conversationId);
    if (!Number.isInteger(conversationNumericId)) return;

    const optimistic = createOptimisticOutgoingMessage(
      thread.header.conversationId,
      localAuthorId,
      text,
    );
    setExtraEntries((prev) => [...prev, { kind: 'message', message: optimistic }]);
    setDraft('');
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    setSending(true);

    try {
      const saved = await sendChatMessage({ conversationId: conversationNumericId, text });
      const userId = currentUserId ?? (await getCurrentUserId());
      if (!userId) return;

      const dto = mapApiMessageToDto(saved, userId);
      setExtraEntries((prev) =>
        prev.map((entry) =>
          entry.kind === 'message' && entry.message.id === optimistic.id
            ? { kind: 'message', message: dto }
            : entry,
        ),
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Не вдалося надіслати повідомлення';
      Alert.alert('Помилка', message);
      setExtraEntries((prev) =>
        prev.filter((entry) => !(entry.kind === 'message' && entry.message.id === optimistic.id)),
      );
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [conversationId, currentUserId, draft, localAuthorId, sending, thread]);

  const isDraftEmpty = draft.trim().length === 0;

  if (loading) {
    return (
      <View style={[styles.notFoundRoot, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator size="large" color="#9D8DF1" />
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={[styles.notFoundRoot, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.notFoundTitle}>{loadError ?? 'Чат не знайдено'}</Text>
        <Pressable onPress={handleBack} style={styles.notFoundBtn}>
          <Text style={styles.notFoundBtnText}>Назад до списку</Text>
        </Pressable>
      </View>
    );
  }

  const { header } = thread;
  const hasMessages = entries.length > 0;
  const showStatus = Boolean(header.threadStatusRelativeLabel || header.threadStatusBody);

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ChatHeader
          header={header}
          topInset={insets.top}
          onBack={handleBack}
          onOptionsPress={onChatOptionsPress}
          showStatus={showStatus}
        />

        <FlatList
          ref={listRef}
          data={entries}
          keyExtractor={(item) => (item.kind === 'timestamp' ? item.id : item.message.id)}
          renderItem={({ item }) => (
            <ThreadEntry item={item} header={header} localAuthorId={localAuthorId} />
          )}
          contentContainerStyle={[
            styles.listContent,
            !hasMessages && styles.listContentEmpty,
            { paddingBottom: 16 },
          ]}
          ListEmptyComponent={
            hasMessages ? null : (
              <Text style={styles.emptyStateText}>У вас ще немає повідомлень</Text>
            )
          }
          onContentSizeChange={() => {
            if (hasMessages) listRef.current?.scrollToEnd({ animated: false });
          }}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Надіслати повідомлення"
              placeholderTextColor="#7C8B98"
              style={styles.textInput}
              multiline={false}
              maxLength={4000}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => void onSubmitDraft()}
              editable={!sending}
            />
            <Pressable
              onPress={isDraftEmpty ? onSendLocationPress : () => void onSubmitDraft()}
              style={styles.inputIconBtn}
              hitSlop={10}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={isDraftEmpty ? 'Надіслати локацію' : 'Надіслати повідомлення'}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : isDraftEmpty ? (
                <MaterialCommunityIcons name="map-marker-outline" size={22} color="#FFFFFF" />
              ) : (
                <Ionicons name="paper-plane" size={20} color="#FFFFFF" marginRight={2} marginTop={2} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ChatHeader({
  header,
  topInset,
  onBack,
  onOptionsPress,
  showStatus,
}: {
  header: ChatThreadHeaderDto;
  topInset: number;
  onBack: () => void;
  onOptionsPress: () => void;
  showStatus: boolean;
}) {
  return (
    <View style={[styles.headerBlock, { paddingTop: topInset }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} style={styles.headerIconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#19395A" />
        </Pressable>

        <View style={styles.headerAvatarRing}>
          {header.participantAvatarUrl ? (
            <Image source={{ uri: header.participantAvatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Ionicons name="person" size={22} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.headerActivityBadge}>
            <Text style={styles.headerActivityEmoji}>{header.activityStatusEmoji}</Text>
          </View>
        </View>

        <View style={styles.headerTextBlock}>
          <Text style={styles.headerName} numberOfLines={1}>
            {header.participantDisplayName}
          </Text>
          {showStatus ? (
            <Text style={styles.headerStatus} numberOfLines={2}>
              <Text style={styles.headerStatusPrefix}>{header.threadStatusRelativeLabel}</Text>
              <Text style={styles.headerStatusBody}> {header.threadStatusBody}</Text>
            </Text>
          ) : null}
        </View>

        <Pressable onPress={onOptionsPress} style={styles.headerIconBtn} hitSlop={12}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color="#19395A" />
        </Pressable>
      </View>
      <View style={styles.headerDivider} />
    </View>
  );
}

function ThreadEntry({
  item,
  header,
  localAuthorId,
}: {
  item: ChatThreadListEntry;
  header: ChatThreadHeaderDto;
  localAuthorId: string;
}) {
  if (item.kind === 'timestamp') {
    return (
      <View style={styles.timestampWrap}>
        <Text style={styles.timestampText}>{item.label}</Text>
      </View>
    );
  }
  return (
    <MessageBubble
      message={item.message}
      peerAvatarUrl={header.participantAvatarUrl}
      localAuthorId={localAuthorId}
    />
  );
}

function MessageBubble({
  message,
  peerAvatarUrl,
  localAuthorId,
}: {
  message: ChatMessageDto;
  peerAvatarUrl: string | null;
  localAuthorId: string;
}) {
  const outgoing = isOutgoingMessage(message, localAuthorId);

  if (outgoing) {
    return (
      <View style={styles.msgRowOutgoing}>
        <View style={styles.bubbleOutgoing}>
          <Text style={styles.bubbleTextOutgoing}>{message.body}</Text>
        </View>
      </View>
    );
  }

  const showAvatar = message.showAvatar === true;

  return (
    <View style={styles.msgRowIncoming}>
      <View style={styles.avatarColumn}>
        {showAvatar ? (
          peerAvatarUrl ? (
            <Image source={{ uri: peerAvatarUrl }} style={styles.msgAvatar} />
          ) : (
            <View style={[styles.msgAvatar, styles.msgAvatarFallback]}>
              <Ionicons name="person" size={14} color="#FFFFFF" />
            </View>
          )
        ) : (
          <View style={styles.msgAvatarSpacer} />
        )}
      </View>
      <View style={styles.bubbleIncoming}>
        <Text style={styles.bubbleTextIncoming}>{message.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  flex: {
    flex: 1,
  },
  notFoundRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  notFoundTitle: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '600',
    color: '#19395A',
    marginBottom: 16,
  },
  notFoundBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F0E8FA',
  },
  notFoundBtnText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
    color: '#173753',
  },
  headerBlock: {
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  headerIconBtn: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: ACTIVE_RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerAvatarFallback: {
    backgroundColor: '#9D8DF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActivityBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ACTIVE_RING,
  },
  headerActivityEmoji: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    includeFontPadding: false,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  headerName: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '700',
    color: '#19395A',
  },
  headerStatus: {
    marginTop: 2,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 15,
  },
  headerStatusPrefix: {
    color: '#697C95',
  },
  headerStatusBody: {
    color: '#77966D',
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgb(208, 209, 232)',
    marginHorizontal: 16,
    opacity: 0.9,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
    backgroundColor: 'transparent',
  },
  listContentEmpty: {
    justifyContent: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    color: '#C9A8D8',
    paddingHorizontal: 32,
  },
  timestampWrap: {
    alignItems: 'center',
    marginVertical: 14,
  },
  timestampText: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  msgRowOutgoing: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  bubbleOutgoing: {
    maxWidth: '80%',
    backgroundColor: '#9D8DF1',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleTextOutgoing: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 21,
  },
  msgRowIncoming: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    maxWidth: '92%',
  },
  avatarColumn: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginRight: 6,
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  msgAvatarSpacer: {
    width: 28,
    height: 28,
  },
  msgAvatarFallback: {
    backgroundColor: '#9D8DF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleIncoming: {
    flexShrink: 1,
    backgroundColor: '#E8EAEF',
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleTextIncoming: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '400',
    color: '#173753',
    lineHeight: 21,
  },
  inputBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E9F0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#173753',
    borderRadius: 26,
    paddingLeft: 18,
    paddingRight: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    color: '#173753',
    maxHeight: 120,
    paddingVertical: 10,
  },
  inputIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9D8DF1',
  },
});
