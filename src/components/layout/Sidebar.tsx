import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { useSession } from '@/features/auth/SessionProvider';
import { visibleGroups } from './navItems';

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  hasSubagents: boolean;
};

export function Sidebar({ open, onClose, hasSubagents }: SidebarProps) {
  const { t } = useTranslation();
  const { role, profile } = useSession();
  const groups = visibleGroups(role, { hasSubagents });

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col bg-navy-950 text-white transition-transform lg:visible lg:translate-x-0',
          open ? 'translate-x-0' : 'invisible -translate-x-full',
        )}
        aria-label={t('nav.groupMain')}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <div>
            <p className="text-lg font-bold tracking-tight">{t('app.name')}</p>
            <p className="text-xs text-white/50">{t('app.portal')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.closeMenu')}
            className="rounded-lg p-1 text-white/70 hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.labelKey} className="mb-5">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {t(`nav.${group.labelKey}`)}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={`${item.to}-${item.labelKey}`}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-white text-navy-950'
                              : 'text-white/70 hover:bg-white/10 hover:text-white',
                          )
                        }
                      >
                        <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
                        <span className="truncate">
                          {t(`nav.${item.labelKey}`)}
                        </span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
              {initials(profile?.full_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {profile?.full_name ?? '—'}
              </p>
              <p className="truncate text-xs text-white/50">
                {role ? t(`roles.${role}`) : ''}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
