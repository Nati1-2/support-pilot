import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Inbox as InboxIcon, Sparkles } from 'lucide-react';
import { Ticket } from '../types';
import { api } from '../lib/api';
import { TicketItem } from '../components/tickets/TicketItem';
import { TicketDetailView } from '../components/tickets/TicketDetailView';
import { Tabs } from '../components/common/Tabs';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';

interface InboxProps {
  initialTicketId?: string | null;
  onClearInitialTicket?: () => void;
}

export const Inbox: React.FC<InboxProps> = ({ initialTicketId, onClearInitialTicket }) => {
  const { user } = useAuth();
  const canCreate = user?.role === 'admin' || user?.role === 'agent';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeQueue, setActiveQueue] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // New Inquiry Modal State
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('cust_olivia');
  const [creating, setCreating] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (activeQueue !== 'all') params.queue = activeQueue;
      if (search) params.search = search;
      if (priorityFilter) params.priority = priorityFilter;

      const data = await api.getTickets(params);
      setTickets(data);

      if (initialTicketId) {
        const found = data.find((t) => t.id === initialTicketId);
        if (found) {
          fetchSingleTicket(found.id);
        } else {
          fetchSingleTicket(initialTicketId);
        }
        if (onClearInitialTicket) onClearInitialTicket();
      } else if (!selectedTicket && data.length > 0) {
        fetchSingleTicket(data[0].id);
      } else if (selectedTicket) {
        // refresh current ticket
        fetchSingleTicket(selectedTicket.id);
      }
    } catch (e) {
      console.warn('Error fetching tickets', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleTicket = async (ticketId: string) => {
    try {
      const full = await api.getTicket(ticketId);
      setSelectedTicket(full);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [activeQueue, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTickets();
  };

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) return;
    try {
      setCreating(true);
      const created = await api.createTicket({
        customer_id: newCustomerId,
        title: newTitle,
        message: newMessage,
        channel: 'email',
      });
      setIsNewOpen(false);
      setNewTitle('');
      setNewMessage('');
      fetchTickets();
      fetchSingleTicket(created.id);
    } catch (err: any) {
      alert(`Error creating ticket: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const queueTabs = [
    { id: 'all', label: 'All Inquiries' },
    { id: 'needs_approval', label: 'Needs Approval' },
    { id: 'vip', label: 'VIP / Critical' },
    { id: 'resolved', label: 'Resolved' },
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Master Ticket List (Left Pane) */}
      <div className="w-80 sm:w-96 border-r border-neutral-200/80 bg-white flex flex-col shrink-0">
        {/* Controls Bar */}
        <div className="p-3 border-b border-neutral-100 space-y-2">
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md focus:outline-none focus:bg-white focus:ring-1 focus:ring-neutral-400"
              />
            </form>
            <Button
              size="sm"
              variant="primary"
              icon={Plus}
              onClick={() => setIsNewOpen(true)}
              title="New Customer Inquiry"
              disabled={!canCreate}
            >
              New
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-[11px] bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-neutral-600 cursor-pointer"
            >
              <option value="">Priority: All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <span className="text-[11px] text-neutral-400 font-medium">
              {tickets.length} tickets
            </span>
          </div>
        </div>

        {/* Queue Filter Tabs */}
        <Tabs tabs={queueTabs} activeTab={activeQueue} onChange={setActiveQueue} />

        {/* Ticket List Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
          {tickets.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="No tickets found"
              description="There are currently no inquiries matching the active filters."
              actionLabel={canCreate ? "Create Demo Ticket" : undefined}
              onAction={canCreate ? () => setIsNewOpen(true) : undefined}
            />
          ) : (
            tickets.map((t) => (
              <TicketItem
                key={t.id}
                ticket={t}
                isSelected={selectedTicket?.id === t.id}
                onSelect={(ticket) => fetchSingleTicket(ticket.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Ticket Detail (Right Pane) */}
      <div className="flex-1 flex flex-col min-w-0 bg-neutral-50 overflow-hidden">
        {selectedTicket ? (
          <TicketDetailView
            ticket={selectedTicket}
            onTicketUpdated={() => {
              fetchTickets();
              fetchSingleTicket(selectedTicket.id);
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <EmptyState
              icon={InboxIcon}
              title="Select an inquiry"
              description="Choose a ticket from the sidebar to review customer messages, order details, and agent actions."
            />
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      <Modal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        title="Simulate New Customer Inquiry"
        description="Ingest a new inquiry into the AI agent pipeline. Redaction, classification, and guardrails run automatically."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsNewOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={creating}
              onClick={handleCreateInquiry}
              icon={Sparkles}
            >
              Ingest & Run Agent
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateInquiry} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">
              Select Customer
            </label>
            <select
              value={newCustomerId}
              onChange={(e) => setNewCustomerId(e.target.value)}
              className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-neutral-400 cursor-pointer"
            >
              <option value="cust_eleanor">Eleanor Vance ($485.50 LTV • VIP)</option>
              <option value="cust_marcus">Marcus Sterling ($620.00 LTV • VIP)</option>
              <option value="cust_sophia">Sophia Rodriguez ($245.00 LTV • VIP)</option>
              <option value="cust_olivia">Olivia Bennett ($145.00 LTV • Standard)</option>
              <option value="cust_liam">Liam Gallagher ($98.00 LTV • Standard)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">
              Subject Line
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Where is my delayed order? or Need return authorization"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-neutral-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">
              Customer Message (Supports PII to test regex redaction)
            </label>
            <textarea
              rows={4}
              required
              placeholder="e.g. My order ORD-8820 is taking forever! My phone is 555-123-4567. Please refund me or I will contact my bank."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-neutral-400 leading-relaxed resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
