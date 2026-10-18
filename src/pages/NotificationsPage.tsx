import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { formatDateTime, relativeTime } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui';

export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { profile } = useSession();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifications', 'page', profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

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

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <>
      <PageHeader title={t('notifications.title')} />

      <Card>
        <CardHeader
          title={t('notifications.title')}
          description={
            unread > 0 ? `${unread} ${t('common.none').toLowerCase()}` : undefined
          }
          action={
            unread > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                loading={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                {t('notifications.markAllRead')}
              </Button>
            ) : null
          }
        />
        <CardBody>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState title={t('notifications.empty')} />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const body = (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-navy-900">
                        {item.title}
                      </p>
                      {item.read_at ? null : (
                        <Badge tone="blue">{t('common.yes')}</Badge>
                      )}
                    </div>
                    {item.body ? (
                      <p className="mt-0.5 text-sm text-navy-500">{item.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-navy-300">
                      {relativeTime(item.created_at, lang)} ·{' '}
                      {formatDateTime(item.created_at, lang)}
                    </p>
                  </>
                );

                return (
                  <li key={item.id} className="py-3">
                    {item.link ? (
                      <Link to={item.link} className="block hover:opacity-80">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
