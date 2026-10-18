import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Hit = { id: string; label: string; sub: string | null; to: string };

/**
 * Searches architects, projects and orders. Scope comes from RLS, so this only
 * ever returns rows the signed-in user is allowed to see.
 */
export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const pattern = `%${debounced}%`;
      const [architects, projects, orders] = await Promise.all([
        supabase
          .from('architects')
          .select('id, first_name, last_name, company_name, city')
          .or(
            `first_name.ilike.${pattern},last_name.ilike.${pattern},company_name.ilike.${pattern},email.ilike.${pattern}`,
          )
          .limit(5),
        supabase
          .from('projects')
          .select('id, name, city, architect_id')
          .ilike('name', pattern)
          .limit(5),
        supabase
          .from('orders')
          .select('id, reference, order_date, status')
          .ilike('reference', pattern)
          .limit(5),
      ]);

      const groups: { titleKey: string; hits: Hit[] }[] = [
        {
          titleKey: 'search.architects',
          hits: (architects.data ?? []).map((row) => ({
            id: row.id,
            label: `${row.first_name} ${row.last_name}`,
            sub: row.company_name ?? row.city ?? null,
            to: `/architecten/${row.id}`,
          })),
        },
        {
          titleKey: 'search.projects',
          hits: (projects.data ?? []).map((row) => ({
            id: row.id,
            label: row.name,
            sub: row.city ?? null,
            to: `/projecten/${row.id}`,
          })),
        },
        {
          titleKey: 'search.orders',
          hits: (orders.data ?? []).map((row) => ({
            id: row.id,
            label: row.reference ?? row.id.slice(0, 8),
            sub: row.status,
            to: `/orders/${row.id}`,
          })),
        },
      ];
      return groups.filter((group) => group.hits.length > 0);
    },
  });

  function go(to: string) {
    setOpen(false);
    setTerm('');
    navigate(to);
  }

  return (
    <div ref={containerRef} className="relative max-w-xl flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-label={t('search.placeholder')}
        value={term}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        placeholder={t('search.placeholder')}
        className="h-10 w-full rounded-full border border-line bg-white pl-9 pr-3 text-sm placeholder:text-navy-300 focus:border-navy-400"
      />

      {open && debounced.length >= 2 ? (
        <div className="absolute left-0 right-0 top-12 z-30 max-h-96 overflow-y-auto rounded-xl border border-line bg-white py-2 shadow-pop">
          {isFetching ? (
            <p className="px-4 py-2 text-sm text-navy-400">
              {t('common.loading')}
            </p>
          ) : data && data.length > 0 ? (
            data.map((group) => (
              <div key={group.titleKey}>
                <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                  {t(group.titleKey)}
                </p>
                {group.hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => go(hit.to)}
                    className="block w-full px-4 py-2 text-left hover:bg-navy-50"
                  >
                    <span className="block text-sm font-medium text-navy-800">
                      {hit.label}
                    </span>
                    {hit.sub ? (
                      <span className="block text-xs text-navy-400">
                        {hit.sub}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          ) : (
            <p className="px-4 py-2 text-sm text-navy-400">
              {t('search.noResults')}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
