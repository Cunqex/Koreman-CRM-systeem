import { useId, type ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

export type SparkTone = 'purple' | 'blue' | 'green';

const strokes: Record<SparkTone, string> = {
  purple: '#7C5CFC',
  blue: '#3B82F6',
  green: '#22C55E',
};

type KpiCardProps = {
  label: string;
  value: ReactNode;
  /** Values for the sparkline, oldest first. */
  series?: number[];
  tone?: SparkTone;
  /** Change vs. the previous period, in percent. */
  deltaPct?: number | null;
  deltaLabel?: string;
  hint?: string;
  loading?: boolean;
  className?: string;
};

export function KpiCard({
  label,
  value,
  series,
  tone = 'purple',
  deltaPct,
  deltaLabel,
  hint,
  loading = false,
  className,
}: KpiCardProps) {
  const gradientId = useId().replace(/:/g, '');
  const data = (series ?? []).map((v, i) => ({ i, v }));
  const hasDelta = deltaPct !== null && deltaPct !== undefined;
  const positive = (deltaPct ?? 0) >= 0;

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-xl border border-line bg-white p-5 shadow-card',
          className,
        )}
      >
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-28" />
        <Skeleton className="mt-4 h-10 w-full" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-line bg-white p-5 shadow-card',
        className,
      )}
    >
      <p className="text-sm text-navy-400">{label}</p>
      <p className="mt-1 text-kpi tabular-nums text-navy-900">{value}</p>

      {data.length > 1 ? (
        <div className="mt-3 h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokes[tone]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={strokes[tone]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={strokes[tone]}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {hasDelta ? (
        <p
          className={cn(
            'mt-3 inline-flex items-center gap-1 text-xs font-medium',
            positive ? 'text-status-greenfg' : 'text-status-redfg',
          )}
        >
          {positive ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {new Intl.NumberFormat('nl-NL', {
            maximumFractionDigits: 1,
            signDisplay: 'always',
          }).format(deltaPct ?? 0)}
          % <span className="font-normal text-navy-400">{deltaLabel}</span>
        </p>
      ) : hint ? (
        <p className="mt-3 text-xs text-navy-400">{hint}</p>
      ) : null}
    </div>
  );
}
