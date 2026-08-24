import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { CornerUpLeft, FileText, Paperclip, SendHorizonal, Smile, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button, Spinner } from '@/components/ui';
import { EmojiPicker } from './EmojiPicker';
import { cn, formatBytes, isImageMime } from '@/lib/utils';
import { useAutoResize, useClickOutside } from '@/hooks';
import { useChatStore } from '@/store/chat';

const MAX_FILES = 5;
const MAX_FILE_MB = 10;

interface Staged {
  file: File;
  previewUrl?: string;
}

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendFiles = useChatStore((s) => s.sendFiles);
  const startTyping = useChatStore((s) => s.startTyping);
  const stopTyping = useChatStore((s) => s.stopTyping);
  const replyTo = useChatStore((s) => s.replyTo);
  const setReplyTo = useChatStore((s) => s.setReplyTo);

  const [text, setText] = useState('');
  const [staged, setStaged] = useState<Staged[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const textareaRef = useAutoResize(text);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useClickOutside<HTMLDivElement>(() => setEmojiOpen(false), emojiOpen);

  const canSend = (text.trim().length > 0 || staged.length > 0) && !uploading;

  const stageFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const incoming = [...files];

    if (staged.length + incoming.length > MAX_FILES) {
      toast.error(t('chat.attachmentsLimit'));
      return;
    }

    const accepted: Staged[] = [];
    for (const file of incoming) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(t('chat.fileTooLarge', { name: file.name, size: MAX_FILE_MB }));
        continue;
      }
      accepted.push({
        file,
        previewUrl: isImageMime(file.type) ? URL.createObjectURL(file) : undefined,
      });
    }
    setStaged((current) => [...current, ...accepted]);
  };

  const removeStaged = (index: number) =>
    setStaged((current) => {
      const target = current[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });

  const reset = () => {
    staged.forEach((s) => s.previewUrl && URL.revokeObjectURL(s.previewUrl));
    setStaged([]);
    setText('');
    setProgress(0);
  };

  const submit = async () => {
    if (!canSend) return;
    const body = text.trim();
    const files = staged.map((s) => s.file);

    if (files.length === 0) {
      reset();
      await sendMessage(body);
      return;
    }

    setUploading(true);
    try {
      await sendFiles(files, body, setProgress);
      reset();
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter (and mobile keyboards) insert a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    if (event.target.value.trim()) startTyping();
    else stopTyping();
  };

  const insertEmoji = (emoji: string) => {
    setText((current) => current + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div
      className="border-t border-line bg-surface px-3 pb-3 pt-2 sm:px-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        stageFiles(e.dataTransfer.files);
      }}
    >
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-2 flex items-start gap-2 rounded-xl border-s-2 border-brand-500 bg-surface-muted px-3 py-2">
              <CornerUpLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-brand-500">
                  {t('chat.replyingTo', { name: replyTo.sender.name })}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {replyTo.text || t('chat.photo')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label={t('common.close')}
                className="focus-ring rounded-md p-0.5 text-ink-faint hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {staged.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {staged.map((item, index) => (
            <div
              key={`${item.file.name}-${index}`}
              className="group relative overflow-hidden rounded-xl border border-line bg-surface-muted"
            >
              {item.previewUrl ? (
                <img src={item.previewUrl} alt={item.file.name} className="h-16 w-16 object-cover" />
              ) : (
                <div className="flex h-16 w-40 items-center gap-2 px-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-ink-faint" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">{item.file.name}</p>
                    <p className="text-[10px] text-ink-faint">{formatBytes(item.file.size)}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeStaged(index)}
                aria-label={t('common.delete')}
                className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="mb-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-ink-faint">{progress}%</span>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            stageFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t('chat.attach')}
          className="shrink-0"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <div ref={emojiRef} className="relative shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEmojiOpen((v) => !v)}
            aria-label={t('chat.emoji')}
            className={cn(emojiOpen && 'bg-surface-muted text-ink')}
          >
            <Smile className="h-5 w-5" />
          </Button>
          <AnimatePresence>
            {emojiOpen && <EmojiPicker onPick={insertEmoji} />}
          </AnimatePresence>
        </div>

        <div className="flex min-w-0 flex-1 items-end rounded-2xl border border-line bg-surface-muted transition-colors focus-within:border-brand-500/60">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onBlur={stopTyping}
            rows={1}
            placeholder={t('chat.placeholder')}
            aria-label={t('chat.placeholder')}
            key={conversationId}
            className="max-h-40 w-full resize-none bg-transparent px-3.5 py-2.5 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-faint"
          />
        </div>

        <Button
          onClick={() => void submit()}
          disabled={!canSend}
          size="icon"
          aria-label={t('chat.send')}
          className="shrink-0 rounded-full"
        >
          {uploading ? (
            <Spinner className="h-4 w-4 text-white" />
          ) : (
            <SendHorizonal className="h-[18px] w-[18px] rtl-flip" />
          )}
        </Button>
      </div>
    </div>
  );
}
