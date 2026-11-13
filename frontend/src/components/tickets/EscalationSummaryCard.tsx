import React from 'react';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { EscalationSummary } from '../../types';

interface EscalationSummaryCardProps {
  summary: EscalationSummary;
  className?: string;
}

export const EscalationSummaryCard: React.FC<EscalationSummaryCardProps> = ({ summary, className }) => {
  return (
    <div className={`p-4 rounded-xl border border-amber-200/90 bg-amber-50/60 shadow-subtle ${className || ''}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-700" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900">
          Escalation Summary & Human Action Required
        </h4>
      </div>

      <div className="text-xs text-amber-950 font-medium mb-3">
        <span className="text-amber-800 font-normal">Trigger: </span>
        {summary.trigger_reason}
      </div>

      {/* 3 Structured Bullets */}
      <ul className="space-y-1.5 mb-3.5">
        {summary.bullets.map((bullet, idx) => (
          <li key={idx} className="flex items-start gap-2 text-xs text-neutral-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
            <span className="leading-relaxed">{bullet}</span>
          </li>
        ))}
      </ul>

      {/* Recommended Action */}
      <div className="pt-2.5 border-t border-amber-200/60 flex items-center justify-between text-xs">
        <span className="text-amber-900 font-semibold flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-700" /> Recommended Concession:
        </span>
        <span className="text-amber-950 font-medium text-right max-w-xs">{summary.recommended_action}</span>
      </div>
    </div>
  );
};
