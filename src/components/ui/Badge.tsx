import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'blue'
  | 'green'
  | 'amber'
  | 'red'
  | 'grey'
  | 'purple'
  | 'navy';

const tones: Record<BadgeTone, string> = {
  blue: 'bg-status-bluebg text-status-bluefg',
  green: 'bg-status-greenbg text-status-greenfg',
  amber: 'bg-status-amberbg text-status-amberfg',
  red: 'bg-status-redbg text-status-redfg',
  grey: 'bg-status-greybg text-status-greyfg',
  purple: 'bg-status-purplebg text-status-purplefg',
  navy: 'bg-navy-950 text-white',
};

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
  title?: string;
};

export function Badge({
  children,
  tone = 'grey',
  icon,
  className,
  title,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
