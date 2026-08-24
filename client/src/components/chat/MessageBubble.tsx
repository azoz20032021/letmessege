import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Copy,
  CornerUpLeft,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  RotateCw,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Avatar, Button } from '@/components/ui';
import { assetUrl } from '@/lib/api';
import { cn, formatBytes, formatTime, isImageMime } from '@/lib/utils';
import { useChatStore } from '@/store/chat';
import { useClickOutside } from '@/hooks';
import type { Attachment, Message } from '@/types';

function ImageGrid({ attachments, onOpen }: { attachments: Attachment[]; onOpen: (a: Attachment) => void }) {
  return (
    <div
      className={cn(
        'grid gap-1 overflow-hidden rounded-xl',
        attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
      )}
    >
      {attachments.map((attachment) => (
        <button
          key={attachment.url}
          type="button"
          onClick={() => onOpen(attachment)}
          className="focus-ring group/img relative overflow-hidden bg-black/10"
        >
          <img
            src={assetUrl(attachment.url)}
            alt={attachment.name}
            loading="lazy"
            className={cn(
              'w-full object-cover transition-transform duration-300 group-hover/img:scale-[1.03]',
              attachments.length === 1 ? 'max-h-80' : 'h-32'
            )}
          />
        </button>
      ))}
    </div>
  );
}

function FileRow({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const { t } = useTranslation();
  return (
    <a
      href={assetUrl(attachment.url)}
      target="_blank"
      rel="noreferrer"
      download={attachment.name}
      className={cn(
        'focus-ring flex items-center gap-3 rounded-xl p-2.5 transition-colors',
        mine ? 'bg-white/15 hover:bg-white/25' : 'bg-surface-muted hover:bg-line/60'
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          mine ? 'bg-white/20' : 'bg-surface'
        )}
      >
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{attachment.name}</span>
        <span className={cn('block text-xs', mine ? 'text-white/70' : 'text-ink-faint')}>
          {formatBytes(attachment.size)}
        </span>
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" aria-label={t('chat.download')} />
    </a>
  );
}

/** Sent → delivered → read, expressed with one / two ticks. */
function DeliveryState({ message, memberCount }: { message: Message; memberCount: number }) {
  if (message.failed) return <AlertCircle className="h-3.5 w-3.5 text-red-300" />;
  if (message.pending) return <Clock className="h-3.5 w-3.5 opacity-70" />;

  // readBy always contains the sender, so everyone else is memberCount - 1.
  const readByOthers = message.readBy.filter((r) => r.user !== message.sender._id).length;
  const allRead = readByOthers >= Math.max(memberCount - 1, 1);

  return allRead ? (
    <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
  ) : readByOthers > 0 ? (
    <CheckCheck className="h-3.5 w-3.5 opacity-70" />
  ) : (
    <Check className="h-3.5 w-3.5 opacity-70" />
  );
}

interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  showAvatar: boolean;
  showName: boolean;
  memberCount: number;
  onPreviewImage: (attachment: Attachment) => void;
}

