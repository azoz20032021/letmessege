import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AtSign, Eye, EyeOff, Lock, MessagesSquare, Sparkles, User as UserIcon } from 'lucide-react';

import { Button, Input } from '@/components/ui';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';

const FEATURES = [
  { emoji: '⚡', key: 'realtime' },
  { emoji: '👥', key: 'groups' },
  { emoji: '📎', key: 'files' },
  { emoji: '🔍', key: 'search' },
] as const;

const FEATURE_COPY: Record<string, Record<(typeof FEATURES)[number]['key'], string>> = {
  en: {
    realtime: 'Instant delivery over WebSockets',
    groups: 'Direct messages and group rooms',
    files: 'Share images and files',
    search: 'Search across every conversation',
  },
  ar: {
    realtime: 'تسليم فوري عبر WebSockets',
    groups: 'محادثات خاصة وغرف جماعية',
    files: 'شارك الصور والملفات',
    search: 'ابحث في كل المحادثات',
  },
  tr: {
    realtime: 'WebSocket üzerinden anında teslim',
    groups: 'Özel mesajlar ve grup odaları',
    files: 'Görsel ve dosya paylaş',
    search: 'Tüm sohbetlerde ara',
  },
};

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loginAsDemo = useAuthStore((s) => s.loginAsDemo);
  const theme = useUIStore((s) => s.theme);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'form' | 'demo' | null>(null);

  if (status === 'authenticated') {
    return <Navigate to={(location.state as { from?: string })?.from ?? '/'} replace />;
  }

  const isRegister = mode === 'register';
  const copy = FEATURE_COPY[i18n.resolvedLanguage ?? 'en'] ?? FEATURE_COPY.en;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('form');
    try {
      if (isRegister) await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
    } catch {
      // The store already surfaced a human-readable message.
    } finally {
      setBusy(null);
    }
  };

  const enterDemo = async () => {
    setBusy('demo');
    try {
      await loginAsDemo();
    } catch {
      // Same as above.
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel — hidden on small screens where the form is the whole story. */}
      <section className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(60rem 40rem at 10% 10%, rgba(99,102,241,0.45), transparent 60%), radial-gradient(50rem 35rem at 90% 90%, rgba(217,70,239,0.35), transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative flex items-center gap-2.5 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <MessagesSquare className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">{t('app.name')}</span>
        </div>

        <div className="relative">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-md text-balance text-4xl font-bold leading-tight text-white"
          >
            {t('app.tagline')}
          </motion.h1>

          <ul className="mt-8 space-y-3">
            {FEATURES.map((feature, index) => (
              <motion.li
                key={feature.key}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.1 + index * 0.07 }}
                className="flex items-center gap-3 text-white/85"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-base backdrop-blur">
                  {feature.emoji}
                </span>
                <span className="text-[15px]">{copy[feature.key]}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/50">
          React · Socket.IO · Express · MongoDB
        </p>
      </section>

      {/* Form panel */}
      <section className="relative flex flex-col bg-surface">
        <div className="flex justify-end p-4">
          <LanguageSwitcher />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <div className="mb-8 lg:hidden">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                <MessagesSquare className="h-5 w-5" />
              </span>
            </div>

            <h2 className="text-2xl font-bold text-ink">
              {isRegister ? t('auth.createTitle') : t('auth.welcomeBack')}
            </h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              {isRegister ? t('auth.createSubtitle') : t('auth.signInSubtitle')}
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              {isRegister && (
                <Input
                  name="name"
                  label={t('auth.name')}
                  placeholder={t('auth.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  minLength={2}
                  leading={<UserIcon className="h-4 w-4" />}
                />
              )}

              <Input
                name="email"
                type="email"
                label={t('auth.email')}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                dir="ltr"
                leading={<AtSign className="h-4 w-4" />}
              />

              <Input
                name="password"
                type={showPassword ? 'text' : 'password'}
                label={t('auth.password')}
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={6}
                dir="ltr"
                leading={<Lock className="h-4 w-4" />}
                trailing={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                }
              />

              {error && (
                <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={busy === 'form'}
                disabled={busy !== null}
              >
                {isRegister ? t('auth.signUp') : t('auth.signIn')}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-faint">{t('auth.demoTitle')}</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <button
              type="button"
              onClick={() => void enterDemo()}
              disabled={busy !== null}
              className={cn(
                'focus-ring group w-full rounded-2xl border border-dashed border-brand-500/40 p-4 text-start transition-colors',
                'hover:border-brand-500 hover:bg-brand-500/5 disabled:opacity-60',
                theme === 'dark' ? 'bg-brand-500/5' : 'bg-brand-50/60'
              )}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <Sparkles className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    {busy === 'demo' ? t('common.loading') : t('auth.demoButton')}
                  </span>
                  <span className="block font-mono text-xs text-ink-muted" dir="ltr">
                    {t('auth.demoHint')}
                  </span>
                </span>
              </span>
            </button>

            <p className="mt-8 text-center text-sm text-ink-muted">
              {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
              <Link
                to={isRegister ? '/login' : '/register'}
                className="font-medium text-brand-500 hover:underline"
              >
                {isRegister ? t('auth.signIn') : t('auth.signUp')}
              </Link>
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
