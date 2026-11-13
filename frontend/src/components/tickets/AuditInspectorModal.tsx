import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  Search,
  Lock,
  Sparkles,
  Bot,
  Sliders,
} from 'lucide-react';
import { AuditTrace } from '../../types';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';

interface AuditInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditTrace?: AuditTrace | null;
}

export const AuditInspectorModal: React.FC<AuditInspectorModalProps> = ({
  isOpen,
  onClose,
  auditTrace,
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({
    '0': true,
    '1': true,
    '2': true,
    '3': true,
    '4': true,
    '5': true,
  });

  if (!auditTrace) return null;

  const toggleStep = (key: string) => {
    setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getStepIcon = (name: string) => {
    switch (name) {
      case 'pii_sanitization':
        return <Lock className="w-4 h-4 text-emerald-600" />;
      case 'order_investigation':
        return <Database className="w-4 h-4 text-blue-600" />;
      case 'intent_classification':
        return <Search className="w-4 h-4 text-neutral-600" />;
      case 'policy_retrieval':
        return <Sliders className="w-4 h-4 text-amber-600" />;
      case 'guardrail_and_routing':
        return <ShieldAlert className="w-4 h-4 text-indigo-600" />;
      default:
        return <Bot className="w-4 h-4 text-neutral-600" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Observable Execution Audit Trace"
      description={`Trace ID: ${auditTrace.id} • Trigger: ${auditTrace.trigger}`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Pipeline Summary Bar */}
        <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-neutral-800">Pipeline Flow:</span>
            <span className="bg-white px-2 py-0.5 rounded border border-neutral-200 font-mono text-[11px]">Intent</span>
            <span className="text-neutral-400">→</span>
            <span className="bg-white px-2 py-0.5 rounded border border-neutral-200 font-mono text-[11px]">PII Check</span>
            <span className="text-neutral-400">→</span>
            <span className="bg-white px-2 py-0.5 rounded border border-neutral-200 font-mono text-[11px]">Order Lookup</span>
            <span className="text-neutral-400">→</span>
            <span className="bg-white px-2 py-0.5 rounded border border-neutral-200 font-mono text-[11px]">Policy Cited</span>
            <span className="text-neutral-400">→</span>
            <span className="bg-white px-2 py-0.5 rounded border border-neutral-200 font-mono text-[11px]">Guardrails</span>
            <span className="text-neutral-400">→</span>
            <span className="bg-neutral-900 text-white px-2 py-0.5 rounded font-mono text-[11px]">Action</span>
          </div>
          <Badge variant={auditTrace.confidence_score >= 0.90 ? 'success' : 'warning'}>
            {Math.round(auditTrace.confidence_score * 100)}% Confidence
          </Badge>
        </div>

        {/* Execution Steps Accordion */}
        <div className="space-y-2.5">
          {auditTrace.execution_steps.map((step, idx) => {
            const isExpanded = !!expandedSteps[String(idx)];
            return (
              <div
                key={idx}
                className="border border-neutral-200/80 rounded-lg overflow-hidden bg-white shadow-subtle"
              >
                <button
                  onClick={() => toggleStep(String(idx))}
                  className="w-full px-4 py-2.5 bg-neutral-50/70 hover:bg-neutral-100/60 flex items-center justify-between transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {getStepIcon(step.step_name)}
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-800">
                      Step {idx + 1}: {step.step_name.replace(/_/g, ' ')}
                    </span>
                    <Badge
                      variant={
                        step.status === 'success'
                          ? 'success'
                          : step.status === 'warning'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {step.status}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-3.5 border-t border-neutral-100 bg-white text-xs space-y-2">
                    <pre className="p-2.5 bg-neutral-900 text-neutral-100 rounded-md font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(step.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Guardrail Results & Decision Footer */}
        <div className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-800">Guardrail Enforcement Outcome:</span>
            <Badge variant={auditTrace.guardrails_passed ? 'success' : 'warning'}>
              {auditTrace.guardrails_passed ? 'Safety Checks Passed' : 'Gated for Human Review'}
            </Badge>
          </div>
          {auditTrace.guardrail_details.length > 0 && (
            <div className="text-neutral-600 text-[11px] space-y-1">
              {auditTrace.guardrail_details.map((detail, dIdx) => (
                <div key={dIdx} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-neutral-400" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}
          {auditTrace.escalation_reason && (
            <div className="pt-2 border-t border-neutral-200 text-neutral-700">
              <span className="font-semibold text-neutral-900">Escalation Trigger: </span>
              {auditTrace.escalation_reason}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