export function MessageBubble({
  message,
  mine,
  showAvatar,
  showName,
  memberCount,
  onPreviewImage,
}: MessageBubbleProps) {
  const { t, i18n } = useTranslation();
  const setReplyTo = useChatStore((s) => s.setReplyTo);
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const editMessage = useChatStore((s) => s.editMessage);
  const retryMessage = useChatStore((s) => s.retryMessage);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenuOpen(false), menuOpen);

  if (message.type === 'system') {
    return (
      <div className="my-3 flex justify-center">
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs text-ink-muted">
          {message.text}
        </span>
      </div>
    );
  }

  const deleted = Boolean(message.deletedAt);
  const images = message.attachments.filter((a) => isImageMime(a.mimeType));
  const files = message.attachments.filter((a) => !isImageMime(a.mimeType));

  const submitEdit = async () => {
    const text = draft.trim();
    setEditing(false);
    if (!text || text === message.text) return;
    try {
      await editMessage(message._id, text);
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const actions = [
    {
      key: 'reply',
      icon: CornerUpLeft,
      label: t('chat.reply'),
      onClick: () => setReplyTo(message),
      show: !deleted,
    },
    {
      key: 'copy',
      icon: Copy,
      label: t('chat.copy'),
      onClick: () => {
        void navigator.clipboard.writeText(message.text);
        toast.success(t('chat.copied'));
      },
      show: !deleted && Boolean(message.text),
    },
    {
      key: 'edit',
      icon: Pencil,
      label: t('common.edit'),
      onClick: () => {
        setDraft(message.text);
        setEditing(true);
      },
      show: mine && !deleted && message.type === 'text',
    },
    {
      key: 'delete',
      icon: Trash2,
      label: t('common.delete'),
      danger: true,
      onClick: () => {
        if (window.confirm(t('chat.deleteConfirm'))) void deleteMessage(message._id);
      },
      show: mine && !deleted,
    },
  ].filter((a) => a.show);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cn('group flex w-full gap-2', mine ? 'flex-row-reverse' : 'flex-row')}
    >
      <div className="w-8 shrink-0">
        {showAvatar && !mine && (
          <Avatar
            name={message.sender.name}
            src={message.sender.avatar}
            color={message.sender.avatarColor}
            size="sm"
          />
        )}
      </div>

      <div className={cn('flex min-w-0 max-w-[min(78%,34rem)] flex-col', mine && 'items-end')}>
        {showName && !mine && (
          <span className="mb-1 px-1 text-xs font-medium text-ink-muted">{message.sender.name}</span>
        )}

        <div className={cn('flex items-end gap-1', mine && 'flex-row-reverse')}>
          <div
            className={cn(
              'relative min-w-0 rounded-2xl px-3 py-2 text-[15px] leading-relaxed shadow-soft transition-colors',
              mine
                ? 'bg-brand-600 text-white'
                : 'border border-line bg-surface-raised text-ink',
              mine ? 'rounded-ee-md' : 'rounded-es-md',
              message.failed && 'ring-1 ring-red-400',
              message.pending && 'opacity-80'
            )}
          >
            {message.replyTo && !deleted && (
              <div
                className={cn(
                  'mb-1.5 rounded-lg border-s-2 px-2 py-1 text-xs',
                  mine ? 'border-white/60 bg-white/10' : 'border-brand-500 bg-surface-muted'
                )}
              >
                <span className="block font-medium opacity-90">{message.replyTo.sender.name}</span>
                <span dir="auto" className="line-clamp-2 opacity-75">
                  {message.replyTo.text || t('chat.photo')}
                </span>
              </div>
            )}

            {deleted ? (
              <span className="italic opacity-70">{t('chat.deleted')}</span>
            ) : editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={draft}
                  autoFocus
                  rows={2}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void submitEdit();
                    }
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className={cn(
                    'w-full resize-none rounded-lg bg-black/10 p-2 text-[15px] outline-none',
                    mine ? 'text-white placeholder:text-white/50' : 'text-ink'
                  )}
                />
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void submitEdit()}>
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {images.length > 0 && (
                  <div className={cn(message.text && 'mb-1.5')}>
                    <ImageGrid attachments={images} onOpen={onPreviewImage} />
                  </div>
                )}
                {files.length > 0 && (
                  <div className={cn('space-y-1.5', message.text && 'mb-1.5')}>
                    {files.map((file) => (
                      <FileRow key={file.url} attachment={file} mine={mine} />
                    ))}
                  </div>
                )}
                {message.text && (
                  // dir="auto" isolates each message: an English line inside the
                  // Arabic UI keeps its own direction and punctuation placement.
                  <p dir="auto" className="whitespace-pre-wrap break-words">
                    {message.text}
                  </p>
                )}
              </>
            )}

            <div
              className={cn(
                'mt-1 flex items-center justify-end gap-1 text-[10px]',
                mine ? 'text-white/70' : 'text-ink-faint'
              )}
            >
              {message.editedAt && !deleted && <span>{t('chat.edited')}</span>}
              <span className="tabular-nums">
                {formatTime(message.createdAt, i18n.resolvedLanguage)}
              </span>
              {mine && <DeliveryState message={message} memberCount={memberCount} />}
            </div>
          </div>

          {actions.length > 0 && !editing && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={t('chat.messageActions')}
                className={cn(
                  'focus-ring flex h-7 w-7 items-center justify-center rounded-full text-ink-faint',
                  'opacity-0 transition-opacity hover:bg-surface-muted hover:text-ink',
                  'group-hover:opacity-100 focus-visible:opacity-100',
                  menuOpen && 'opacity-100'
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div
                  className={cn(
                    'absolute bottom-8 z-20 w-40 animate-pop-in overflow-hidden rounded-xl border border-line',
                    'bg-surface-raised p-1 shadow-lift',
                    mine ? 'end-0' : 'start-0'
                  )}
                >
                  {actions.map(({ key, icon: Icon, label, onClick, danger }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onClick();
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                        danger
                          ? 'text-red-500 hover:bg-red-500/10'
                          : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {message.failed && message.tempId && (
          <button
            type="button"
            onClick={() => void retryMessage(message.tempId!)}
            className="focus-ring mt-1 inline-flex items-center gap-1 px-1 text-xs text-red-500 hover:underline"
          >
            <RotateCw className="h-3 w-3" />
            {t('common.retry')}
          </button>
        )}
      </div>
    </motion.div>
  );
}
