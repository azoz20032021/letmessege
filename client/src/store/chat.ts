import { create } from 'zustand';

import { conversationApi, messageApi, uploadApi } from '@/lib/api';
import { EVENTS, emitWithAck, getSocket } from '@/lib/socket';
import type { Attachment, Conversation, Message, TypingUser } from '@/types';

interface Thread {
  messages: Message[];
  hasMore: boolean;
  cursor: string | null;
  loading: boolean;
  loaded: boolean;
}

const emptyThread = (): Thread => ({
  messages: [],
  hasMore: false,
  cursor: null,
  loading: false,
  loaded: false,
});

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  threads: Record<string, Thread>;
  typing: Record<string, TypingUser[]>;
  onlineUserIds: Set<string>;
  connection: 'connecting' | 'online' | 'offline';
  loadingConversations: boolean;
  replyTo: Message | null;

  loadConversations: () => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  closeConversation: () => void;
  loadOlder: (id: string) => Promise<void>;

  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  sendFiles: (files: File[], text: string, onProgress?: (p: number) => void) => Promise<void>;
  editMessage: (id: string, text: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  retryMessage: (tempId: string) => Promise<void>;
  setReplyTo: (message: Message | null) => void;

  startTyping: () => void;
  stopTyping: () => void;

  upsertConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  bindSocket: (currentUserId: string) => () => void;
}

const PAGE_SIZE = 30;

const byRecency = (a: Conversation, b: Conversation) =>
  new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();

let typingTimer: ReturnType<typeof setTimeout> | undefined;
let typingActive = false;

