import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { TableSkeleton } from './Skeleton';
import { EmptyState, ErrorState } from './EmptyState';
import { Button } from './Button';

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Rendered cell. */
  cell: (row: T) => ReactNode;
  /** Value used for sorting and for the free-text filter. */
  sortValue?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  align?: 'left' | 'right';
  className?: string;
  headerClassName?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  /** Free-text filter applied over every column that exposes a sortValue. */
  search?: string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (keys: string[]) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  /** Toegankelijke naam van de tabel voor schermlezers. */
  label?: string;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  search = '',
  pageSize = 25,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
  selectable = false,
  selected = [],
  onSelectedChange,
  initialSort,
  label,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      columns.some((column) => {
        const value = column.sortValue?.(row);
        return value !== null && value !== undefined
          ? String(value).toLowerCase().includes(needle)
          : false;
      }),
    );
  }, [rows, columns, search]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return filtered;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * factor;
      }
      return String(av).localeCompare(String(bv), 'nl') * factor;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: string) {
    setPage(0);
    setSort((current) => {
      if (current?.key !== key) return { key, dir: 'asc' };
      if (current.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  function toggleRow(key: string) {
    if (!onSelectedChange) return;
    onSelectedChange(
      selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key],
    );
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every((row) => selected.includes(rowKey(row)));

  if (error) {
    return (
      <ErrorState
        title={t('common.loadErrorTitle')}
        description={t('common.loadErrorBody')}
      />
    );
  }

  if (loading) {
    return <TableSkeleton cols={columns.length} />;
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? t('common.emptyTitle')}
        description={emptyDescription ?? t('common.emptyBody')}
        action={emptyAction}
      />
    );
  }

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table
          aria-label={label ?? emptyTitle}
          className="w-full min-w-[40rem] border-collapse text-sm"
        >
          <thead>
            <tr className="border-b border-line">
              {selectable ? (
                <th scope="col" className="w-10 px-5 py-3">
                  <input
                    type="checkbox"
                    aria-label={t('common.selectAll')}
                    checked={allVisibleSelected}
                    onChange={() => {
                      if (!onSelectedChange) return;
                      const keys = visible.map(rowKey);
                      onSelectedChange(
                        allVisibleSelected
                          ? selected.filter((k) => !keys.includes(k))
                          : Array.from(new Set([...selected, ...keys])),
                      );
                    }}
                    className="h-4 w-4 rounded border-line text-navy-950"
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                const sortable = column.sortable !== false && !!column.sortValue;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      isSorted
                        ? sort!.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    className={cn(
                      'px-5 py-3 text-left font-semibold text-navy-700',
                      column.align === 'right' && 'text-right',
                      column.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-navy-950',
                          column.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {column.header}
                        {isSorted ? (
                          sort!.dir === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-navy-300" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-navy-50/60',
                  )}
                >
                  {selectable ? (
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(key)}
                        onChange={() => toggleRow(key)}
                        className="h-4 w-4 rounded border-line text-navy-950"
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-5 py-4 align-middle text-navy-700',
                        column.align === 'right' && 'text-right tabular-nums',
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm text-navy-500">
          <span>
            {t('common.pagination', {
              from: safePage * pageSize + 1,
              to: Math.min(sorted.length, (safePage + 1) * pageSize),
              total: sorted.length,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              {t('common.previous')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
