import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Sliders,
  Shield,
  Play,
  Lock,
  Search,
  Database,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react';
import { AuditTrace } from '../types';
import { api } from '../lib/api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { AuditInspectorModal } from '../components/tickets/AuditInspectorModal';
import { formatRelativeTime } from '../lib/utils';

export const AgentWorkspace: React.FC = () => {
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [traces, setTraces] = useState<AuditTrace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<AuditTrace | null>(null);

  // Playground State
  const [playgroundText, setPlaygroundText] = useState(
    'My order ORD-8820 is delayed. My phone is 555-234-5678 and card was 4111-2222-3333-4444. I want my money back or a compensation credit immediately!'
  );
  const [customerId, setCustomerId] = useState('cust_eleanor');
  const [running, setRunning] = useState(false);
  const [liveResult, setLiveResult] = useState<any>(null);

  const fetchWorkspaceData = async () => {
    try {
      const [status, auditList] = await Promise.all([
        api.getAgentStatus(),
        api.getAuditTraces(),
      ]);
      setAgentStatus(status);
      setTraces(auditList);
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, []);

  const handleRunPlayground = async () => {
    if (!playgroundText.trim()) return;
    try {
      setRunning(true);
      setLiveResult(null);
      const res = await api.testInquiry(playgroundText, customerId);
      setLiveResult(res);
      fetchWorkspaceData(); // refresh audit traces
    } catch (e: any) {
      alert(`Simulation failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-white shrink-0 shadow-subtle">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900">
                AI Automation Workspace
              </h2>
              <Badge variant="success" size="sm">
                Active
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 mt-1 max-w-xl">
              Auto-Pilot Threshold: <span className="font-mono text-neutral-800 font-semibold">{Math.round((agentStatus?.confidence_threshold || 0.90) * 100)}%</span> • Store Credit Cap: <span className="font-mono text-neutral-800 font-semibold">${agentStatus?.store_credit_max_cap || 50}.00</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-500">Autonomous Auto-Pilot:</span>
          <Badge variant={agentStatus?.auto_pilot_enabled ? 'success' : 'neutral'}>
            {agentStatus?.auto_pilot_enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </div>

      {/* Permitted Agent Tools Card */}
      <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Registered Function Calling Tools & Backend Guardrails
          </h3>
          <span className="text-[11px] text-neutral-400 font-mono">
            {agentStatus?.available_tools?.length || 7} Tools Registered
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agentStatus?.available_tools?.map((tool: any) => (
            <div key={tool.name} className="p-3 bg-neutral-50/70 border border-neutral-200/60 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between font-mono font-semibold text-neutral-900">
                <span>{tool.name}</span>
                {tool.guardrailed && <Badge variant="warning" size="sm">Guardrailed</Badge>}
              </div>
              <p className="text-neutral-500 text-[11px] leading-relaxed">{tool.description}</p>
              {tool.rule && (
                <p className="text-amber-800 text-[10px] font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50 mt-1">
                  Rule: {tool.rule}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Simulation Playground */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-neutral-700" />
            Agent Pipeline Playground
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Submit any customer inquiry with PII, anger, or order numbers to observe the 6-stage execution trace in real time.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-neutral-700 font-medium cursor-pointer"
            >
              <option value="cust_eleanor">Customer: Eleanor Vance ($485.50 LTV • VIP)</option>
              <option value="cust_marcus">Customer: Marcus Sterling ($620.00 LTV • VIP)</option>
              <option value="cust_sophia">Customer: Sophia Rodriguez ($245.00 LTV • VIP)</option>
              <option value="cust_olivia">Customer: Olivia Bennett ($145.00 LTV • Standard)</option>
            </select>
            <span className="text-[11px] text-neutral-400">
              Select customer context to test VIP churn risk detection
            </span>
          </div>

          <textarea
            rows={3}
            value={playgroundText}
            onChange={(e) => setPlaygroundText(e.target.value)}
            className="w-full text-xs p-3 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-neutral-400 leading-relaxed font-sans"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-neutral-400 text-xs">
              <Lock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Regex PII redaction executes automatically before model ingestion</span>
            </div>
            <Button
              size="md"
              variant="primary"
              icon={Play}
              loading={running}
              onClick={handleRunPlayground}
            >
              Run Pipeline & Trace
            </Button>
          </div>
        </div>

        {/* Live Playground Output: 6-Stage Execution Trace */}
        {liveResult && (
          <div className="mt-6 pt-5 border-t border-neutral-100 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-800">
                Observable 6-Stage Execution Trace
              </h4>
              <Badge variant={liveResult.requires_approval ? 'warning' : 'success'}>
                Decision: {liveResult.requires_approval ? 'Needs Human Approval' : 'Auto-Pilot Deflected'}
              </Badge>
            </div>

            {/* 6 Stage Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Stage 1: PII Sanitization */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs space-y-1">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Stage 1: PII Redaction
                </span>
                <span className="font-semibold text-emerald-700 block">Sanitized & Encrypted</span>
                <p className="text-[11px] text-neutral-500">Credit cards & phone numbers stripped from model prompt.</p>
              </div>

              {/* Stage 2: Intent & Sentiment */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs space-y-1">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Stage 2: Classification
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold capitalize text-neutral-800">{liveResult.intent.replace(/_/g, ' ')}</span>
                  <Badge variant={liveResult.sentiment === 'frustrated' ? 'destructive' : 'neutral'} size="sm">
                    {liveResult.sentiment}
                  </Badge>
                </div>
                {liveResult.vip_churn_risk && (
                  <span className="text-[10px] text-rose-600 font-bold block">VIP_CHURN_RISK FLAGGED</span>
                )}
              </div>

              {/* Stage 3: Order Investigation */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs space-y-1">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Stage 3: Order Lookup
                </span>
                <span className="font-semibold text-neutral-800 block">
                  {liveResult.order?.order_number || 'No matching order'}
                </span>
                <span className="text-[11px] text-neutral-500 block">
                  Status: {liveResult.order?.status || 'N/A'} • Carrier: {liveResult.order?.carrier || 'FedEx'}
                </span>
              </div>

              {/* Stage 4: Policy RAG Retrieval */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs space-y-1">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Stage 4: Policy RAG Match
                </span>
                <span className="font-semibold text-neutral-800 block">
                  {liveResult.citations?.length || 0} Grounding Policies
                </span>
                <span className="text-[11px] text-neutral-500 block truncate">
                  {liveResult.citations?.map((c: any) => c.title).join(', ') || 'General inquiry'}
                </span>
              </div>

              {/* Stage 5: Confidence Score */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs space-y-1">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Stage 5: Confidence Scoring
                </span>
                <span className="font-semibold text-neutral-900 block text-sm">
                  {Math.round(liveResult.confidence_score * 100)}%
                </span>
                <span className="text-[11px] text-neutral-500 block">
                  Threshold: 90% • {liveResult.confidence_score >= 0.90 ? 'Meets Threshold' : 'Below Threshold'}
                </span>
              </div>

              {/* Stage 6: Guardrail & Action */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs space-y-1">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Stage 6: Action & Guardrail
                </span>
                <span className="font-semibold text-neutral-800 block font-mono text-[11px]">
                  {liveResult.proposed_action?.action_type || 'generate_reply'}
                </span>
                <span className="text-[11px] text-neutral-500 block">
                  Status: {liveResult.proposed_action?.status || 'approved'}
                </span>
              </div>
            </div>

            {/* Generated Reply Preview */}
            <div className="p-4 bg-white border border-neutral-200 rounded-xl text-xs space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                Policy-Grounded Response Draft:
              </span>
              <p className="text-neutral-800 whitespace-pre-wrap leading-relaxed font-sans">
                {liveResult.draft_reply}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Historical Observable Execution Traces Table */}
      <div className="bg-white border border-neutral-200/80 rounded-xl shadow-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Observable Audit Execution Traces</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Collapsible logs showing actual tool inputs, PII redactions, and guardrail validations.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-400 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-6">Trace ID</th>
                <th className="py-3 px-6">Trigger</th>
                <th className="py-3 px-6">Intent</th>
                <th className="py-3 px-6">PII Redacted</th>
                <th className="py-3 px-6">Confidence</th>
                <th className="py-3 px-6">Action & Guardrail</th>
                <th className="py-3 px-6 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {traces.map((tr) => (
                <tr
                  key={tr.id}
                  onClick={() => setSelectedTrace(tr)}
                  className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-6 font-mono text-[11px] text-neutral-700">
                    {tr.id.slice(0, 10)}...
                  </td>
                  <td className="py-3.5 px-6 text-neutral-600 capitalize">
                    {tr.trigger.replace(/_/g, ' ')}
                  </td>
                  <td className="py-3.5 px-6 font-medium text-neutral-900">
                    {tr.intent?.replace(/_/g, ' ') || 'General'}
                  </td>
                  <td className="py-3.5 px-6">
                    {tr.pii_redacted ? (
                      <Badge variant="warning" size="sm">
                        {tr.redacted_items_count} Redacted
                      </Badge>
                    ) : (
                      <span className="text-neutral-400 text-[11px]">Clean</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 font-mono font-semibold text-neutral-800">
                    {Math.round(tr.confidence_score * 100)}%
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="font-mono text-[11px] text-neutral-800">
                      {tr.selected_action || 'none'}
                    </div>
                    <Badge variant={tr.guardrails_passed ? 'success' : 'warning'} size="sm">
                      {tr.action_status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedTrace(tr)}>
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Inspector Modal */}
      <AuditInspectorModal
        isOpen={!!selectedTrace}
        onClose={() => setSelectedTrace(null)}
        auditTrace={selectedTrace}
      />
    </div>
  );
};
