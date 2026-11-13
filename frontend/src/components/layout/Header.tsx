import React, { useState, useRef, useEffect } from 'react';
import { Search, Truck, Check, ChevronDown, UserCheck, ShieldCheck, Eye, LogOut, Menu } from 'lucide-react';
import { Button } from '../common/Button';
import { NotificationPopover } from '../notifications/NotificationPopover';
import { api } from '../../lib/api';
import { useAuth, DEMO_ACCOUNTS, DemoRole } from '../../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onOpenSearch: () => void;
  onDelaySimulated?: () => void;
  onOpenMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onOpenSearch,
  onDelaySimulated,
  onOpenMenu,
}) => {
  const { user, switchDemoUser, logout } = useAuth();
  const [simulating, setSimulating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSimulateCarrierDelay = async () => {
    try {
      setSimulating(true);
      const res = await api.simulateCarrierDelay();
      setFeedback(`Delay webhook ingested for ${res.order_number}! $15 courtesy credit issued.`);
      if (onDelaySimulated) onDelaySimulated();
      setTimeout(() => setFeedback(null), 4000);
    } catch (e: any) {
      setFeedback(`Simulation failed: ${e.message}`);
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setSimulating(false);
    }
  };

  const handleSwitchUser = async (role: DemoRole) => {
    setIsUserMenuOpen(false);
    try {
      await switchDemoUser(role);
      setFeedback(`Switched to ${DEMO_ACCOUNTS[role].name} (${role})`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (e) {
      console.warn(e);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <span className="text-[10px] font-semibold bg-neutral-900 text-white px-1.5 py-0.2 rounded">Admin</span>;
      case 'agent':
        return <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">Agent</span>;
      case 'viewer':
        return <span className="text-[10px] font-semibold bg-neutral-100 text-neutral-700 px-1.5 py-0.2 rounded">Viewer</span>;
      default:
        return null;
    }
  };

  return (
    <header className="h-14 bg-white border-b border-neutral-200/80 px-3 sm:px-6 flex items-center justify-between shrink-0 select-none">
      {/* Title & Context */}
      <div className="flex items-center gap-2 min-w-0">
        <button type="button" onClick={onOpenMenu} className="md:hidden p-1.5 rounded-md hover:bg-neutral-100 text-neutral-600" aria-label="Open navigation">
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-semibold text-neutral-900 leading-none truncate">{title}</h1>
          {subtitle && <p className="hidden sm:block text-[11px] text-neutral-400 mt-1 truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Toast / Feedback Banner if active */}
        {feedback && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-xs animate-in fade-in duration-150">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Global Search Shortcut */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 rounded-md text-xs text-neutral-500 transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-neutral-400" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline text-[10px] bg-white border border-neutral-200 text-neutral-400 px-1 rounded">
            ⌘K
          </kbd>
        </button>

        {/* Proactive Simulate Carrier Delay Demo Button */}
        <div className="hidden lg:block"><Button
          size="sm"
          variant="secondary"
          icon={Truck}
          loading={simulating}
          onClick={handleSimulateCarrierDelay}
          title="Simulate Carrier Delay Webhook (48h exception + $15 credit)"
          disabled={user?.role === 'viewer'}
        >
          Simulate Carrier Delay
        </Button></div>

        {/* Notifications Popover */}
        <NotificationPopover />

        {/* Demo User Switcher Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-md border border-neutral-200/80 hover:bg-neutral-50 transition-colors cursor-pointer text-xs"
            title="Switch Demo Role"
          >
            <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-[10px]">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <span className="font-semibold text-neutral-800 hidden md:inline truncate max-w-[120px]">
              {user?.full_name || 'Demo User'}
            </span>
            {getRoleBadge(user?.role)}
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-dropdown border border-neutral-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="p-3 border-b border-neutral-100 bg-neutral-50/50">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Signed in as
                </span>
                <p className="text-xs font-bold text-neutral-900 truncate">{user?.full_name}</p>
                <p className="text-[11px] text-neutral-500 font-mono truncate">{user?.email}</p>
              </div>

              <div className="p-2 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block px-2 py-1">
                  Switch Demo Account
                </span>

                {/* Switch to Admin */}
                <button
                  type="button"
                  onClick={() => handleSwitchUser('admin')}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    user?.email === DEMO_ACCOUNTS.admin.email
                      ? 'bg-neutral-100 font-semibold text-neutral-900'
                      : 'hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-neutral-500" />
                    <div>
                      <p className="font-medium text-neutral-900 leading-none">Alexander Hayes</p>
                      <span className="text-[10px] text-neutral-400">Admin Privileges</span>
                    </div>
                  </div>
                  {user?.email === DEMO_ACCOUNTS.admin.email && (
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                  )}
                </button>

                {/* Switch to Agent */}
                <button
                  type="button"
                  onClick={() => handleSwitchUser('agent')}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    user?.email === DEMO_ACCOUNTS.agent.email
                      ? 'bg-blue-50 font-semibold text-blue-900'
                      : 'hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <div>
                      <p className="font-medium text-neutral-900 leading-none">Sarah Jenkins</p>
                      <span className="text-[10px] text-neutral-400">Support Specialist</span>
                    </div>
                  </div>
                  {user?.email === DEMO_ACCOUNTS.agent.email && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  )}
                </button>

                {/* Switch to Viewer */}
                <button
                  type="button"
                  onClick={() => handleSwitchUser('viewer')}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    user?.email === DEMO_ACCOUNTS.viewer.email
                      ? 'bg-neutral-100 font-semibold text-neutral-900'
                      : 'hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-neutral-500" />
                    <div>
                      <p className="font-medium text-neutral-900 leading-none">Elena Rostova</p>
                      <span className="text-[10px] text-neutral-400">Auditor & Viewer</span>
                    </div>
                  </div>
                  {user?.email === DEMO_ACCOUNTS.viewer.email && (
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                  )}
                </button>
              </div>

              <div className="p-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out of session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
