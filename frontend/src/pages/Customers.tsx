import React, { useState, useEffect } from 'react';
import { Search, Users, ExternalLink, Package, Inbox, Shield, Phone, Mail } from 'lucide-react';
import { Customer, Order, Ticket } from '../types';
import { api } from '../lib/api';
import { Badge, VIPBadge, SentimentBadge, StatusBadge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../lib/utils';

interface CustomersProps {
  onNavigateTicket: (ticketId: string) => void;
}

export const Customers: React.FC<CustomersProps> = ({ onNavigateTicket }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<(Customer & { orders: Order[]; tickets: Ticket[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers(search, vipOnly);
      setCustomers(data);
    } catch (e) {
      console.warn('Error fetching customers', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [vipOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const openCustomer360 = async (customerId: string) => {
    try {
      const full = await api.getCustomer(customerId);
      setSelectedCustomer(full);
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-neutral-800" />
            Customer Directory
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            360° customer profiles, lifetime value (LTV), sentiment analysis, and order histories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 w-52"
            />
          </form>

          <button
            onClick={() => setVipOnly(!vipOnly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              vipOnly
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            VIP Only ($200+ LTV)
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-neutral-200/80 rounded-xl shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-400 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-6">Customer</th>
                <th className="py-3 px-6">Contact</th>
                <th className="py-3 px-6">Total Spent (LTV)</th>
                <th className="py-3 px-6">Orders</th>
                <th className="py-3 px-6">Sentiment</th>
                <th className="py-3 px-6">Tier</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openCustomer360(c.id)}
                  className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-6 font-semibold text-neutral-900">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center font-medium text-neutral-700">
                        {c.name.charAt(0)}
                      </div>
                      <span>{c.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 text-neutral-600">
                    <div>{c.email}</div>
                    {c.phone && <div className="text-[11px] text-neutral-400">{c.phone}</div>}
                  </td>
                  <td className="py-3.5 px-6 font-semibold text-neutral-900">
                    {formatCurrency(c.total_spent)}
                  </td>
                  <td className="py-3.5 px-6 text-neutral-600">
                    {c.orders_count} orders
                  </td>
                  <td className="py-3.5 px-6">
                    <SentimentBadge
                      sentiment={
                        c.sentiment_score > 0.7
                          ? 'positive'
                          : c.sentiment_score < 0.3
                          ? 'frustrated'
                          : 'neutral'
                      }
                    />
                  </td>
                  <td className="py-3.5 px-6">
                    {c.is_vip ? <VIPBadge churnRisk={c.tags?.includes('churn_risk')} /> : <Badge variant="neutral" size="sm">Standard</Badge>}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openCustomer360(c.id)}>
                      View 360°
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer 360 Modal */}
      <Modal
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title={`Customer 360° — ${selectedCustomer?.name || ''}`}
        description={`Account created: ${formatDate(selectedCustomer?.created_at)}`}
        maxWidth="2xl"
      >
        {selectedCustomer && (
          <div className="space-y-5">
            {/* Overview Stats */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-200/70 text-xs">
              <div>
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Lifetime Value</span>
                <span className="text-base font-bold text-neutral-900">{formatCurrency(selectedCustomer.total_spent)}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Orders Placed</span>
                <span className="text-base font-bold text-neutral-900">{selectedCustomer.orders_count} orders</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Status Tier</span>
                <div className="mt-1">
                  {selectedCustomer.is_vip ? <VIPBadge churnRisk={selectedCustomer.tags?.includes('churn_risk')} /> : <Badge variant="neutral">Standard</Badge>}
                </div>
              </div>
            </div>

            {/* Past Orders */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-neutral-500" /> Order History ({selectedCustomer.orders?.length || 0})
              </h4>
              <div className="space-y-2">
                {selectedCustomer.orders?.map((ord) => (
                  <div key={ord.id} className="p-3 bg-white border border-neutral-200 rounded-lg text-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900">{ord.order_number}</span>
                        <Badge variant={ord.status === 'delivered' ? 'success' : ord.status === 'delayed' ? 'warning' : 'neutral'} size="sm">
                          {ord.status}
                        </Badge>
                      </div>
                      <span className="text-neutral-500 text-[11px]">
                        {ord.items?.map((i) => i.name).join(', ')}
                      </span>
                    </div>
                    <span className="font-semibold text-neutral-900">{formatCurrency(ord.total_amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Past Support Tickets */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5 text-neutral-500" /> Conversation & Ticket History ({selectedCustomer.tickets?.length || 0})
              </h4>
              <div className="space-y-2">
                {selectedCustomer.tickets?.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedCustomer(null);
                      onNavigateTicket(t.id);
                    }}
                    className="p-3 bg-white border border-neutral-200 rounded-lg text-xs flex items-center justify-between hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900">{t.title}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <span className="text-neutral-400 text-[11px] font-mono">
                        Intent: {t.intent || 'General'} • Confidence: {t.ai_confidence ? `${Math.round(t.ai_confidence * 100)}%` : 'N/A'}
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-400">{formatDate(t.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
