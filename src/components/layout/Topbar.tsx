import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, User } from 'lucide-react';
import { useSession } from '@/features/auth/SessionProvider';
import { setLanguage, type Language } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { GlobalSearch } from '@/features/search/GlobalSearch';
import { NotificationBell } from '@/features/notifications/NotificationBell';

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t, i18n } = useTranslation();
  const { profile, role, signOut } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = (i18n.resolvedLanguage ?? 'nl') as Language;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t('common.openMenu')}
        className="rounded-lg p-2 text-navy-600 hover:bg-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-2">
        <div
          role="group"
          aria-label={t('common.language')}
          className="hidden items-center rounded-full border border-line bg-white p-0.5 sm:flex"
        >
          {(['nl', 'en'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => void setLanguage(lang)}
              aria-pressed={current === lang}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors',
                current === lang
                  ? 'bg-navy-950 text-white'
                  : 'text-navy-400 hover:text-navy-700',
              )}
            >
              {lang}
            </button>
          ))}
        </div>

        <NotificationBell />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-950 text-[11px] font-semibold text-white">
              {initials(profile?.full_name)}
            </span>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-navy-700 sm:block">
              {profile?.full_name ?? '—'}
            </span>
          </button>

          {menuOpen ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-white shadow-pop"
              >
                <div className="border-b border-line px-4 py-3">
                  <p className="truncate text-sm font-medium text-navy-900">
                    {profile?.full_name ?? '—'}
                  </p>
                  <p className="truncate text-xs text-navy-400">
                    {profile?.email}
                  </p>
                  <p className="mt-1 text-xs text-navy-400">
                    {role ? t(`roles.${role}`) : ''}
                  </p>
                </div>
                <div className="flex items-center justify-between px-4 py-2 sm:hidden">
                  <span className="text-sm text-navy-600">
                    {t('common.language')}
                  </span>
                  <div className="flex gap-1">
                    {(['nl', 'en'] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => void setLanguage(lang)}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold uppercase',
                          current === lang
                            ? 'bg-navy-950 text-white'
                            : 'text-navy-400',
                        )}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
                <a
                  href="#/profiel"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50"
                >
                  <User className="h-4 w-4" />
                  {t('nav.profile')}
                </a>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-navy-700 hover:bg-navy-50"
                >
                  <LogOut className="h-4 w-4" />
                  {t('nav.signOut')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
