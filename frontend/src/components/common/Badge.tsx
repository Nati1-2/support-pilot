import React from 'react';
import { cn } from '../../lib/utils';
import { TicketPriority, TicketStatus, Sentiment } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className,
}) => {
  const variantStyles = {
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200/60',
    primary: 'bg-blue-50 text-blue-700 border-blue-200/60',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/60',
    destructive: 'bg-rose-50 text-rose-700 border-rose-200/60',
    purple: 'bg-slate-100 text-slate-800 border-slate-300',
    outline: 'bg-transparent text-neutral-600 border-neutral-200',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-1.5 py-0.5 leading-none',
    md: 'text-xs px-2 py-0.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium border rounded-md transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: TicketStatus; className?: string }> = ({ status, className }) => {
  switch (status) {
    case 'open':
      return <Badge variant="primary" className={className}>Open</Badge>;
    case 'needs_approval':
      return <Badge variant="warning" className={className}>Needs Approval</Badge>;
    case 'resolved':
      return <Badge variant="success" className={className}>Resolved</Badge>;
    case 'escalated':
      return <Badge variant="destructive" className={className}>Escalated</Badge>;
    case 'closed':
      return <Badge variant="neutral" className={className}>Closed</Badge>;
    default:
      return <Badge variant="neutral" className={className}>{status}</Badge>;
  }
};

export const PriorityBadge: React.FC<{ priority: TicketPriority; className?: string }> = ({ priority, className }) => {
  switch (priority) {
    case 'urgent':
      return <Badge variant="destructive" className={className}>Urgent</Badge>;
    case 'high':
      return <Badge variant="warning" className={className}>High</Badge>;
    case 'medium':
      return <Badge variant="neutral" className={className}>Medium</Badge>;
    case 'low':
      return <Badge variant="outline" className={className}>Low</Badge>;
    default:
      return <Badge variant="neutral" className={className}>{priority}</Badge>;
  }
};

export const SentimentBadge: React.FC<{ sentiment?: Sentiment; className?: string }> = ({ sentiment, className }) => {
  if (!sentiment) return null;
  switch (sentiment) {
    case 'positive':
      return <Badge variant="success" size="sm" className={className}>Positive</Badge>;
    case 'neutral':
      return <Badge variant="neutral" size="sm" className={className}>Neutral</Badge>;
    case 'negative':
      return <Badge variant="warning" size="sm" className={className}>Negative</Badge>;
    case 'frustrated':
      return <Badge variant="destructive" size="sm" className={className}>Frustrated</Badge>;
    default:
      return null;
  }
};

export const VIPBadge: React.FC<{ churnRisk?: boolean; className?: string }> = ({ churnRisk, className }) => {
  if (churnRisk) {
    return (
      <Badge variant="destructive" className={cn('gap-1 font-semibold uppercase tracking-wider text-[10px]', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
        VIP Churn Risk
      </Badge>
    );
  }
  return (
    <Badge variant="primary" className={cn('gap-1 font-medium text-[11px]', className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
      VIP
    </Badge>
  );
};
