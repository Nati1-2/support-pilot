import React, { useState, useEffect } from 'react';
import { Search, Package, MapPin, DollarSign, RotateCcw, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Order } from '../types';
import { api } from '../lib/api';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export const Orders: React.FC = () => {
  const { user } = useAuth();
  const canAct = user?.role === 'admin' || user?.role === 'agent';
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Address Modal
  const [addressModalOrder, setAddressModalOrder] = useState<Order | null>(null);
  const [newStreet, setNewStreet] = useState('742 Evergreen Terrace');
  const [newCity, setNewCity] = useState('Springfield');
  const [newState, setNewState] = useState('OR');
  const [newZip, setNewZip] = useState('97477');
  const [addressResult, setAddressResult] = useState<{ error?: string; success?: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Store Credit Modal
  const [creditModalOrder, setCreditModalOrder] = useState<Order | null>(null);
  const [creditAmount, setCreditAmount] = useState<number>(20);
  const [creditReason, setCreditReason] = useState('Courtesy delay compensation');
  const [creditResult, setCreditResult] = useState<{ error?: string; success?: string } | null>(null);

  // RMA Modal
  const [rmaModalOrder, setRmaModalOrder] = useState<Order | null>(null);
  const [rmaReason, setRmaReason] = useState('Customer return for exchange');
  const [rmaResult, setRmaResult] = useState<{ error?: string; success?: string } | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getOrders(search, statusFilter);
      setOrders(data);
    } catch (e) {
      console.warn('Error fetching orders', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleUpdateAddress = async () => {
    if (!addressModalOrder) return;
    setAddressResult(null);
    try {
      setActionLoading(true);
      const res = await api.updateOrderAddress(addressModalOrder.id, {
        street: newStreet,
        city: newCity,
        state: newState,
        zip_code: newZip,
        country: 'United States',
      });
      setAddressResult({ success: res.message });
      fetchOrders();
    } catch (err: any) {
      setAddressResult({ error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssueCredit = async () => {
    if (!creditModalOrder) return;
    setCreditResult(null);
    try {
      setActionLoading(true);
      const res = await api.issueStoreCredit(creditModalOrder.id, Number(creditAmount), creditReason);
      setCreditResult({ success: `${res.message} (Total credits: ${formatCurrency(res.order_total_credits)})` });
      fetchOrders();
    } catch (err: any) {
      setCreditResult({ error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateRMA = async () => {
    if (!rmaModalOrder) return;
    setRmaResult(null);
    try {
      setActionLoading(true);
      const res = await api.generateRMALabel(rmaModalOrder.id, rmaReason);
      setRmaResult({ success: `${res.message} Generated Label: ${res.rma_label.label_id} (${res.rma_label.carrier})` });
      fetchOrders();
    } catch (err: any) {
      setRmaResult({ error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-neutral-800" />
            Order Investigation & Actions
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Real-time warehouse order tracking, pre-dispatch modification, goodwill credits, and RMA generation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by order #, tracking..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 w-56"
            />
          </form>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-neutral-700 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="unfulfilled">Unfulfilled (Pre-Dispatch)</option>
            <option value="in_transit">In Transit</option>
            <option value="delayed">Delayed</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-neutral-200/80 rounded-xl shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-400 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-6">Order</th>
                <th className="py-3 px-6">Customer</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Carrier / Tracking</th>
                <th className="py-3 px-6">Total & Credits</th>
                <th className="py-3 px-6">Shipping Address</th>
                <th className="py-3 px-6 text-right">Guardrailed Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3.5 px-6 font-semibold text-neutral-900">
                    <span className="font-mono text-xs">{o.order_number}</span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      {o.items?.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="font-medium text-neutral-900">{o.customer_name || 'Customer'}</div>
                    <div className="text-[11px] text-neutral-400">{o.customer_email}</div>
                  </td>
                  <td className="py-3.5 px-6">
                    <Badge
                      variant={
                        o.status === 'delivered'
                          ? 'success'
                          : o.status === 'delayed'
                          ? 'warning'
                          : o.status === 'in_transit'
                          ? 'primary'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {o.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-6">
                    {o.tracking_number ? (
                      <div>
                        <span className="font-mono text-[11px] text-neutral-800">{o.tracking_number}</span>
                        <span className="text-[10px] text-neutral-400 block">{o.carrier || 'FedEx'}</span>
                      </div>
                    ) : (
                      <span className="text-neutral-400 italic text-[11px]">Pending tracking</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="font-semibold text-neutral-900">{formatCurrency(o.total_amount)}</div>
                    {o.credits_issued > 0 && (
                      <span className="text-[10px] text-emerald-700 font-medium block">
                        +{formatCurrency(o.credits_issued)} credit
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-neutral-600 max-w-xs truncate">
                    {o.shipping_address.street}, {o.shipping_address.city} {o.shipping_address.state}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={MapPin}
                        onClick={() => {
                          setAddressModalOrder(o);
                          setAddressResult(null);
                        }}
                        title="Test Address Change Guardrail (Only permitted if unfulfilled)"
                        disabled={!canAct}
                      >
                        Address
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={DollarSign}
                        onClick={() => {
                          setCreditModalOrder(o);
                          setCreditResult(null);
                        }}
                        title="Test Store Credit Guardrail ($50 hard cap)"
                        disabled={!canAct}
                      >
                        Credit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={RotateCcw}
                        onClick={() => {
                          setRmaModalOrder(o);
                          setRmaResult(null);
                        }}
                        title="Test Return RMA Guardrail (30 days of delivery)"
                        disabled={!canAct}
                      >
                        RMA
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Address Update Modal */}
      <Modal
        isOpen={!!addressModalOrder}
        onClose={() => setAddressModalOrder(null)}
        title={`Update Shipping Address — ${addressModalOrder?.order_number}`}
        description="Testing Pre-Dispatch Guardrail: Can ONLY update if order status is 'unfulfilled'. In-transit or delivered orders are strictly rejected."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddressModalOrder(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading}
              onClick={handleUpdateAddress}
            >
              Execute Address Update
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/70 text-xs">
            <span className="text-neutral-500">Current Order Status: </span>
            <span className="font-semibold text-neutral-900 capitalize">{addressModalOrder?.status}</span>
            <p className="text-[11px] text-neutral-400 mt-1">
              Shipping address can only be modified prior to warehouse fulfillment.
            </p>
          </div>

          {addressResult?.error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{addressResult.error}</span>
            </div>
          )}

          {addressResult?.success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{addressResult.success}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">New Street Address</label>
            <input
              type="text"
              value={newStreet}
              onChange={(e) => setNewStreet(e.target.value)}
              className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">City</label>
              <input
                type="text"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">State</label>
              <input
                type="text"
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
                className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">Zip</label>
              <input
                type="text"
                value={newZip}
                onChange={(e) => setNewZip(e.target.value)}
                className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Issue Store Credit Modal */}
      <Modal
        isOpen={!!creditModalOrder}
        onClose={() => setCreditModalOrder(null)}
        title={`Issue Store Credit — ${creditModalOrder?.order_number}`}
        description="Testing Hard Cap Guardrail: Maximum limit is strictly $50.00. Amounts exceeding $50 or order total are automatically rejected."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreditModalOrder(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading}
              onClick={handleIssueCredit}
            >
              Issue Store Credit
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/70 text-xs">
            <span className="text-neutral-500">Order Total: </span>
            <span className="font-semibold text-neutral-900">{formatCurrency(creditModalOrder?.total_amount || 0)}</span>
            <span className="text-neutral-400 ml-2">(Max policy cap: $50.00)</span>
          </div>

          {creditResult?.error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{creditResult.error}</span>
            </div>
          )}

          {creditResult?.success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{creditResult.success}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">
              Credit Amount ($) — Try entering $75 to test guardrail rejection
            </label>
            <input
              type="number"
              min="1"
              value={creditAmount}
              onChange={(e) => setCreditAmount(Number(e.target.value))}
              className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">Reason</label>
            <input
              type="text"
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white"
            />
          </div>
        </div>
      </Modal>

      {/* RMA Generation Modal */}
      <Modal
        isOpen={!!rmaModalOrder}
        onClose={() => setRmaModalOrder(null)}
        title={`Generate Prepaid RMA Return Label — ${rmaModalOrder?.order_number}`}
        description="Testing 30-Day Delivered Return Policy: Merchandise must be delivered within the last 30 days."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRmaModalOrder(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading}
              onClick={handleGenerateRMA}
            >
              Generate RMA
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/70 text-xs">
            <span className="text-neutral-500">Order Delivery Status: </span>
            <span className="font-semibold text-neutral-900 capitalize">{rmaModalOrder?.status}</span>
          </div>

          {rmaResult?.error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{rmaResult.error}</span>
            </div>
          )}

          {rmaResult?.success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{rmaResult.success}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">Return Reason</label>
            <input
              type="text"
              value={rmaReason}
              onChange={(e) => setRmaReason(e.target.value)}
              className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
