import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  badge,
  trend,
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-white border border-neutral-200/80 rounded-xl p-5 shadow-card hover:border-neutral-300 transition-all flex flex-col justify-between',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{label}</span>
        {Icon && (
          <div className="w-7 h-7 rounded-md bg-neutral-50 border border-neutral-200/50 flex items-center justify-center text-neutral-500">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-neutral-900">{value}</span>
        {badge}
      </div>

      {(subtext || trend) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
          {trend && (
            <span
              className={cn(
                'font-medium text-[11px] px-1 py-0.5 rounded',
                trend.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-700'
              )}
            >
              {trend.value}
            </span>
          )}
          {subtext && <span className="truncate">{subtext}</span>}
        </div>
      )}
    </div>
  );
};
