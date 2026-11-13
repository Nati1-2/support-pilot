import React from 'react';
import {
  LayoutDashboard,
  Inbox,
  CheckSquare,
  Flame,
  Users,
  Package,
  Bot,
  BookOpen,
  Workflow,
  BarChart3,
  Settings,
  ChevronRight,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  needsApprovalCount: number;
  vipRiskCount: number;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  needsApprovalCount,
  vipRiskCount,
  className,
}) => {
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Overview', path: '/overview', icon: LayoutDashboard },
    { label: 'Inbox', path: '/inbox', icon: Inbox },
    {
      label: 'Needs Approval',
      path: '/needs-approval',
      icon: CheckSquare,
      badge: needsApprovalCount > 0 ? needsApprovalCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      label: 'VIP / Critical',
      path: '/vip-critical',
      icon: Flame,
      badge: vipRiskCount > 0 ? vipRiskCount : undefined,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    { header: 'Operations' },
    { label: 'Customers', path: '/customers', icon: Users },
    { label: 'Orders', path: '/orders', icon: Package },
    { header: 'AI & Automation' },
    { label: 'AI Agent', path: '/agent', icon: Bot },
    { label: 'Knowledge Base', path: '/knowledge-base', icon: BookOpen },
    { label: 'Automations', path: '/automations', icon: Workflow },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { header: 'System' },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className={cn("w-64 bg-white border-r border-neutral-200/80 flex flex-col h-screen select-none shrink-0", className)}>
      {/* Brand & Workspace Selector */}
      <div className="p-4 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center text-white shadow-subtle">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-neutral-900">SupportPilot</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">v2.0</span>
            </div>
            <p className="text-[11px] text-neutral-400">Agentic Support Platform</p>
          </div>
        </div>

        {/* Workspace Pill */}
        <div className="mt-3.5 flex items-center justify-between px-2.5 py-1.5 bg-neutral-50 border border-neutral-200/70 rounded-md text-xs text-neutral-700 hover:bg-neutral-100/60 transition-colors cursor-pointer">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-medium truncate">AeroWear Goods</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {navItems.map((item, idx) => {
          if (item.header) {
            return (
              <div key={idx} className="pt-4 pb-1 px-2.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                {item.header}
              </div>
            );
          }

          const Icon = item.icon!;
          const isActive = currentPath === item.path;

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path!)}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                isActive
                  ? 'bg-neutral-100 text-neutral-900 font-semibold'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-neutral-900' : 'text-neutral-400')} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-semibold border',
                    item.badgeColor || 'bg-neutral-200 text-neutral-800 border-neutral-300'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-neutral-100 bg-neutral-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-neutral-200 border border-neutral-300 flex items-center justify-center font-medium text-xs text-neutral-700">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="truncate text-left">
              <p className="text-xs font-medium text-neutral-800 truncate">{user?.full_name || 'Admin User'}</p>
              <p className="text-[10px] text-neutral-400 capitalize">{user?.role || 'Administrator'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
