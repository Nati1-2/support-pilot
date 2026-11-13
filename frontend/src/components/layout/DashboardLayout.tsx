import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SearchModal } from './SearchModal';
import { api } from '../../lib/api';

interface DashboardLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currentPath,
  onNavigate,
  title,
  subtitle,
  children,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [needsApprovalCount, setNeedsApprovalCount] = useState(0);
  const [vipRiskCount, setVipRiskCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fetchBadgeCounts = async () => {
    try {
      const approvalTickets = await api.getApprovalQueue();
      setNeedsApprovalCount(approvalTickets.length);

      const vipTickets = await api.getTickets({ queue: 'vip' });
      setVipRiskCount(vipTickets.filter((t) => t.vip_churn_risk || t.sentiment === 'frustrated').length);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchBadgeCounts();
    const interval = setInterval(fetchBadgeCounts, 10000);
    return () => clearInterval(interval);
  }, []);

  // Cmd+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        needsApprovalCount={needsApprovalCount}
        vipRiskCount={vipRiskCount}
        className="hidden md:flex"
      />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button className="absolute inset-0 bg-neutral-900/35" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close navigation" />
          <div className="relative w-64 max-w-[85vw] shadow-2xl">
            <Sidebar
              currentPath={currentPath}
              onNavigate={(path) => { onNavigate(path); setIsMobileMenuOpen(false); }}
              needsApprovalCount={needsApprovalCount}
              vipRiskCount={vipRiskCount}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={title}
          subtitle={subtitle}
          onOpenSearch={() => setIsSearchOpen(true)}
          onDelaySimulated={fetchBadgeCounts}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
