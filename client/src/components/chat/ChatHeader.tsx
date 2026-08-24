import { useTranslation } from 'react-i18next';
import { ArrowLeft, Info, Search, Users } from 'lucide-react';

import { Avatar, Button } from '@/components/ui';
import { cn, formatRelative } from '@/lib/utils';
import { useChatStore, useTypingIn } from '@/store/chat';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import type { Conversation } from '@/types';

export function ChatHeader({ conversation }: { conversation: Conversation }) {
  const { t, i18n } = useTranslation();
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const typing = useTypingIn(conversation._id);
  const closeConversation = useChatStore((s) => s.closeConversation);
  const currentUserId = useAuthStore((s) => s.user?._id);
  const setGroupInfoOpen = useUIStore((s) => s.setGroupInfoOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);

  const isGroup = conversation.type === 'group';
  const othersTyping = typing.filter((u) => u.userId !== currentUserId);
  const peerOnline = conversation.peer ? onlineUserIds.has(conversation.peer._id) : false;

  const membersOnline = isGroup
    ? conversation.members.filter((m) => onlineUserIds.has(m._id)).length
    : 0;

  const subtitle = othersTyping.length
    ? t('chat.typing', {
        count: othersTyping.length,
        names: othersTyping.map((u) => u.name.split(' ')[0]).join('، '),
      })
    : isGroup
      ? `${t('common.members', { count: conversation.members.length })}${
          membersOnline > 0 ? ` · ${membersOnline} ${t('common.online').toLowerCase()}` : ''
        }`
      : peerOnline
        ? t('common.online')
        : conversation.peer
          ? t('chat.lastSeen', {
              time: formatRelative(conversation.peer.lastSeen, i18n.resolvedLanguage),
            })
          : '';

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={closeConversation}
        aria-label={t('common.back')}
        className="lg:hidden"
      >
        <ArrowLeft className="h-5 w-5 rtl-flip" />
      </Button>

      <button
        type="button"
        onClick={() => isGroup && setGroupInfoOpen(true)}
        disabled={!isGroup}
        className={cn(
          'focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-start',
          isGroup && 'hover:bg-surface-muted'
        )}
      >
        {isGroup ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            <Users className="h-5 w-5" />
          </span>
        ) : (
          <Avatar
            name={conversation.title}
            src={conversation.peer?.avatar}
            gradient={conversation.peer?.avatarColor}
            online={peerOnline}
          />
        )}

        <span className="min-w-0">
          <span className="block truncate font-semibold text-ink">{conversation.title}</span>
          <span
            className={cn(
              'block truncate text-xs',
              othersTyping.length
                ? 'text-brand-500'
                : peerOnline && !isGroup
                  ? 'text-emerald-500'
                  : 'text-ink-muted'
            )}
          >
            {subtitle}
          </span>
        </span>
      </button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSearchOpen(true)}
        aria-label={t('common.search')}
      >
        <Search className="h-5 w-5" />
      </Button>

      {isGroup && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setGroupInfoOpen(true)}
          aria-label={t('groupInfo.title')}
        >
          <Info className="h-5 w-5" />
        </Button>
      )}
    </header>
  );
}