export const useChatStore = create<ChatState>((set, get) => {
  /** Applies a patch to one thread, creating it when absent. */
  const patchThread = (id: string, patch: Partial<Thread> | ((t: Thread) => Partial<Thread>)) =>
    set((state) => {
      const current = state.threads[id] ?? emptyThread();
      const next = typeof patch === 'function' ? patch(current) : patch;
      return { threads: { ...state.threads, [id]: { ...current, ...next } } };
    });

  /** Inserts a message, replacing an optimistic twin when the ids line up. */
  const insertMessage = (conversationId: string, message: Message, tempId?: string) =>
    patchThread(conversationId, (thread) => {
      const withoutTemp = tempId
        ? thread.messages.filter((m) => m.tempId !== tempId)
        : thread.messages;

      if (withoutTemp.some((m) => m._id === message._id)) {
        return { messages: withoutTemp.map((m) => (m._id === message._id ? message : m)) };
      }
      return { messages: [...withoutTemp, message] };
    });

  const replaceMessage = (conversationId: string, message: Message) =>
    patchThread(conversationId, (thread) => ({
      messages: thread.messages.map((m) => (m._id === message._id ? { ...m, ...message } : m)),
    }));

  const bumpConversation = (conversationId: string, message: Message, incrementUnread: boolean) =>
    set((state) => ({
      conversations: state.conversations
        .map((c) =>
          c._id === conversationId
            ? {
                ...c,
                lastMessage: message,
                lastMessageAt: message.createdAt,
                unreadCount: incrementUnread ? c.unreadCount + 1 : c.unreadCount,
              }
            : c
        )
        .sort(byRecency),
    }));

  return {
    conversations: [],
    activeId: null,
    threads: {},
    typing: {},
    onlineUserIds: new Set<string>(),
    connection: 'connecting',
    loadingConversations: false,
    replyTo: null,

    async loadConversations() {
      set({ loadingConversations: true });
      try {
        const { conversations } = await conversationApi.list();
        set({ conversations: conversations.sort(byRecency) });
      } finally {
        set({ loadingConversations: false });
      }
    },

    async openConversation(id) {
      const previous = get().activeId;
      if (previous && previous !== id) {
        getSocket().emit(EVENTS.LEAVE_CONVERSATION, { conversationId: previous });
      }

      set({ activeId: id, replyTo: null });
      getSocket().emit(EVENTS.JOIN_CONVERSATION, { conversationId: id });

      // Opening a room clears its badge; the server does the same on join.
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c._id === id ? { ...c, unreadCount: 0 } : c
        ),
      }));

      if (get().threads[id]?.loaded) return;

      patchThread(id, { loading: true });
      try {
        const { messages, hasMore, nextCursor } = await conversationApi.messages(id, {
          limit: PAGE_SIZE,
        });
        patchThread(id, {
          messages,
          hasMore,
          cursor: nextCursor,
          loading: false,
          loaded: true,
        });
      } catch {
        patchThread(id, { loading: false });
      }
    },

    closeConversation() {
      const id = get().activeId;
      if (id) getSocket().emit(EVENTS.LEAVE_CONVERSATION, { conversationId: id });
      set({ activeId: null, replyTo: null });
    },

    async loadOlder(id) {
      const thread = get().threads[id];
      if (!thread?.hasMore || thread.loading || !thread.cursor) return;

      patchThread(id, { loading: true });
      try {
        const { messages, hasMore, nextCursor } = await conversationApi.messages(id, {
          limit: PAGE_SIZE,
          before: thread.cursor,
        });
        patchThread(id, (t) => ({
          messages: [...messages, ...t.messages],
          hasMore,
          cursor: nextCursor,
          loading: false,
        }));
      } catch {
        patchThread(id, { loading: false });
      }
    },

    async sendMessage(text, attachments = []) {
      const conversationId = get().activeId;
      if (!conversationId) return;

      const replyTo = get().replyTo;
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Optimistic bubble: the UI must not wait for the round trip.
      const optimistic = {
        _id: tempId,
        tempId,
        conversation: conversationId,
        sender: { _id: 'me', name: '', avatar: '', avatarColor: '' },
        type: attachments.length ? 'file' : 'text',
        text,
        attachments,
        replyTo: replyTo
          ? {
              _id: replyTo._id,
              text: replyTo.text,
              type: replyTo.type,
              createdAt: replyTo.createdAt,
              sender: {
                _id: replyTo.sender._id,
                name: replyTo.sender.name,
                avatarColor: replyTo.sender.avatarColor,
              },
            }
          : null,
        readBy: [],
        editedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pending: true,
      } as unknown as Message;

      patchThread(conversationId, (t) => ({ messages: [...t.messages, optimistic] }));
      set({ replyTo: null });
      get().stopTyping();

      try {
        const ack = await emitWithAck<{ success: boolean; message?: Message }>(
          EVENTS.MESSAGE_SEND,
          { conversationId, text, attachments, replyTo: replyTo?._id ?? null, tempId }
        );

        if (!ack?.success || !ack.message) throw new Error(ack ? 'REJECTED' : 'NO_ACK');
        insertMessage(conversationId, ack.message, tempId);
        bumpConversation(conversationId, ack.message, false);
      } catch {
        patchThread(conversationId, (t) => ({
          messages: t.messages.map((m) =>
            m.tempId === tempId ? { ...m, pending: false, failed: true } : m
          ),
        }));
      }
    },

    async sendFiles(files, text, onProgress) {
      const { attachments } = await uploadApi.files(files, onProgress);
      await get().sendMessage(text, attachments);
    },

    async editMessage(id, text) {
      const conversationId = get().activeId;
      if (!conversationId) return;
      const { message } = await messageApi.edit(id, text);
      replaceMessage(conversationId, message);
    },

    async deleteMessage(id) {
      const conversationId = get().activeId;
      if (!conversationId) return;
      await messageApi.remove(id);
      patchThread(conversationId, (t) => ({
        messages: t.messages.map((m) =>
          m._id === id ? { ...m, deletedAt: new Date().toISOString(), text: '', attachments: [] } : m
        ),
      }));
    },

    async retryMessage(tempId) {
      const conversationId = get().activeId;
      if (!conversationId) return;

      const failed = get().threads[conversationId]?.messages.find((m) => m.tempId === tempId);
      if (!failed) return;

      patchThread(conversationId, (t) => ({
        messages: t.messages.filter((m) => m.tempId !== tempId),
      }));
      await get().sendMessage(failed.text, failed.attachments);
    },

    setReplyTo(message) {
      set({ replyTo: message });
    },

    startTyping() {
      const conversationId = get().activeId;
      if (!conversationId) return;

      if (!typingActive) {
        typingActive = true;
        getSocket().emit(EVENTS.TYPING_START, { conversationId });
      }
      // Idle for 2s counts as "stopped typing".
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => get().stopTyping(), 2000);
    },

    stopTyping() {
      const conversationId = get().activeId;
      clearTimeout(typingTimer);
      if (!typingActive || !conversationId) return;
      typingActive = false;
      getSocket().emit(EVENTS.TYPING_STOP, { conversationId });
    },

    upsertConversation(conversation) {
      set((state) => {
        const exists = state.conversations.some((c) => c._id === conversation._id);
        const conversations = exists
          ? state.conversations.map((c) => (c._id === conversation._id ? conversation : c))
          : [conversation, ...state.conversations];
        return { conversations: conversations.sort(byRecency) };
      });
    },

    removeConversation(id) {
      set((state) => {
        const { [id]: _removed, ...threads } = state.threads;
        return {
          conversations: state.conversations.filter((c) => c._id !== id),
          threads,
          activeId: state.activeId === id ? null : state.activeId,
        };
      });
    },

    /** Subscribes to every realtime event. Returns an unsubscribe function. */
    bindSocket(currentUserId) {
      const socket = getSocket();

      const onConnect = () => set({ connection: 'online' });
      const onDisconnect = () => set({ connection: 'offline' });
      const onReconnectAttempt = () => set({ connection: 'connecting' });

      const onOnlineUsers = ({ userIds }: { userIds: string[] }) =>
        set({ onlineUserIds: new Set(userIds) });

      const onUserOnline = ({ userId }: { userId: string }) =>
        set((state) => ({ onlineUserIds: new Set(state.onlineUserIds).add(userId) }));

      const onUserOffline = ({ userId }: { userId: string }) =>
        set((state) => {
          const next = new Set(state.onlineUserIds);
          next.delete(userId);
          return { onlineUserIds: next };
        });

      const onMessageNew = ({
        conversationId,
        message,
      }: {
        conversationId: string;
        message: Message;
      }) => {
        const mine = message.sender._id === currentUserId;
        insertMessage(conversationId, message, mine ? undefined : undefined);
        bumpConversation(conversationId, message, !mine && get().activeId !== conversationId);

        if (!mine) socket.emit(EVENTS.MESSAGE_DELIVERED, { messageId: message._id });
        if (!mine && get().activeId === conversationId) {
          socket.emit(EVENTS.MESSAGE_READ, { conversationId });
        }
      };

      // Fired for members who are not currently in the room: refresh the sidebar.
      const onMessageDelivered = ({
        conversation,
        message,
      }: {
        conversation?: Conversation;
        message: Message;
      }) => {
        if (conversation) get().upsertConversation(conversation);
        else bumpConversation(message.conversation, message, true);
      };

      const onMessageEdited = ({
        conversationId,
        message,
      }: {
        conversationId: string;
        message: Message;
      }) => replaceMessage(conversationId, message);

      const onMessageDeleted = ({
        conversationId,
        messageId,
      }: {
        conversationId: string;
        messageId: string;
      }) =>
        patchThread(conversationId, (t) => ({
          messages: t.messages.map((m) =>
            m._id === messageId
              ? { ...m, deletedAt: new Date().toISOString(), text: '', attachments: [] }
              : m
          ),
        }));

      const onMessageRead = ({
        conversationId,
        userId,
        at,
      }: {
        conversationId: string;
        userId: string;
        at: string;
      }) => {
        if (userId === currentUserId) {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === conversationId ? { ...c, unreadCount: 0 } : c
            ),
          }));
          return;
        }
        patchThread(conversationId, (t) => ({
          messages: t.messages.map((m) =>
            m.readBy.some((r) => r.user === userId) ? m : { ...m, readBy: [...m.readBy, { user: userId, at }] }
          ),
        }));
      };

      const onTyping = ({
        conversationId,
        userId,
        name,
        isTyping,
      }: {
        conversationId: string;
        userId: string;
        name?: string;
        isTyping: boolean;
      }) =>
        set((state) => {
          const current = state.typing[conversationId] ?? [];
          const next = isTyping
            ? current.some((u) => u.userId === userId)
              ? current
              : [...current, { userId, name: name ?? '' }]
            : current.filter((u) => u.userId !== userId);
          return { typing: { ...state.typing, [conversationId]: next } };
        });

      const onConversationCreated = ({ conversation }: { conversation: Conversation }) => {
        get().upsertConversation(conversation);
        socket.emit(EVENTS.JOIN_CONVERSATION, { conversationId: conversation._id });
      };

      const onConversationUpdated = ({
        conversation,
        removedUserId,
      }: {
        conversation: Conversation;
        removedUserId?: string;
      }) => {
        if (removedUserId === currentUserId) get().removeConversation(conversation._id);
        else get().upsertConversation(conversation);
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.io.on('reconnect_attempt', onReconnectAttempt);
      socket.on(EVENTS.ONLINE_USERS, onOnlineUsers);
      socket.on(EVENTS.USER_ONLINE, onUserOnline);
      socket.on(EVENTS.USER_OFFLINE, onUserOffline);
      socket.on(EVENTS.MESSAGE_NEW, onMessageNew);
      socket.on(EVENTS.MESSAGE_DELIVERED, onMessageDelivered);
      socket.on(EVENTS.MESSAGE_EDITED, onMessageEdited);
      socket.on(EVENTS.MESSAGE_DELETED, onMessageDeleted);
      socket.on(EVENTS.MESSAGE_READ, onMessageRead);
      socket.on(EVENTS.TYPING_UPDATE, onTyping);
      socket.on(EVENTS.CONVERSATION_CREATED, onConversationCreated);
      socket.on(EVENTS.CONVERSATION_UPDATED, onConversationUpdated);

      if (socket.connected) set({ connection: 'online' });

      return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.io.off('reconnect_attempt', onReconnectAttempt);
        socket.off(EVENTS.ONLINE_USERS, onOnlineUsers);
        socket.off(EVENTS.USER_ONLINE, onUserOnline);
        socket.off(EVENTS.USER_OFFLINE, onUserOffline);
        socket.off(EVENTS.MESSAGE_NEW, onMessageNew);
        socket.off(EVENTS.MESSAGE_DELIVERED, onMessageDelivered);
        socket.off(EVENTS.MESSAGE_EDITED, onMessageEdited);
        socket.off(EVENTS.MESSAGE_DELETED, onMessageDeleted);
        socket.off(EVENTS.MESSAGE_READ, onMessageRead);
        socket.off(EVENTS.TYPING_UPDATE, onTyping);
        socket.off(EVENTS.CONVERSATION_CREATED, onConversationCreated);
        socket.off(EVENTS.CONVERSATION_UPDATED, onConversationUpdated);
      };
    },
  };
});

/** Convenience selector: the conversation currently open, if any. */
export const useActiveConversation = () =>
  useChatStore((s) => s.conversations.find((c) => c._id === s.activeId) ?? null);

/**
 * Typing users in one conversation.
 *
 * The fallback has to be a shared constant: returning a fresh `[]` from the
 * selector makes zustand see a new reference on every render and re-render
 * forever.
 */
const NO_TYPING: TypingUser[] = [];

export const useTypingIn = (conversationId: string) =>
  useChatStore((s) => s.typing[conversationId] ?? NO_TYPING);
