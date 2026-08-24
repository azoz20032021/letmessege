import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import type { TypingUser } from '@/types';

const Dots = () => (
  <span className="flex items-center gap-1">
    <i className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-ink-faint" />
    <i className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-ink-faint [animation-delay:150ms]" />
    <i className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-ink-faint [animation-delay:300ms]" />
  </span>
);

export function TypingIndicator({ users }: { users: TypingUser[] }) {
  const { t } = useTranslation();
  if (users.length === 0) return null;

  const label =
    users.length > 3
      ? t('chat.typingSeveral')
      : t('chat.typing', {
          count: users.length,
          names: users.map((u) => u.name.split(' ')[0]).join('، '),
        });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2 px-10 pt-3"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2 rounded-2xl rounded-es-md border border-line bg-surface-raised px-3 py-2 shadow-soft">
        <Dots />
      </span>
      <span className="text-xs text-ink-muted">{label}</span>
    </motion.div>
  );
}
