import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { nl, enGB } from 'date-fns/locale';

const locales = { nl, en: enGB } as const;
export type AppLanguage = keyof typeof locales;

const eur = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const eurCompact = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** Amounts are always excl. VAT across this portal. */
export function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return eur.format(Number(value));
}

export function moneyCompact(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return eurCompact.format(Number(value));
}

export function percent(value: number | string | null | undefined, digits = 1) {
  if (value === null || value === undefined || value === '') return '—';
  const formatted = new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value));
  return formatted + '%';
}

export function number(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('nl-NL').format(value);
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDate(
  value: string | Date | null | undefined,
  lang: AppLanguage = 'nl',
  pattern = 'd MMM yyyy',
) {
  const date = toDate(value);
  return date ? format(date, pattern, { locale: locales[lang] }) : '—';
}

export function formatDateTime(
  value: string | Date | null | undefined,
  lang: AppLanguage = 'nl',
) {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, 'd MMM yyyy HH:mm', { locale: locales[lang] });
}

export function formatTime(value: string | Date | null | undefined) {
  const date = toDate(value);
  return date ? format(date, 'HH:mm') : '—';
}

/** Day heading for timelines, e.g. "Vandaag, 18 okt". */
export function formatDayHeading(
  value: string | Date | null | undefined,
  lang: AppLanguage,
  todayLabel: string,
  yesterdayLabel: string,
) {
  const date = toDate(value);
  if (!date) return '—';
  const dayKey = format(date, 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(Date.now() - 86_400_000, 'yyyy-MM-dd');
  const short = format(date, 'd MMM', { locale: locales[lang] });
  if (dayKey === today) return todayLabel + ', ' + short;
  if (dayKey === yesterday) return yesterdayLabel + ', ' + short;
  return format(date, 'EEEE d MMMM yyyy', { locale: locales[lang] });
}

export function relativeTime(
  value: string | Date | null | undefined,
  lang: AppLanguage = 'nl',
) {
  const date = toDate(value);
  if (!date) return '—';
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: locales[lang],
  });
}

export function initials(name: string | null | undefined) {
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}
