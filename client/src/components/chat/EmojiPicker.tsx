import { useState } from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

/**
 * A small hand-rolled picker.
 *
 * A full emoji library would add ~300 KB to the bundle for a feature that only
 * needs a few dozen common glyphs, so the frequent ones are inlined instead.
 */
const GROUPS = [
  {
    key: 'smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤔', '🤐', '😐',
      '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '😯', '😴', '🥱',
    ],
  },
  {
    key: 'gestures',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌',
      '🤝', '🙏', '💪', '👋', '🖐️', '✋', '🫡', '🫶', '👀', '🧠',
    ],
  },
  {
    key: 'hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '✨', '🔥',
    ],
  },
  {
    key: 'objects',
    icon: '🎉',
    emojis: [
      '🎉', '🎊', '🎈', '🎁', '🏆', '⭐', '🌟', '💡', '📌', '📎',
      '📷', '🎵', '☕', '🍕', '🍔', '🚀', '⚡', '✅', '❌', '⏰',
    ],
  },
] as const;

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [group, setGroup] = useState<(typeof GROUPS)[number]['key']>('smileys');
  const active = GROUPS.find((g) => g.key === group) ?? GROUPS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      className="absolute bottom-12 start-0 z-30 w-72 rounded-2xl border border-line bg-surface-raised p-2 shadow-lift"
    >
      <div className="mb-2 flex gap-1 border-b border-line pb-2">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(g.key)}
            className={cn(
              'focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors',
              group === g.key ? 'bg-brand-500/15' : 'hover:bg-surface-muted'
            )}
          >
            {g.icon}
          </button>
        ))}
      </div>

      <div className="scrollbar-thin grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto">
        {active.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-transform hover:scale-110 hover:bg-surface-muted"
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
