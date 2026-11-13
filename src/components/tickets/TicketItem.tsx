import React from 'react';
import { cn, formatRelativeTime } from '../../lib/utils';
import { Ticket } from '../../types';
import { StatusBadge, PriorityBadge, VIPBadge, Badge } from '../common/Badge';
import { Bot, AlertCircle } from 'lucide-react';

interface TicketItemProps {
  ticket: Ticket;
  isSelected?: boolean;
  onSelect: (ticket: Ticket) => void;
}

export const TicketItem: React.FC<TicketItemProps> = ({ ticket, isSelected, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(ticket)}
      className={cn(
        'p-3.5 border-b border-neutral-100 hover:bg-neutral-50/80 transition-colors cursor-pointer select-none relative',
        isSelected ? 'bg-neutral-100/70 border-l-2 border-l-neutral-900' : ''
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-neutral-900 truncate">
            {ticket.customer_name || 'Customer'}
          </span>
          {ticket.is_vip && <VIPBadge churnRisk={ticket.vip_churn_risk} />}
        </div>
        <span className="text-[10px] text-neutral-400 shrink-0">
          {formatRelativeTime(ticket.updated_at || ticket.created_at)}
        </span>
      </div>

      <p className="text-xs font-medium text-neutral-800 line-clamp-1 mb-2">
        {ticket.title}
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {ticket.intent && (
            <Badge variant="outline" size="sm">
              {ticket.intent.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>

        {ticket.ai_confidence !== undefined && ticket.ai_confidence !== null && (
          <div
            className="flex items-center gap-1 text-[11px] font-mono text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200/60 shrink-0"
            title="AI Confidence Score"
          >
            <Bot className="w-3 h-3 text-neutral-400" />
            <span>{Math.round(ticket.ai_confidence * 100)}%</span>
          </div>
        )}
      </div>

      {ticket.requires_approval && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50/80 border border-amber-200/60 rounded px-2 py-0.5 font-medium">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">Human review required</span>
        </div>
      )}
    </div>
  );
};
