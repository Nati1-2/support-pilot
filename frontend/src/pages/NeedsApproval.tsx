import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  User,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import { Ticket } from '../types';
import { api } from '../lib/api';
import { Button } from '../components/common/Button';
import { Badge, VIPBadge, PriorityBadge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { EscalationSummaryCard } from '../components/tickets/EscalationSummaryCard';
import { AuditInspectorModal } from '../components/tickets/AuditInspectorModal';
import { formatCurrency, formatRelativeTime } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface NeedsApprovalProps {
  onNavigateTicket: (ticketId: string) => void;
}

export const NeedsApproval: React.FC<NeedsApprovalProps> = ({ onNavigateTicket }) => {
  const { user } = useAuth();
  const canReview = user?.role === 'admin' || user?.role === 'agent';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuditTicket, setSelectedAuditTicket] = useState<Ticket | null>(null);

  // Edit & Approve Modal State
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editedText, setEditedText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Reject Modal State
  const [rejectingTicket, setRejectingTicket] = useState<Ticket | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const data = await api.getApprovalQueue();
      setTickets(data);
    } catch (e) {
      console.warn('Error fetching approval queue', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleApprove = async (ticket: Ticket) => {
    try {
      setActionLoading(true);
      await api.approveTicket(ticket.id, true);
      fetchQueue();
    } catch (e: any) {
      alert(`Approval error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditAndApprove = async () => {
    if (!editingTicket) return;
    try {
      setActionLoading(true);
      await api.editAndApproveTicket(editingTicket.id, editedText, undefined, true);
      setEditingTicket(null);
      fetchQueue();
    } catch (e: any) {
      alert(`Edit & Approve error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingTicket || !rejectReason.trim()) {
      alert('Please provide a reason for rejecting.');
      return;
    }
    try {
      setActionLoading(true);
      await api.rejectTicket(rejectingTicket.id, rejectReason);
      setRejectingTicket(null);
      setRejectReason('');
      fetchQueue();
    } catch (e: any) {
      alert(`Rejection error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-600" />
            Needs Approval Queue
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Human-in-the-loop review for gated store actions, low confidence predictions, and VIP churn cases.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="warning" size="md">
            {tickets.length} Pending Actions
          </Badge>
        </div>
      </div>

      {/* Review Queue Cards */}
      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200/80 p-12 shadow-subtle">
          <EmptyState
            icon={ShieldCheck}
            title="Approval queue is empty"
            description="All gated actions have been reviewed. Safe autonomous inquiries are handled directly by Auto-Pilot."
          />
        </div>
      ) : (
        <div className="space-y-5">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-neutral-200/90 rounded-2xl p-6 shadow-subtle hover:border-neutral-300 transition-all space-y-4"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs text-neutral-400">#{t.id.slice(-6)}</span>
                  <h3 className="text-sm font-semibold text-neutral-900">{t.title}</h3>
                  <PriorityBadge priority={t.priority} />
                  {t.is_vip && <VIPBadge churnRisk={t.vip_churn_risk} />}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-neutral-400">
                    {formatRelativeTime(t.created_at)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={SlidersHorizontal}
                    onClick={() => setSelectedAuditTicket(t)}
                    title="Audit Trace"
                  >
                    Trace
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateTicket(t.id)}
                    icon={ArrowRight}
                    iconPosition="right"
                  >
                    Open Ticket
                  </Button>
                </div>
              </div>

              {/* Customer & Order Context Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-neutral-50/80 rounded-lg text-xs border border-neutral-200/50">
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Customer</span>
                  <span className="font-medium text-neutral-800">{t.customer?.name || t.customer_name}</span>
                  <span className="text-neutral-500 block text-[11px]">
                    LTV: {formatCurrency(t.customer?.total_spent || t.customer_spent || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Associated Order</span>
                  <span className="font-medium text-neutral-800">{t.order?.order_number || t.order_id || 'None'}</span>
                  {t.order && (
                    <span className="text-neutral-500 block text-[11px]">
                      Status: {t.order.status} • Total: {formatCurrency(t.order.total_amount)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">AI Evaluation</span>
                  <span className="font-medium text-neutral-800">
                    Confidence: {t.ai_confidence ? `${Math.round(t.ai_confidence * 100)}%` : 'N/A'}
                  </span>
                  <span className="text-neutral-500 block text-[11px]">
                    Intent: {t.intent?.replace(/_/g, ' ') || 'General'}
                  </span>
                </div>
              </div>

              {/* 3-Bullet Escalation Summary */}
              {t.escalation_summary && (
                <EscalationSummaryCard summary={t.escalation_summary} />
              )}

              {/* Proposed Action Box */}
              {t.proposed_action && (
                <div className="p-3.5 bg-neutral-50 border border-neutral-200/80 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900">
                      Gated Tool Operation: <span className="font-mono text-neutral-800">{t.proposed_action.action_type}</span>
                    </span>
                    <Badge variant="warning" size="sm">{t.proposed_action.status}</Badge>
                  </div>
                  {t.proposed_action.reason && (
                    <p className="text-neutral-600 text-[11px] leading-relaxed">{t.proposed_action.reason}</p>
                  )}
                </div>
              )}

              {/* AI Draft Message Preview */}
              {t.ai_draft_reply && (
                <div className="p-3.5 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-800 leading-relaxed font-sans whitespace-pre-wrap">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    <Sparkles className="w-3 h-3 text-neutral-400" /> Proposed Customer Reply
                  </div>
                  {t.ai_draft_reply}
                </div>
              )}

              {/* Action Buttons */}
              {canReview ? <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => setRejectingTicket(t)}
                  loading={actionLoading}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingTicket(t);
                    setEditedText(t.ai_draft_reply || '');
                  }}
                  loading={actionLoading}
                >
                  Edit & Approve
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={CheckCircle2}
                  onClick={() => handleApprove(t)}
                  loading={actionLoading}
                >
                  Approve Draft & Action
                </Button>
              </div> : <div className="flex justify-end pt-2"><Badge variant="neutral">Read-only audit access</Badge></div>}
            </div>
          ))}
        </div>
      )}

      {/* Edit & Approve Modal */}
      <Modal
        isOpen={!!editingTicket}
        onClose={() => setEditingTicket(null)}
        title="Edit Draft Response"
        description="Modify the generated response. Human edit distance will be recorded to improve deflection quality."
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditingTicket(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading}
              onClick={handleEditAndApprove}
            >
              Approve & Dispatch
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <textarea
            rows={7}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full p-3 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 font-sans leading-relaxed"
          />
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectingTicket}
        onClose={() => setRejectingTicket(null)}
        title="Reject Proposed Action"
        description="Provide a justification for rejecting the automated proposal."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRejectingTicket(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              loading={actionLoading}
              onClick={handleReject}
            >
              Confirm Rejection
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="text-xs font-semibold text-neutral-700 block">
            Reason for Rejection:
          </label>
          <textarea
            rows={4}
            placeholder="e.g. Order already delivered; credit cannot be granted without merchandise return."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full p-3 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400"
          />
        </div>
      </Modal>

      {/* Audit Inspector Modal */}
      <AuditInspectorModal
        isOpen={!!selectedAuditTicket}
        onClose={() => setSelectedAuditTicket(null)}
        auditTrace={selectedAuditTicket?.audit_trace}
      />
    </div>
  );
};
