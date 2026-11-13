import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  Package,
  ExternalLink,
  MapPin,
  Clock,
  BookOpen,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
} from 'lucide-react';
import { Ticket, Message, PolicyCitation } from '../../types';
import { Button } from '../common/Button';
import { Badge, StatusBadge, PriorityBadge, VIPBadge, SentimentBadge } from '../common/Badge';
import { EscalationSummaryCard } from './EscalationSummaryCard';
import { AuditInspectorModal } from './AuditInspectorModal';
import { Modal } from '../common/Modal';
import { formatCurrency, formatDate, formatRelativeTime } from '../../lib/utils';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface TicketDetailViewProps {
  ticket: Ticket;
  onTicketUpdated: () => void;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({ ticket, onTicketUpdated }) => {
  const { user } = useAuth();
  const canAct = user?.role === 'admin' || user?.role === 'agent';
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isEditApproveOpen, setIsEditApproveOpen] = useState(false);
  const [editedDraft, setEditedDraft] = useState(ticket.ai_draft_reply || '');
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<PolicyCitation | null>(null);

  const customer = ticket.customer;
  const order = ticket.order;
  const messages = ticket.messages || [];

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    try {
      setSending(true);
      await api.addMessage(ticket.id, replyText);
      setReplyText('');
      onTicketUpdated();
    } catch (e: any) {
      alert(`Error sending reply: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await api.approveTicket(ticket.id, true);
      onTicketUpdated();
    } catch (e: any) {
      alert(`Approval error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditAndApprove = async () => {
    try {
      setActionLoading(true);
      await api.editAndApproveTicket(ticket.id, editedDraft, undefined, true);
      setIsEditApproveOpen(false);
      onTicketUpdated();
    } catch (e: any) {
      alert(`Edit & Approve error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejecting this resolution.');
      return;
    }
    try {
      setActionLoading(true);
      await api.rejectTicket(ticket.id, rejectReason);
      setIsRejectOpen(false);
      onTicketUpdated();
    } catch (e: any) {
      alert(`Rejection error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.updateTicket(ticket.id, { status: newStatus as any });
      onTicketUpdated();
    } catch (e: any) {
      alert(`Update error: ${e.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Ticket Header */}
      <div className="px-6 py-4 border-b border-neutral-200/80 flex items-center justify-between shrink-0 bg-white">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-neutral-400">#{ticket.id.slice(-6)}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.is_vip && <VIPBadge churnRisk={ticket.vip_churn_risk} />}
            {ticket.sentiment && <SentimentBadge sentiment={ticket.sentiment} />}
          </div>
          <h2 className="text-base font-semibold text-neutral-900 truncate">{ticket.title}</h2>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            icon={SlidersHorizontal}
            onClick={() => setIsAuditOpen(true)}
            title="Inspect Observable Execution Audit Trace"
          >
            Audit Inspector
          </Button>

          <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-xs bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-1.5 font-medium text-neutral-700 cursor-pointer"
            disabled={!canAct}
          >
            <option value="open">Status: Open</option>
            <option value="needs_approval">Status: Needs Approval</option>
            <option value="resolved">Status: Resolved</option>
            <option value="escalated">Status: Escalated</option>
            <option value="closed">Status: Closed</option>
          </select>
        </div>
      </div>

      {/* Main Split Body: Conversation & Context Drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Side: Conversation Thread & Actions */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-neutral-200/80 overflow-y-auto">
          <div className="p-6 space-y-5 flex-1">
            {/* Escalation Summary Box if applicable */}
            {ticket.escalation_summary && (
              <EscalationSummaryCard summary={ticket.escalation_summary} />
            )}

            {/* Needs Approval Review Banner */}
            {ticket.status === 'needs_approval' && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-semibold text-amber-900">
                      Gated AI Draft & Action Awaiting Human Review
                    </span>
                  </div>
                  {ticket.ai_confidence && (
                    <Badge variant="warning" size="sm">
                      {Math.round(ticket.ai_confidence * 100)}% AI Confidence
                    </Badge>
                  )}
                </div>

                {/* Proposed Action Summary */}
                {ticket.proposed_action && (
                  <div className="p-3 bg-white border border-amber-200/80 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between font-medium text-neutral-800">
                      <span>Proposed Action: <span className="font-mono text-neutral-900">{ticket.proposed_action.action_type}</span></span>
                      <Badge variant="outline" size="sm">{ticket.proposed_action.status}</Badge>
                    </div>
                    {ticket.proposed_action.reason && (
                      <p className="text-neutral-500 text-[11px]">{ticket.proposed_action.reason}</p>
                    )}
                  </div>
                )}

                {/* AI Draft Preview */}
                {ticket.ai_draft_reply && (
                  <div className="p-3 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-800 whitespace-pre-wrap leading-relaxed font-sans">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                      <Sparkles className="w-3 h-3 text-neutral-400" /> AI Generated Reply Draft
                    </div>
                    {ticket.ai_draft_reply}
                  </div>
                )}

                {/* Approval Action Buttons */}
                {canAct ? <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsRejectOpen(true)}
                    loading={actionLoading}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditedDraft(ticket.ai_draft_reply || '');
                      setIsEditApproveOpen(true);
                    }}
                    loading={actionLoading}
                  >
                    Edit & Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleApprove}
                    loading={actionLoading}
                    icon={CheckCircle2}
                  >
                    Approve Draft & Action
                  </Button>
                </div> : <div className="flex justify-end pt-1"><Badge variant="neutral">Read-only audit access</Badge></div>}
              </div>
            )}

            {/* Conversation Messages */}
            <div className="space-y-4">
              {messages.map((msg) => {
                const isCustomer = msg.sender_type === 'customer';
                const isAI = msg.sender_type === 'ai';
                const isSystem = msg.sender_type === 'system';

                if (isSystem) {
                  return (
                    <div key={msg.id} className="p-2.5 rounded-lg bg-neutral-100 text-neutral-600 text-xs text-center border border-neutral-200/60 font-medium">
                      {msg.content}
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-semibold text-neutral-600">
                        {msg.sender_name}
                      </span>
                      {isAI && (
                        <Badge variant="primary" size="sm" className="gap-1">
                          <Bot className="w-2.5 h-2.5" /> AI Auto-Pilot
                        </Badge>
                      )}
                      <span className="text-[10px] text-neutral-400">
                        {formatRelativeTime(msg.created_at)}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] rounded-xl p-4 text-xs leading-relaxed whitespace-pre-wrap ${
                        isCustomer
                          ? 'bg-neutral-100 text-neutral-900 rounded-tl-sm'
                          : isAI
                          ? 'bg-white border border-neutral-200/90 text-neutral-900 shadow-subtle rounded-tr-sm'
                          : 'bg-neutral-900 text-white rounded-tr-sm'
                      }`}
                    >
                      {msg.content}

                      {/* Policy Citations inside AI Reply */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-neutral-100 space-y-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                            Policy Citations Grounding:
                          </span>
                          {msg.citations.map((cite, cIdx) => (
                            <button
                              key={cIdx}
                              onClick={() => setSelectedCitation(cite)}
                              className="p-2 bg-neutral-50 rounded border border-neutral-200/70 text-[11px] text-neutral-700"
                            >
                              <div className="font-semibold text-neutral-800 flex items-center justify-between">
                                <span>{cite.title}</span>
                                <span className="font-mono text-[10px] text-neutral-400">
                                  {Math.round(cite.relevance_score * 100)}% match
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">
                                "{cite.snippet}"
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Composer */}
          {canAct ? <div className="p-4 bg-white border-t border-neutral-200/80">
            <div className="relative rounded-lg border border-neutral-200 focus-within:ring-1 focus-within:ring-neutral-400 bg-white">
              <textarea
                rows={3}
                placeholder="Type your message to the customer..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full p-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none resize-none bg-transparent"
              />
              <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-100 bg-neutral-50/50">
                <div className="flex items-center gap-2">
                  {ticket.ai_draft_reply && (
                    <button
                      onClick={() => setReplyText(ticket.ai_draft_reply || '')}
                      className="text-[11px] text-neutral-600 hover:text-neutral-900 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-neutral-500" /> Insert AI Draft
                    </button>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  icon={Send}
                  loading={sending}
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                >
                  Send Reply
                </Button>
              </div>
            </div>
          </div> : <div className="p-3 bg-neutral-50 border-t border-neutral-200 text-center text-[11px] text-neutral-500">Viewer access is read-only.</div>}
        </div>

        {/* Right Side: Customer Context & Order Details Drawer */}
        <div className="w-80 bg-neutral-50/50 overflow-y-auto p-5 space-y-4 shrink-0">
          {/* Customer 360 Card */}
          <div className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-subtle space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Customer 360</span>
              {customer?.is_vip && <VIPBadge />}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-900">{customer?.name || ticket.customer_name}</h3>
              <p className="text-xs text-neutral-500">{customer?.email || ticket.customer_email}</p>
              {customer?.phone && <p className="text-[11px] text-neutral-400 mt-0.5">{customer.phone}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100 text-xs">
              <div>
                <span className="text-[11px] text-neutral-400 block">Total Spent (LTV)</span>
                <span className="font-semibold text-neutral-900">
                  {formatCurrency(customer?.total_spent || ticket.customer_spent || 0)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400 block">Order Count</span>
                <span className="font-semibold text-neutral-900">{customer?.orders_count || 1} orders</span>
              </div>
            </div>

            {customer?.notes && (
              <div className="p-2 bg-neutral-50 rounded border border-neutral-200/50 text-[11px] text-neutral-600">
                <span className="font-medium text-neutral-800">Agent Note: </span>
                {customer.notes}
              </div>
            )}
          </div>

          {/* Associated Order Card */}
          {order && (
            <div className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-subtle space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900">
                  <Package className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{order.order_number}</span>
                </div>
                <Badge variant={order.status === 'delivered' ? 'success' : order.status === 'delayed' ? 'warning' : 'neutral'} size="sm">
                  {order.status}
                </Badge>
              </div>

              {/* Items */}
              <div className="space-y-1.5 pt-1">
                {order.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-700 truncate">{item.name}</span>
                    <span className="font-medium text-neutral-900 shrink-0 ml-2">{formatCurrency(item.price)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs font-semibold text-neutral-900">
                  <span>Order Total:</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>

              {/* Carrier & Tracking */}
              {order.tracking_number && (
                <div className="pt-2 border-t border-neutral-100 text-xs">
                  <span className="text-[11px] text-neutral-400 block">Carrier Tracking</span>
                  <div className="flex items-center justify-between font-mono text-[11px] mt-0.5">
                    <span className="text-neutral-800">{order.carrier || 'FedEx'}: {order.tracking_number}</span>
                  </div>
                  {order.estimated_delivery && (
                    <span className="text-[11px] text-neutral-500 mt-1 block">
                      ETA: {order.estimated_delivery}
                    </span>
                  )}
                </div>
              )}

              {/* Shipping Address */}
              <div className="pt-2 border-t border-neutral-100 text-xs">
                <div className="flex items-center gap-1 text-[11px] text-neutral-400 mb-0.5">
                  <MapPin className="w-3 h-3" />
                  <span>Destination Address</span>
                </div>
                <p className="text-neutral-700 leading-snug">
                  {order.shipping_address.street}<br />
                  {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip_code}
                </p>
              </div>

              {/* RMA Labels or Credits if any */}
              {order.credits_issued > 0 && (
                <div className="p-2 bg-emerald-50 rounded border border-emerald-200/60 text-xs text-emerald-800 flex items-center justify-between">
                  <span>Store Credits Issued:</span>
                  <span className="font-semibold">{formatCurrency(order.credits_issued)}</span>
                </div>
              )}

              {order.rma_labels && order.rma_labels.length > 0 && (
                <div className="p-2 bg-blue-50 rounded border border-blue-200/60 text-xs text-blue-900 space-y-1">
                  <span className="font-semibold block">Active Return Authorization:</span>
                  {order.rma_labels.map((rma, rIdx) => (
                    <div key={rIdx} className="font-mono text-[11px] text-blue-700">
                      {rma.label_id} ({rma.carrier})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Policy Citations Used */}
          {ticket.citations && ticket.citations.length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-subtle space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                <BookOpen className="w-3.5 h-3.5" /> Cited Store Policies
              </div>
              <div className="space-y-2 pt-1">
                {ticket.citations.map((c, i) => (
                  <button key={i} onClick={() => setSelectedCitation(c)} className="text-xs text-left w-full hover:bg-neutral-50 rounded p-1 -m-1">
                    <p className="font-medium text-neutral-800">{c.title}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-3 leading-relaxed">
                      "{c.snippet}"
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit & Approve Modal */}
      <Modal
        isOpen={isEditApproveOpen}
        onClose={() => setIsEditApproveOpen(false)}
        title="Edit Draft & Approve Action"
        description="Modify the AI generated reply before sending to customer. Continuous edit feedback will be recorded."
        maxWidth="xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsEditApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading}
              onClick={handleEditAndApprove}
            >
              Approve & Send
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="text-xs font-medium text-neutral-700 block">
            Response Message:
          </label>
          <textarea
            rows={7}
            value={editedDraft}
            onChange={(e) => setEditedDraft(e.target.value)}
            className="w-full p-3 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 leading-relaxed font-sans"
          />
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        title="Reject Proposed Resolution"
        description="Provide a reason why this AI resolution is rejected. The ticket will be returned to the open queue."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsRejectOpen(false)}>
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
          <label className="text-xs font-medium text-neutral-700 block">
            Rejection Reason (required for continuous feedback):
          </label>
          <textarea
            rows={4}
            placeholder="e.g. In-transit package cannot be refunded without carrier return receipt..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full p-3 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400"
          />
        </div>
      </Modal>

      {/* Audit Inspector Modal */}
      <AuditInspectorModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        auditTrace={ticket.audit_trace}
      />

      <Modal
        isOpen={!!selectedCitation}
        onClose={() => setSelectedCitation(null)}
        title={selectedCitation?.title || 'Policy citation'}
        description={`Source section: ${selectedCitation?.section_id || ''}`}
        maxWidth="md"
      >
        <div className="space-y-3 text-xs">
          <Badge variant="primary">{Math.round((selectedCitation?.relevance_score || 0) * 100)}% policy match</Badge>
          <p className="leading-relaxed text-neutral-700">{selectedCitation?.snippet}</p>
        </div>
      </Modal>
    </div>
  );
};
