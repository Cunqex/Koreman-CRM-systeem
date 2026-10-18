import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Local filter box shown at the right of the title row. */
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  action?: ReactNode;
  tabs?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  search,
  action,
  tabs,
  className,
}: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className={cn('mb-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-navy-950 sm:text-[1.75rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-navy-400">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {search ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
              <input
                type="search"
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder ?? t('common.filter')}
                className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm placeholder:text-navy-300 focus:border-navy-400 sm:w-64"
              />
            </div>
          ) : null}
          {action}
        </div>
      </div>
      {tabs ? <div className="mt-4">{tabs}</div> : null}
    </header>
  );
}
