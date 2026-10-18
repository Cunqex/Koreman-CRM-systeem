import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { formatDayHeading, formatTime, initials } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import { EmptyState } from './EmptyState';

export type TimelineEntry = {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** Bold lead-in, typically the architect name. */
  subject?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** Name used for the avatar initials. */
  actor?: string | null;
  icon?: ReactNode;
  badges?: ReactNode;
  onClick?: () => void;
};

type TimelineProps = {
  entries: TimelineEntry[];
  emptyTitle?: string;
  className?: string;
};

export function Timeline({ entries, emptyTitle, className }: TimelineProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;

  if (entries.length === 0) {
    return <EmptyState title={emptyTitle ?? t('common.emptyTimeline')} />;
  }

  // Entries arrive newest first; group them under one heading per day.
  const groups: { day: string; items: TimelineEntry[] }[] = [];
  for (const entry of entries) {
    const day = entry.at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(entry);
    else groups.push({ day, items: [entry] });
  }

  return (
    <div className={cn('px-5 py-4', className)}>
      {groups.map((group) => (
        <Fragment key={group.day}>
          <p className="sticky top-0 z-[1] bg-white/90 py-2 text-xs font-semibold uppercase tracking-wide text-navy-400 backdrop-blur">
            {formatDayHeading(
              group.items[0]!.at,
              lang,
              t('common.today'),
              t('common.yesterday'),
            )}
          </p>
          <ol className="relative ml-[3.25rem] border-l border-line">
            {group.items.map((entry) => (
              <li key={entry.id} className="relative py-3 pl-6">
                <span className="absolute -left-[3.25rem] top-4 w-10 text-right text-xs tabular-nums text-navy-400">
                  {formatTime(entry.at)}
                </span>
                <span className="absolute -left-[0.4375rem] top-5 h-[0.875rem] w-[0.875rem] rounded-full border-2 border-white bg-navy-200" />
                <div
                  onClick={entry.onClick}
                  className={cn(
                    'flex gap-3 rounded-xl border border-line bg-white p-3',
                    entry.onClick && 'cursor-pointer hover:border-navy-200',
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-100 text-[11px] font-semibold text-navy-600">
                    {entry.icon ?? initials(entry.actor)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-navy-700">
                      {entry.subject ? (
                        <span className="font-semibold text-navy-900">
                          {entry.subject}
                        </span>
                      ) : null}
                      {entry.subject ? ' — ' : null}
                      {entry.title}
                    </p>
                    {entry.body ? (
                      <p className="mt-1 whitespace-pre-line text-sm text-navy-400">
                        {entry.body}
                      </p>
                    ) : null}
                    {entry.badges ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {entry.badges}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Fragment>
      ))}
    </div>
  );
}
