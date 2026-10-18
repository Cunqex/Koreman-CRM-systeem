import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'error';

const styles: Record<Tone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'bg-status-bluebg text-status-bluefg',
    icon: <Info className="h-4 w-4 shrink-0" />,
  },
  success: {
    box: 'bg-status-greenbg text-status-greenfg',
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  },
  warning: {
    box: 'bg-status-amberbg text-status-amberfg',
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
  },
  error: {
    box: 'bg-status-redbg text-status-redfg',
    icon: <XCircle className="h-4 w-4 shrink-0" />,
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const style = styles[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2 rounded-lg px-3 py-2.5 text-sm', style.box, className)}
    >
      {style.icon}
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5' : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}
