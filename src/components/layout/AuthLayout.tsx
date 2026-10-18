import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { setLanguage, type Language } from '@/lib/i18n';
import { cn } from '@/lib/cn';

/** Gecentreerde kaart op het donkere navy, gebruikt door alle auth-schermen. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? 'nl') as Language;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-950 px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-2xl font-bold tracking-tight text-white">
          {t('app.name')}
        </p>
        <p className="text-sm text-white/50">{t('app.portal')}</p>
      </div>

      <main className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop sm:p-8">
        <h1 className="text-xl font-bold text-navy-950">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-navy-400">{subtitle}</p>
        ) : null}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </main>

      <div
        role="group"
        aria-label={t('common.language')}
        className="mt-6 flex items-center gap-1"
      >
        {(['nl', 'en'] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => void setLanguage(lang)}
            aria-pressed={current === lang}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold uppercase transition-colors',
              current === lang
                ? 'bg-white/15 text-white'
                : 'text-white/40 hover:text-white/70',
            )}
          >
            {lang}
          </button>
        ))}
      </div>
    </div>
  );
}
