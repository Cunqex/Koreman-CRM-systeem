import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

export type TabItem = {
  key: string;
  label: ReactNode;
  count?: number;
};

type TabsProps = {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
};

const base =
  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors';
const activeCls = 'bg-navy-950 text-white';
const idleCls = 'text-navy-500 hover:bg-navy-100/70 hover:text-navy-800';

/** Controlled tabs rendered as text links with a navy pill for the active one. */
export function Tabs({ items, active, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn('flex flex-wrap items-center gap-1', className)}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(item.key)}
            className={cn(base, isActive ? activeCls : idleCls)}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px]',
                  isActive ? 'bg-white/20' : 'bg-navy-100 text-navy-600',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type LinkTabItem = {
  to: string;
  label: ReactNode;
  end?: boolean;
};

/** Same visual language, but each tab is a route. */
export function LinkTabs({
  items,
  className,
}: {
  items: LinkTabItem[];
  className?: string;
}) {
  return (
    <nav className={cn('flex flex-wrap items-center gap-1', className)}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(base, isActive ? activeCls : idleCls)
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
