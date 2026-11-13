import React, { useState, useEffect } from 'react';
import {
  Inbox,
  CheckSquare,
  ShieldCheck,
  TrendingUp,
  Clock,
  Zap,
  ArrowRight,
  Flame,
  Bot,
  Truck,
  Sparkles,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { Badge, StatusBadge, PriorityBadge, VIPBadge } from '../components/common/Badge';
import { OverviewMetrics, Ticket } from '../types';
import { api } from '../lib/api';
import { formatRelativeTime } from '../lib/utils';

interface OverviewProps {
  onNavigate: (path: string) => void;
  onSelectTicket: (ticketId: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ onNavigate, onSelectTicket }) => {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [m, t, s] = await Promise.all([
        api.getOverviewMetrics(),
        api.getTickets({ limit: 6 } as any),
        api.getAgentStatus(),
      ]);
      setMetrics(m);
      setRecentTickets(t.slice(0, 6));
      setAgentStatus(s);
    } catch (e) {
      console.warn('Error fetching overview data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Top AI Engine Status Banner */}
      <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center text-white shrink-0 shadow-subtle">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">
                {agentStatus?.mode_label || 'AI Automation Assistant'}
              </h2>
              <Badge variant="success" size="sm">
                Active
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Autonomous Auto-Pilot • Confidence Barrier: <span className="font-mono text-neutral-800 font-semibold">{Math.round((agentStatus?.confidence_threshold || 0.90) * 100)}%</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            icon={Sparkles}
            onClick={() => onNavigate('/agent')}
          >
            Agent Playground & Traces
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => onNavigate('/needs-approval')}
            icon={CheckSquare}
          >
            Review Approval Queue ({metrics?.needs_approval || 0})
          </Button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Inquiries"
          value={metrics?.total_tickets ?? '—'}
          subtext="Cumulative ticket volume"
          icon={Inbox}
        />
        <StatCard
          label="Needs Approval"
          value={metrics?.needs_approval ?? '—'}
          subtext="Gated AI drafts & actions"
          icon={CheckSquare}
          badge={
            metrics && metrics.needs_approval > 0 ? (
              <Badge variant="warning" size="sm">Action Required</Badge>
            ) : undefined
          }
        />
        <StatCard
          label="AI Deflection Rate"
          value={metrics ? `${metrics.ai_deflection_rate}%` : '—'}
          subtext="Autonomous resolution rate"
          icon={ShieldCheck}
          trend={{ value: '+12.4% vs last week', isPositive: true }}
        />
        <StatCard
          label="Estimated Hours Saved"
          value={metrics ? `${metrics.estimated_hours_saved}h` : '—'}
          subtext="Based on deflection & draft assistance"
          icon={Clock}
          trend={{ value: 'Saved $1,840 value', isPositive: true }}
        />
      </div>

      {/* Secondary Row: Draft Edit Rate & Response Time */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
              AI Draft Edit Rate
            </span>
            <div className="text-2xl font-bold text-neutral-900 tracking-tight">
              {metrics ? `${metrics.draft_edit_rate}%` : '—'}
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Percentage of AI drafts modified by human agents prior to dispatch. Lower edit rate indicates higher prompt alignment.
          </p>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
              Avg Response Time
            </span>
            <div className="text-2xl font-bold text-neutral-900 tracking-tight">
              {metrics ? `${metrics.average_response_time_minutes} min` : '—'}
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Instantaneous autonomous responses combined with human approval workflows.
          </p>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
              VIP Churn Risk Protection
            </span>
            <div className="text-2xl font-bold text-rose-600 tracking-tight flex items-center gap-1.5">
              <Flame className="w-6 h-6" />
              <span>Active</span>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Customers with &gt;$200 LTV exhibiting frustration are automatically prioritized and escalated with 3-bullet summaries.
          </p>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white border border-neutral-200/80 rounded-xl shadow-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Recent Customer Inquiries</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Live tickets processed through the agent pipeline</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigate('/inbox')}
            icon={ArrowRight}
            iconPosition="right"
          >
            View All in Inbox
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-400 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-6">Customer</th>
                <th className="py-3 px-6">Subject & Intent</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Priority</th>
                <th className="py-3 px-6">AI Confidence</th>
                <th className="py-3 px-6 text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {recentTickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onSelectTicket(t.id)}
                  className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-6 font-medium text-neutral-900">
                    <div className="flex items-center gap-2">
                      <span>{t.customer_name || 'Customer'}</span>
                      {t.is_vip && <VIPBadge churnRisk={t.vip_churn_risk} />}
                    </div>
                  </td>
                  <td className="py-3.5 px-6 max-w-xs">
                    <span className="font-medium text-neutral-800 truncate block">{t.title}</span>
                    {t.intent && (
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {t.intent.replace(/_/g, ' ')}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-3.5 px-6">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="py-3.5 px-6 font-mono text-[11px] text-neutral-600">
                    {t.ai_confidence ? `${Math.round(t.ai_confidence * 100)}%` : '—'}
                  </td>
                  <td className="py-3.5 px-6 text-right text-neutral-400">
                    {formatRelativeTime(t.updated_at || t.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
