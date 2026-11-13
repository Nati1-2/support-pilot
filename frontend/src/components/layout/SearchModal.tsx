import React, { useState, useEffect } from 'react';
import { Search, Inbox, Users, Package, Bot, BookOpen, BarChart3, Settings, ArrowRight } from 'lucide-react';
import { Modal } from '../common/Modal';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');

  const quickLinks = [
    { label: 'Inbox & Tickets', path: '/inbox', icon: Inbox, desc: 'View customer conversations' },
    { label: 'Needs Approval Queue', path: '/needs-approval', icon: Inbox, desc: 'Review AI drafts & guardrails' },
    { label: 'VIP / Critical Risk Queue', path: '/vip-critical', icon: Users, desc: 'High LTV churn cases' },
    { label: 'Customers Directory', path: '/customers', icon: Users, desc: 'Customer 360 profiles' },
    { label: 'Orders & Fulfillment', path: '/orders', icon: Package, desc: 'Investigate orders & tracking' },
    { label: 'AI Agent Playground', path: '/agent', icon: Bot, desc: 'Test live inquiries & inspect traces' },
    { label: 'Knowledge Base Policies', path: '/knowledge-base', icon: BookOpen, desc: 'Manage store policies & RAG' },
    { label: 'Analytics Dashboard', path: '/analytics', icon: BarChart3, desc: 'Deflection rate & hours saved' },
    { label: 'Workspace Settings', path: '/settings', icon: Settings, desc: 'Safety caps & thresholds' },
  ];

  const filteredLinks = quickLinks.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.desc.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  const handleSelect = (path: string) => {
    onNavigate(path);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Navigation & Search" maxWidth="lg">
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search pages, customers, orders, or commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-neutral-400"
          />
        </div>

        {/* Results */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {filteredLinks.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.path}
                onClick={() => handleSelect(item.path)}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 group-hover:text-neutral-900">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-800">{item.label}</p>
                    <p className="text-[11px] text-neutral-400">{item.desc}</p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-600 transition-colors" />
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
