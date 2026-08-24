import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus, Users, Image as ImageIcon, Paperclip } from 'lucide-react';

import { Avatar, Badge, EmptyState, Skeleton, Button } from '@/components/ui';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { cn, formatListStamp } from '@/lib/utils';
import type { Conversation } from '@/types';

type Filter = 'all' | 'unread' | 'groups';

/** One-line preview of the newest message in a conversation. */
function Preview({ conversation, isMine }: { conversation: Conversation; isMine: boolean }) {
  const { t } = useTranslation();
  const message = conversation.lastMessage;

  if (!message) return <span className="text-ink-faint">{t('chat.noMessages')}</span>;
  if (message.deletedAt) return <span className="italic text-ink-faint">{t('chat.deleted')}</span>;

  const prefix =
    conversation.type === 'group' && message.type !== 'system'
      ? `${isMine ? t('common.you') : message.sender?.name?.split(' ')[0]}: `
      : isMine
        ? `${t('common.you')}: `
        : '';

  if (message.type === 'image' || message.type === 'file') {
    const Icon = message.type === 'image' ? ImageIcon : Paperclip;
    return (
      <span className="inline-flex items-center gap-1.5">
        {prefix}
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {message.text || t(message.type === 'image' ? 'chat.photo' : 'chat.file')}
      </span>
    );
  }

  if (message.type === 'system') return <span className="italic">{message.text}</span>;

  return (
    <span>
      {prefix}
      {message.text}
    </span>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const { i18n } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?._id);
  const activeId = useChatStore((s) => s.activeId);
  const openConversation = useChatStore((s) => s.openConversation);
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const typing = useChatStore((s) => s.typing[conversation._id]);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const active = activeId === conversation._id;
  const isGroup = conversation.type === 'group';
  const peerOnline = conversation.peer ? onlineUserIds.has(conversation.peer._id) : false;
  const someoneTyping = (typing?.length ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={() => {
        void openConversation(conversation._id);
        setSidebarOpen(false);
      }}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'focus-ring group relative flex w-full items-center gap-3 rounded-2xl p-2.5 text-start transition-colors',
        active ? 'bg-brand-500/10' : 'hover:bg-surface-muted'
      )}
    >
      {active && (
        <span className="absolute inset-y-3 start-0 w-1 rounded-full bg-brand-500" aria-hidden />
      )}

      {isGroup ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <Users className="h-5 w-5" />
        </span>
      ) : (
        <Avatar
          name={conversation.title}
          src={conversation.peer?.avatar}
          gradient={conversation.peer?.avatarColor}
          size="lg"
          online={peerOnline}
          className="shrink-0"
        />
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'truncate text-[15px]',
              conversation.unreadCount > 0 ? 'font-semibold text-ink' : 'font-medium text-ink'
            )}
          >
            {conversation.title}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
            {formatListStamp(conversation.lastMessageAt, i18n.resolvedLanguage)}
          </span>
        </span>

        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span
            dir="auto"
            className={cn(
              'truncate text-[13px]',
              someoneTyping
                ? 'text-brand-500'
                : conversation.unreadCount > 0
                  ? 'text-ink'
                  : 'text-ink-muted'
            )}
          >
            {someoneTyping ? (
              <span className="inline-flex items-center gap-1">
                <span className="inline-flex gap-0.5">
                  <i className="h-1 w-1 animate-typing-dot rounded-full bg-brand-500" />
                  <i className="h-1 w-1 animate-typing-dot rounded-full bg-brand-500 [animation-delay:150ms]" />
                  <i className="h-1 w-1 animate-typing-dot rounded-full bg-brand-500 [animation-delay:300ms]" />
                </span>
              </span>
            ) : (
              <Preview
                conversation={conversation}
                isMine={conversation.lastMessage?.sender?._id === currentUserId}
              />
            )}
          </span>

          {conversation.unreadCount > 0 && (
            <Badge>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</Badge>
          )}
        </span>
      </span>
    </button>
  );
}

export function ConversationList({ query }: { query: string }) {
  const { t } = useTranslation();
  const conversations = useChatStore((s) => s.conversations);
  const loading = useChatStore((s) => s.loadingConversations);
  const setNewChatOpen = useUIStore((s) => s.setNewChatOpen);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'unread' && c.unreadCount === 0) return false;
      if (filter === 'groups' && c.type !== 'group') return false;
      if (!term) return true;
      return (
        c.title.toLowerCase().includes(term) ||
        c.members.some((m) => m.name.toLowerCase().includes(term))
      );
    });
  }, [conversations, filter, query]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('sidebar.filterAll') },
    { key: 'unread', label: t('sidebar.filterUnread') },
    { key: 'groups', label: t('sidebar.filterGroups') },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-1.5 px-3 pb-2">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              'focus-ring rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === key
                ? 'bg-ink text-surface'
                : 'bg-surface-muted text-ink-muted hover:text-ink'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {loading && conversations.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<MessageSquarePlus className="h-6 w-6" />}
            title={query ? t('sidebar.noResults', { query }) : t('sidebar.noConversations')}
            description={query ? undefined : t('sidebar.noConversationsHint')}
            action={
              !query && (
                <Button size="sm" onClick={() => setNewChatOpen(true)}>
                  {t('sidebar.newChat')}
                </Button>
              )
            }
          />
        ) : (
          visible.map((conversation) => (
            <ConversationRow key={conversation._id} conversation={conversation} />
          ))
        )}
      </div>
    </div>
  );
}
