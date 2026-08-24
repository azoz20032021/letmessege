import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';

import { assetUrl } from '@/lib/api';
import { cn, initialsOf } from '@/lib/utils';

// ── Button ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-soft hover:bg-brand-500 active:bg-brand-700 disabled:bg-brand-600/50',
  secondary:
    'bg-surface-raised text-ink border border-line hover:bg-surface-muted active:bg-line/60',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  icon: 'h-10 w-10',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'focus-ring inline-flex select-none items-center justify-center rounded-xl font-medium transition-all',
        'disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

// ── Input ───────────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, leading, trailing, id, ...props },
  ref
) {
  const inputId = id ?? props.name;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-muted">
          {label}
        </label>
      )}
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-ink-faint">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(
            'focus-ring h-11 w-full rounded-xl border bg-surface-raised px-3.5 text-[15px] text-ink',
            'placeholder:text-ink-faint transition-colors',
            leading && 'ps-10',
            trailing && 'pe-10',
            error ? 'border-red-500/60' : 'border-line hover:border-ink-faint/50',
            className
          )}
          {...props}
        />
        {trailing && (
          <span className="absolute inset-y-0 end-0 flex items-center pe-1.5">{trailing}</span>
        )}
      </div>
      {(error || hint) && (
        <p className={cn('mt-1.5 text-xs', error ? 'text-red-500' : 'text-ink-faint')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(
  function Textarea({ className, label, id, ...props }, ref) {
    const textareaId = id ?? props.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="mb-1.5 block text-sm font-medium text-ink-muted">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'focus-ring w-full resize-none rounded-xl border border-line bg-surface-raised p-3 text-[15px]',
            'text-ink placeholder:text-ink-faint transition-colors hover:border-ink-faint/50',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

// ── Avatar ──────────────────────────────────────────────────────────────────
const AVATAR_SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-2xl',
} as const;

/**
 * The avatar palette lives here, keyed by the colour the API stores.
 *
 * These have to be literal class strings for Tailwind's scanner to emit them —
 * building them from a value that only exists at runtime would leave the
 * gradient undefined and the initials floating on nothing.
 */
const AVATAR_GRADIENTS: Record<string, string> = {
  violet: 'from-violet-500 to-fuchsia-600',
  sky: 'from-sky-500 to-indigo-600',
  emerald: 'from-emerald-500 to-teal-600',
  amber: 'from-amber-500 to-orange-600',
  rose: 'from-rose-500 to-pink-600',
  cyan: 'from-cyan-500 to-blue-600',
};

const DEFAULT_GRADIENT = 'from-brand-500 to-brand-700';

interface AvatarProps {
  name: string;
  src?: string;
  /** Colour key from the API (`violet`, `sky`, …). */
  color?: string;
  size?: keyof typeof AVATAR_SIZES;
  online?: boolean;
  className?: string;
}

export function Avatar({ name, src, color, size = 'md', online, className }: AvatarProps) {
  const gradient = (color && AVATAR_GRADIENTS[color]) || DEFAULT_GRADIENT;

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={assetUrl(src)}
          alt={name}
          loading="lazy"
          className={cn('rounded-full object-cover ring-1 ring-line', AVATAR_SIZES[size])}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            'flex items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white',
            gradient,
            AVATAR_SIZES[size]
          )}
        >
          {initialsOf(name)}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute -bottom-0.5 -end-0.5 rounded-full ring-2 ring-surface transition-colors',
            size === 'xs' || size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3',
            online ? 'bg-emerald-500' : 'bg-ink-faint/50'
          )}
        />
      )}
    </span>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5',
        'text-[11px] font-semibold leading-none tabular-nums',
        'bg-brand-600 text-white',
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative flex max-h-[90dvh] w-full flex-col overflow-hidden bg-surface shadow-lift',
              'rounded-t-3xl sm:rounded-3xl',
              size === 'sm' && 'sm:max-w-sm',
              size === 'md' && 'sm:max-w-lg',
              size === 'lg' && 'sm:max-w-2xl'
            )}
          >
            {title && (
              <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{title}</h2>
                  {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                  <X className="h-5 w-5" />
                </Button>
              </header>
            )}
            <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────
export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cn('h-5 w-5 animate-spin text-ink-faint', className)} aria-hidden />
);

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-ink-faint">
          {icon}
        </div>
      )}
      <p className="text-balance font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-xs text-balance text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Shimmering placeholder used while a list is loading. */
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('relative overflow-hidden rounded-lg bg-surface-muted', className)}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-ink/[0.06] to-transparent" />
  </div>
);
