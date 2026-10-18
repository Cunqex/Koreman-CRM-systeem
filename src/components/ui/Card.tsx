import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-line bg-white shadow-card',
        className,
      )}
    >
      {children}
    </section>
  );
}

type CardHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function CardHeader({
  title,
  description,
  action,
  className,
}: CardHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-navy-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardProps) {
  return (
    <footer className={cn('border-t border-line px-5 py-3', className)}>
      {children}
    </footer>
  );
}
