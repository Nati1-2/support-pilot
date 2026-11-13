import React, { useEffect, useState } from 'react';
import { BookOpen, LogOut, MessageSquare, Package, Plus, Send, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Customer, Order, PolicyCitation, Ticket } from '../types';
import { Button } from '../components/common/Button';
import { Badge, StatusBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatRelativeTime } from '../lib/utils';

export const CustomerPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const [customer, setCustomer] = useState<(Customer & { orders: Order[] }) | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [title, setTitle] = useState('Question about my order');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<PolicyCitation | null>(null);

  const load = async (preferredId?: string) => {
    const [ticketRows, profile] = await Promise.all([
      api.getTickets(),
      user?.customer_id ? api.getCustomer(user.customer_id) : Promise.resolve(null),
    ]);
    setTickets(ticketRows);
    setCustomer(profile as any);
    const id = preferredId || selected?.id || ticketRows[0]?.id;
    if (id) setSelected(await api.getTicket(id));
  };

  useEffect(() => {
    load().catch(console.warn);
  }, []);

  const createInquiry = async () => {
    if (!user?.customer_id || !title.trim() || !message.trim()) return;
    setBusy(true);
    try {
      const created = await api.createTicket({
        customer_id: user.customer_id,
        title: title.trim(),
        message: message.trim(),
        channel: 'portal',
      });
      setIsNewOpen(false);
      setMessage('');
      await load(created.id);
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await api.addMessage(selected.id, reply.trim(), 'customer');
      setReply('');
      await load(selected.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="h-16 bg-white border-b border-neutral-200 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
          <div><p className="text-sm font-semibold">SupportPilot Customer Portal</p><p className="text-[11px] text-neutral-400">AeroWear Goods</p></div>
        </div>
        <div className="flex items-center gap-3 text-xs"><span className="hidden sm:inline text-neutral-600">{user?.full_name}</span><Button size="sm" variant="ghost" icon={LogOut} onClick={logout}>Sign out</Button></div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h1 className="text-xl font-bold">Welcome, {user?.full_name}</h1><p className="text-xs text-neutral-500">Submit inquiries and review replies, order updates, and cited store policies.</p></div>
          <Button icon={Plus} onClick={() => setIsNewOpen(true)}>New support inquiry</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_280px] gap-4">
          <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden min-h-[520px]">
            <div className="p-4 border-b border-neutral-100"><h2 className="text-sm font-semibold">My inquiries</h2></div>
            <div className="divide-y divide-neutral-100">
              {tickets.map((ticket) => (
                <button key={ticket.id} onClick={async () => setSelected(await api.getTicket(ticket.id))} className={`w-full p-4 text-left hover:bg-neutral-50 ${selected?.id === ticket.id ? 'bg-neutral-50' : ''}`}>
                  <p className="text-xs font-semibold line-clamp-2">{ticket.title}</p><div className="mt-2 flex items-center justify-between"><StatusBadge status={ticket.status} /><span className="text-[10px] text-neutral-400">{formatRelativeTime(ticket.updated_at)}</span></div>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white border border-neutral-200 rounded-xl min-h-[520px] flex flex-col overflow-hidden">
            {selected ? <>
              <div className="p-4 border-b border-neutral-100"><h2 className="text-sm font-semibold">{selected.title}</h2><p className="text-[11px] text-neutral-400 mt-1">Ticket #{selected.id.slice(-8)}</p></div>
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {(selected.messages || []).map((item) => <div key={item.id} className={`flex ${item.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-3 rounded-xl text-xs ${item.sender_type === 'customer' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-800'}`}><p className="font-semibold text-[10px] mb-1 opacity-70">{item.sender_name}</p><p className="whitespace-pre-wrap">{item.content}</p>{item.citations?.length > 0 && <div className="mt-2 pt-2 border-t border-current/10 space-y-1">{item.citations.map((cite) => <button key={cite.section_id} onClick={() => setSelectedCitation(cite)} className="block text-left underline underline-offset-2"><BookOpen className="inline w-3 h-3 mr-1" />Source: {cite.title}</button>)}</div>}</div></div>)}
                {selected.status === 'resolved' && selected.citations?.length > 0 && <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">Sources used for this resolution</p>{selected.citations.map((cite) => <button key={cite.section_id} onClick={() => setSelectedCitation(cite)} className="block text-xs text-left text-neutral-700 underline underline-offset-2"><BookOpen className="inline w-3 h-3 mr-1" />{cite.title}</button>)}</div>}
              </div>
              <div className="p-3 border-t border-neutral-100 flex gap-2"><input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} placeholder="Reply to support..." className="flex-1 text-xs border border-neutral-200 rounded-lg px-3"/><Button icon={Send} loading={busy} disabled={!reply.trim()} onClick={sendReply}>Send</Button></div>
            </> : <div className="flex-1 grid place-items-center text-xs text-neutral-400">Select an inquiry</div>}
          </section>

          <aside className="space-y-4">
            <div className="bg-white border border-neutral-200 rounded-xl p-4"><h2 className="text-sm font-semibold mb-3">Account</h2><p className="text-xs font-medium">{customer?.name}</p><p className="text-[11px] text-neutral-500">{customer?.email}</p><div className="mt-3 pt-3 border-t border-neutral-100 flex justify-between text-xs"><span className="text-neutral-500">Lifetime value</span><strong>{formatCurrency(customer?.total_spent || 0)}</strong></div></div>
            <div className="bg-white border border-neutral-200 rounded-xl p-4"><h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Package className="w-4 h-4" />My orders</h2><div className="space-y-3">{customer?.orders?.map((order) => <div key={order.id} className="text-xs"><div className="flex justify-between"><strong>{order.order_number}</strong><Badge size="sm" variant="neutral">{order.status}</Badge></div><p className="text-[11px] text-neutral-500 mt-1">{order.items.map((item) => item.name).join(', ')}</p></div>)}</div></div>
          </aside>
        </div>
      </main>

      <Modal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} title="New support inquiry" description="Your message is processed through PII redaction, policy retrieval, and safety guardrails." footer={<><Button variant="secondary" onClick={() => setIsNewOpen(false)}>Cancel</Button><Button icon={MessageSquare} loading={busy} onClick={createInquiry}>Submit inquiry</Button></>}>
        <div className="space-y-3"><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-xs p-2.5 border border-neutral-200 rounded-lg" placeholder="Subject"/><textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full text-xs p-2.5 border border-neutral-200 rounded-lg" placeholder="How can we help?"/></div>
      </Modal>
      <Modal isOpen={Boolean(selectedCitation)} onClose={() => setSelectedCitation(null)} title={selectedCitation?.title || 'Policy source'} description={`Policy section ${selectedCitation?.section_id || ''}`} maxWidth="lg">
        <div className="space-y-4">
          <p className="leading-relaxed text-neutral-700">{selectedCitation?.snippet}</p>
          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3 text-xs flex items-center justify-between">
            <span className="text-neutral-500">Retrieval relevance</span>
            <strong>{Math.round((selectedCitation?.relevance_score || 0) * 100)}%</strong>
          </div>
        </div>
      </Modal>
    </div>
  );
};
