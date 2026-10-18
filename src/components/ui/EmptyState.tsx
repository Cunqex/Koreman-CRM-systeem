import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy-100 text-navy-400">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-navy-800">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-navy-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
  className,
}: Omit<EmptyStateProps, 'icon'>) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      <p className="text-sm font-semibold text-status-redfg">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-navy-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
