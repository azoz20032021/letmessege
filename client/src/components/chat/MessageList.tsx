import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, MessagesSquare, X } from 'lucide-react';

import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { assetUrl } from '@/lib/api';
import { cn, formatDayLabel, isSameDay } from '@/lib/utils';
import { useStickyScroll } from '@/hooks';
import { useAuthStore } from '@/store/auth';
import { useChatStore, useTypingIn } from '@/store/chat';
import type { Attachment, Conversation } from '@/types';

/** Full-screen viewer for an image attachment. */
function Lightbox({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Close"
        className="absolute end-4 top-4 text-white hover:bg-white/10"
      >
        <X className="h-5 w-5" />
      </Button>
      <motion.img
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        src={assetUrl(attachment.url)}
        alt={attachment.name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-xl object-contain shadow-lift"
      />
    </motion.div>
  );
}

export function MessageList({ conversation }: { conversation: Conversation }) {
  const { t, i18n } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?._id);
  const thread = useChatStore((s) => s.threads[conversation._id]);
  const loadOlder = useChatStore((s) => s.loadOlder);
  const typing = useTypingIn(conversation._id);

  const [preview, setPreview] = useState<Attachment | null>(null);
  const messages = thread?.messages ?? [];

  const { ref, atBottom, onScroll, scrollToBottom } = useStickyScroll<HTMLDivElement>(
    `${messages.length}:${typing.length}`
  );

  // Reaching the top pulls in the previous page.
  const handleScroll = useCallback(() => {
    onScroll();
    const el = ref.current;
    if (el && el.scrollTop < 80 && thread?.hasMore && !thread.loading) {
      const previousHeight = el.scrollHeight;
      void loadOlder(conversation._id).then(() => {
        // Preserve the reading position after prepending older messages.
        requestAnimationFrame(() => {
          if (ref.current) ref.current.scrollTop = ref.current.scrollHeight - previousHeight;
        });
      });
    }
  }, [onScroll, ref, thread?.hasMore, thread?.loading, loadOlder, conversation._id]);

  const othersTyping = typing.filter((u) => u.userId !== currentUserId);

  if (thread?.loading && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        onScroll={handleScroll}
        className="scrollbar-thin chat-canvas h-full space-y-1 overflow-y-auto px-3 py-4 sm:px-6"
      >
        {thread?.hasMore && (
          <div className="flex justify-center pb-2">
            {thread.loading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Button variant="ghost" size="sm" onClick={() => void loadOlder(conversation._id)}>
                {t('chat.loadOlder')}
              </Button>
            )}
          </div>
        )}

        {messages.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="h-6 w-6" />}
            title={t('chat.noMessages')}
            description={t('chat.noMessagesHint')}
            className="h-full"
          />
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const mine = message.sender._id === currentUserId || message.sender._id === 'me';

            const newDay = !previous || !isSameDay(previous.createdAt, message.createdAt);
            // Consecutive messages from one person are visually grouped.
            const sameAuthorRun =
              previous &&
              !newDay &&
              previous.sender._id === message.sender._id &&
              previous.type !== 'system' &&
              new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
                5 * 60 * 1000;

            return (
              <Fragment key={message._id}>
                {newDay && (
                  <div className="sticky top-0 z-10 flex justify-center py-2">
                    <span className="glass rounded-full border border-line px-3 py-1 text-[11px] font-medium text-ink-muted shadow-soft">
                      {formatDayLabel(message.createdAt, i18n.resolvedLanguage ?? 'en', {
                        today: t('chat.today'),
                        yesterday: t('chat.yesterday'),
                      })}
                    </span>
                  </div>
                )}
                <div className={cn(sameAuthorRun ? 'pt-0.5' : 'pt-3')}>
                  <MessageBubble
                    message={message}
                    mine={mine}
                    showAvatar={!sameAuthorRun}
                    showName={conversation.type === 'group' && !sameAuthorRun}
                    memberCount={conversation.members.length}
                    onPreviewImage={setPreview}
                  />
                </div>
              </Fragment>
            );
          })
        )}

        {othersTyping.length > 0 && <TypingIndicator users={othersTyping} />}
      </div>

      <AnimatePresence>
        {!atBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            type="button"
            onClick={() => scrollToBottom()}
            aria-label={t('chat.scrollToBottom')}
            className="focus-ring absolute bottom-4 end-4 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-raised text-ink shadow-lift"
          >
            <ArrowDown className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {preview && <Lightbox attachment={preview} onClose={() => setPreview(null)} />}
      </AnimatePresence>
    </div>
  );
}
