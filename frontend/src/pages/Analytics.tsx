import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, ShieldCheck, Clock, CheckSquare, Zap, Activity } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { api } from '../lib/api';

export const Analytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getAnalyticsSummary();
      setData(res);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-neutral-800" />
          AI Performance & Support Analytics
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Real-time metrics measuring autonomous deflection, continuous edit feedback, human time saved, and sentiment.
        </p>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Autonomous Deflection Rate"
          value={data ? `${data.ai_deflection_rate}%` : '—'}
          subtext="Resolved without human intervention"
          icon={ShieldCheck}
          trend={{ value: '+14% month-over-month', isPositive: true }}
        />
        <StatCard
          label="AI Draft Edit Rate"
          value={data ? `${data.draft_edit_rate}%` : '—'}
          subtext="Human modification frequency"
          icon={CheckSquare}
          trend={{ value: '-8% reduction in edits', isPositive: true }}
        />
        <StatCard
          label="Estimated Hours Saved"
          value={data ? `${data.estimated_hours_saved} hrs` : '—'}
          subtext="Computed support labor saved"
          icon={Clock}
          trend={{ value: 'Equivalent to 0.4 FTE', isPositive: true }}
        />
        <StatCard
          label="Inquiry Volume (7-Day)"
          value={data ? `${data.total_tickets} inquiries` : '—'}
          subtext="Inbound multichannel tickets"
          icon={Activity}
        />
      </div>

      {/* 7-Day Ticket Volume & Deflection Trends */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">7-Day Ticket Volume & Autonomous Deflection</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Daily breakdown of autonomous deflections vs human reviews</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-neutral-900" />
              <span className="text-neutral-600">Autonomously Deflected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
              <span className="text-neutral-600">Escalated / Reviewed</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="grid grid-cols-7 gap-3 pt-4 border-t border-neutral-100">
          {data?.daily_trends?.map((day: any, idx: number) => {
            const total = day.total || 1;
            const defPct = Math.round((day.deflected / total) * 100);
            return (
              <div key={idx} className="flex flex-col items-center gap-2">
                <span className="text-[11px] font-semibold text-neutral-800">{day.total}</span>
                <div className="w-full h-36 bg-neutral-100 rounded-lg overflow-hidden flex flex-col justify-end p-1 relative">
                  {/* Deflected bar */}
                  <div
                    style={{ height: `${defPct}%` }}
                    className="w-full bg-neutral-900 rounded-sm transition-all duration-300"
                    title={`Deflected: ${day.deflected}`}
                  />
                  {/* Escalated remainder */}
                  <div
                    style={{ height: `${100 - defPct}%` }}
                    className="w-full bg-amber-400/80 rounded-sm transition-all duration-300 mt-0.5"
                    title={`Escalated: ${day.escalated}`}
                  />
                </div>
                <span className="text-[10px] text-neutral-500 font-medium">{day.date}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Grid: Sentiment Breakdown & Intent Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Sentiment Breakdown */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Sentiment Distribution</h3>
          <p className="text-xs text-neutral-400">Classified across incoming customer interactions</p>

          <div className="space-y-3 pt-2">
            {Object.entries(data?.sentiment_distribution || {}).map(([key, val]: any) => {
              const total = data?.total_tickets || 1;
              const pct = Math.round((val / total) * 100);
              const color =
                key === 'positive'
                  ? 'bg-emerald-500'
                  : key === 'neutral'
                  ? 'bg-neutral-400'
                  : key === 'negative'
                  ? 'bg-amber-500'
                  : 'bg-rose-500';

              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize font-medium text-neutral-700">{key}</span>
                    <span className="font-mono text-neutral-500">{val} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div style={{ width: `${pct}%` }} className={`h-full ${color} rounded-full`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Inquired Intents & Tools */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Automated Tool Executions</h3>
          <p className="text-xs text-neutral-400">Operational tasks executed autonomously under guardrails</p>

          <div className="space-y-2.5 pt-2">
            {Object.entries(data?.tool_usage || {}).map(([tool, count]: any) => (
              <div key={tool} className="p-3 bg-neutral-50 rounded-lg border border-neutral-200/70 text-xs flex items-center justify-between">
                <span className="font-mono text-neutral-800 font-medium">{tool}</span>
                <span className="font-semibold text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                  {count} executed
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
