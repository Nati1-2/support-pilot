import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-10 text-center', className)}>
      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 mb-3 border border-neutral-200/60">
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-neutral-800">{title}</h4>
      <p className="text-xs text-neutral-500 max-w-sm mt-1 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="secondary" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
