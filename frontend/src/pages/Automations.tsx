import React, { useState, useEffect } from 'react';
import { Workflow, Play, Shield, Truck, Flame, CheckCircle2, Clock, Zap } from 'lucide-react';
import { AutomationRule } from '../types';
import { api } from '../lib/api';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export const Automations: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const data = await api.getRules();
      setRules(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggle = async (ruleId: string) => {
    try {
      const updated = await api.toggleRule(ruleId);
      setRules((prev) => prev.map((r) => (r.id === ruleId ? updated : r)));
    } catch (e: any) {
      alert(`Toggle failed: ${e.message}`);
    }
  };

  const handleSimulateCarrierDelay = async () => {
    try {
      setSimulating(true);
      setSimMessage(null);
      const res = await api.simulateCarrierDelay();
      setSimMessage(`Carrier delay webhook processed for order ${res.order_number}! Issued $15 courtesy credit & updated ticket #${res.ticket_id.slice(-6)}.`);
      fetchRules();
    } catch (e: any) {
      alert(`Simulation error: ${e.message}`);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <Workflow className="w-5 h-5 text-neutral-800" />
            Automations & Proactive Webhooks
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configure automated rules, SLA escalation triggers, confidence barriers, and proactive carrier monitors.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          icon={Truck}
          loading={simulating}
          onClick={handleSimulateCarrierDelay}
          disabled={user?.role === 'viewer'}
        >
          Simulate Carrier Delay Webhook
        </Button>
      </div>

      {simMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{simMessage}</span>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle hover:border-neutral-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-semibold text-neutral-900">{rule.name}</h3>
                <span className="font-mono text-[10px] bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 text-neutral-600">
                  Trigger: {rule.trigger_event}
                </span>
                <Badge variant={rule.is_active ? 'success' : 'neutral'} size="sm">
                  {rule.is_active ? 'Active Rule' : 'Inactive'}
                </Badge>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">{rule.description}</p>

              <div className="flex items-center gap-4 text-[11px] text-neutral-400 pt-1">
                <span className="flex items-center gap-1 font-mono">
                  <Zap className="w-3 h-3 text-neutral-400" /> Executed {rule.execution_count} times
                </span>
                {rule.last_triggered_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-neutral-400" /> Last run: {formatDate(rule.last_triggered_at)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => handleToggle(rule.id)}
                disabled={!canEdit}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  rule.is_active ? 'bg-neutral-900' : 'bg-neutral-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    rule.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
