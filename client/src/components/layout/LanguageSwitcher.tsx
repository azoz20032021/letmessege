import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe } from 'lucide-react';

import { Button } from '@/components/ui';
import { LANGUAGES, STORAGE_KEY, type LanguageCode } from '@/i18n';
import { userApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useClickOutside } from '@/hooks';
import { useAuthStore } from '@/store/auth';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
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
        <div className="absolute bottom-full end-0 z-40 mb-2 w-44 animate-pop-in overflow-hidden rounded-xl border border-line bg-surface-raised p-1 shadow-lift">
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
