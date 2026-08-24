import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  format,
  formatDistanceToNowStrict,
  isThisYear,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns';
import { ar, enUS, tr } from 'date-fns/locale';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const LOCALES = { en: enUS, ar, tr } as const;

const localeOf = (code: string) => LOCALES[code as keyof typeof LOCALES] ?? enUS;

const toDate = (value: string | Date) => (typeof value === 'string' ? parseISO(value) : value);

/** Clock time for a message bubble. */
export const formatTime = (value: string | Date, lang = 'en') =>
  format(toDate(value), 'HH:mm', { locale: localeOf(lang) });

/** Compact stamp for the conversation list: time today, weekday this week, else a date. */
export function formatListStamp(value: string | Date, lang = 'en') {
  const date = toDate(value);
  const locale = localeOf(lang);
  if (isToday(date)) return format(date, 'HH:mm', { locale });
  if (isYesterday(date)) return format(date, 'EEE', { locale });
  if (isThisYear(date)) return format(date, 'd MMM', { locale });
  return format(date, 'dd/MM/yy', { locale });
}

/** Heading text for a day separator inside the thread. */
export function formatDayLabel(
  value: string | Date,
  lang: string,
  labels: { today: string; yesterday: string }
) {
  const date = toDate(value);
  if (isToday(date)) return labels.today;
  if (isYesterday(date)) return labels.yesterday;
  const locale = localeOf(lang);
  return isThisYear(date)
    ? format(date, 'EEEE, d MMMM', { locale })
    : format(date, 'd MMMM yyyy', { locale });
}

export const formatRelative = (value: string | Date, lang = 'en') =>
  formatDistanceToNowStrict(toDate(value), { addSuffix: true, locale: localeOf(lang) });

/** Same calendar day? Used to decide where day separators go. */
export const isSameDay = (a: string | Date, b: string | Date) =>
  format(toDate(a), 'yyyy-MM-dd') === format(toDate(b), 'yyyy-MM-dd');

export function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => [...part][0] ?? '')
    .join('')
    .toUpperCase();

export const isImageMime = (mime: string) => mime.startsWith('image/');

/** Debounce that keeps the latest arguments and exposes a cancel handle. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Highlights every occurrence of `query` by splitting the text around it. */
export function splitOnQuery(text: string, query: string) {
  if (!query.trim()) return [{ text, match: false }];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .split(new RegExp(`(${escaped})`, 'ig'))
    .filter(Boolean)
    .map((part) => ({ text: part, match: part.toLowerCase() === query.toLowerCase() }));
}
