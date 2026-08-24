import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe } from 'lucide-react';

import { Button } from '@/components/ui';
import { LANGUAGES, STORAGE_KEY, type LanguageCode } from '@/i18n';
import { userApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useClickOutside } from '@/hooks';
import { useAuthStore } from '@/store/auth';

interface LanguageSwitcherProps {
  compact?: boolean;
  /**
   * Which edge of the trigger the menu hangs from.
   *
   * A trigger sitting at the start of its row must open inward ('start'),
   * otherwise the panel runs off the side of the window — and because these are
   * logical edges, it stays correct once the layout mirrors for Arabic.
   */
  align?: 'start' | 'end';
}

export function LanguageSwitcher({ compact = false, align = 'end' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);

  const active = LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ?? LANGUAGES[0];

  const choose = async (code: LanguageCode) => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, code);
    await i18n.changeLanguage(code);

    // Persist the preference so it follows the account to other devices.
    if (user) {
      patchUser({ locale: code });
      userApi.update({ locale: code }).catch(() => {});
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size={compact ? 'icon' : 'sm'}
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        aria-expanded={open}
      >
        <Globe className="h-[18px] w-[18px]" />
        {!compact && <span className="text-sm">{active.native}</span>}
      </Button>

      {open && (
        <div
          className={cn(
            'absolute bottom-full z-40 mb-2 w-44 animate-pop-in overflow-hidden rounded-xl',
            'border border-line bg-surface-raised p-1 shadow-lift',
            align === 'start' ? 'start-0' : 'end-0'
          )}
        >
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => void choose(language.code)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                language.code === active.code
                  ? 'bg-brand-500/10 text-ink'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              )}
            >
              <span aria-hidden>{language.flag}</span>
              <span className="flex-1 text-start">{language.native}</span>
              {language.code === active.code && <Check className="h-4 w-4 text-brand-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
