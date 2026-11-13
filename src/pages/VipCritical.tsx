import React, { useState, useEffect } from 'react';
import { Flame, ShieldAlert, ArrowRight, UserCheck, DollarSign, Clock } from 'lucide-react';
import { Ticket } from '../types';
import { api } from '../lib/api';
import { Button } from '../components/common/Button';
import { VIPBadge, PriorityBadge, SentimentBadge, StatusBadge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { EscalationSummaryCard } from '../components/tickets/EscalationSummaryCard';
import { formatCurrency, formatRelativeTime } from '../lib/utils';

interface VipCriticalProps {
  onNavigateTicket: (ticketId: string) => void;
}

export const VipCritical: React.FC<VipCriticalProps> = ({ onNavigateTicket }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVipTickets = async () => {
    try {
      setLoading(true);
      const data = await api.getTickets({ queue: 'vip' });
      // Sort by churn risk first, then customer spend
      data.sort((a, b) => (b.vip_churn_risk ? 1 : 0) - (a.vip_churn_risk ? 1 : 0));
      setTickets(data);
    } catch (e) {
      console.warn('Error fetching VIP tickets', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVipTickets();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-600" />
            VIP / Critical Retention Queue
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Prioritized cases for high-LTV customers (&gt;$200 lifetime spend) experiencing issues or negative sentiment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700">
            {tickets.filter((t) => t.vip_churn_risk).length} Active Churn Risks
          </span>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200/80 p-12 shadow-subtle">
          <EmptyState
            icon={UserCheck}
            title="No VIP churn risks detected"
            description="All high-value customer accounts are currently in healthy standing."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <div
              key={t.id}
              className={`bg-white border rounded-2xl p-6 shadow-subtle hover:border-neutral-300 transition-all space-y-4 ${
                t.vip_churn_risk
                  ? 'border-rose-200 ring-1 ring-rose-200/50 bg-gradient-to-b from-rose-50/20 to-white'
                  : 'border-neutral-200/80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs text-neutral-400">#{t.id.slice(-6)}</span>
                  <h3 className="text-sm font-semibold text-neutral-900">{t.title}</h3>
                  <VIPBadge churnRisk={t.vip_churn_risk} />
                  <PriorityBadge priority={t.priority} />
                  {t.sentiment && <SentimentBadge sentiment={t.sentiment} />}
                  <StatusBadge status={t.status} />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-neutral-400">
                    {formatRelativeTime(t.created_at)}
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onNavigateTicket(t.id)}
                    icon={ArrowRight}
                    iconPosition="right"
                  >
                    Open VIP Case
                  </Button>
                </div>
              </div>

              {/* VIP Context Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-neutral-50/70 rounded-lg text-xs border border-neutral-200/50">
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">VIP Account</span>
                  <span className="font-semibold text-neutral-900">{t.customer_name || 'Customer'}</span>
                  <span className="text-neutral-500 block text-[11px]">{t.customer_email}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Cumulative LTV</span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(t.customer?.total_spent || t.customer_spent || 0)}
                  </span>
                  <span className="text-neutral-500 block text-[11px]">
                    {t.customer?.orders_count || 1} prior orders
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Associated Order</span>
                  <span className="font-medium text-neutral-900">{t.order?.order_number || t.order_id || 'N/A'}</span>
                  {t.order && (
                    <span className="text-neutral-500 block text-[11px]">
                      Status: {t.order.status}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Risk Classification</span>
                  <span className={`font-semibold ${t.vip_churn_risk ? 'text-rose-600' : 'text-neutral-700'}`}>
                    {t.vip_churn_risk ? 'CRITICAL CHURN RISK' : 'Standard VIP Care'}
                  </span>
                </div>
              </div>

              {/* 3-Bullet Escalation Summary */}
              {t.escalation_summary && (
                <EscalationSummaryCard summary={t.escalation_summary} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
