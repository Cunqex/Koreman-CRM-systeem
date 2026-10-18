import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { relativeTime } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { profile } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ['notifications', profile?.id],
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });

  const unread = items.filter((item) => !item.read_at);

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('notifications.title')}
        aria-expanded={open}
        className="relative rounded-full border border-line bg-white p-2 text-navy-600 hover:text-navy-900"
      >
        <Bell className="h-[1.125rem] w-[1.125rem]" />
        {unread.length > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-semibold text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-navy-900">
                {t('notifications.title')}
              </p>
              {unread.length > 0 ? (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  className="text-xs font-medium text-accent-blue hover:underline"
                >
                  {t('notifications.markAllRead')}
                </button>
              ) : null}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-navy-400">
                  {t('notifications.empty')}
                </p>
              ) : (
                items.map((item) => {
                  const content = (
                    <>
                      <p className="text-sm font-medium text-navy-800">
                        {item.title}
                      </p>
                      {item.body ? (
                        <p className="mt-0.5 text-xs text-navy-500">
                          {item.body}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-navy-300">
                        {relativeTime(item.created_at, lang)}
                      </p>
                    </>
                  );
                  return (
                    <div
                      key={item.id}
                      className={
                        item.read_at
                          ? 'border-b border-line px-4 py-3 last:border-0'
                          : 'border-b border-line bg-status-bluebg/40 px-4 py-3 last:border-0'
                      }
                    >
                      {item.link ? (
                        <Link to={item.link} onClick={() => setOpen(false)}>
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <Link
              to="/meldingen"
              onClick={() => setOpen(false)}
              className="block border-t border-line px-4 py-2.5 text-center text-xs font-medium text-accent-blue hover:bg-navy-50"
            >
              {t('notifications.viewAll')}
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
