import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Inbox } from './pages/Inbox';
import { NeedsApproval } from './pages/NeedsApproval';
import { VipCritical } from './pages/VipCritical';
import { Customers } from './pages/Customers';
import { Orders } from './pages/Orders';
import { AgentWorkspace } from './pages/AgentWorkspace';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Automations } from './pages/Automations';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { CustomerPortal } from './pages/CustomerPortal';

const AppContent: React.FC = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>('/overview');
  const [targetTicketId, setTargetTicketId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-50 text-neutral-400">
        <div className="w-6 h-6 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setCurrentPath('/overview')} />;
  }

  if (user?.role === 'customer') {
    return <CustomerPortal />;
  }

  const handleNavigateTicket = (ticketId: string) => {
    setTargetTicketId(ticketId);
    setCurrentPath('/inbox');
  };

  const getPageMeta = () => {
    switch (currentPath) {
      case '/overview':
        return { title: 'Overview Dashboard', subtitle: 'Support metrics, deflection rate, and operational performance' };
      case '/inbox':
        return { title: 'Support Inbox', subtitle: 'Live conversation threads, customer context, and order investigations' };
      case '/needs-approval':
        return { title: 'Needs Approval', subtitle: 'Human review queue for gated AI drafts and sensitive actions' };
      case '/vip-critical':
        return { title: 'VIP / Critical Retention', subtitle: 'High LTV customers experiencing negative sentiment or churn risk' };
      case '/customers':
        return { title: 'Customers', subtitle: 'Customer 360° profiles, lifetime spend, order histories, and sentiment' };
      case '/orders':
        return { title: 'Orders & Fulfillment', subtitle: 'Real-time carrier tracking, address updates, and RMA returns' };
      case '/agent':
        return { title: 'AI Agent Workspace', subtitle: 'Interactive pipeline playground, function calling tools, and audit traces' };
      case '/knowledge-base':
        return { title: 'Knowledge Base', subtitle: 'Official store policies, chunked embeddings, and policy citations' };
      case '/automations':
        return { title: 'Automations & Rules', subtitle: 'Proactive webhook monitors, confidence barriers, and SLA rules' };
      case '/analytics':
        return { title: 'Analytics & Insights', subtitle: 'Deflection metrics, continuous edit feedback, and hours saved' };
      case '/settings':
        return { title: 'Settings', subtitle: 'Workspace parameters, store safety limits, and webhooks' };
      default:
        return { title: 'Dashboard', subtitle: '' };
    }
  };

  const { title, subtitle } = getPageMeta();

  return (
    <DashboardLayout
      currentPath={currentPath}
      onNavigate={setCurrentPath}
      title={title}
      subtitle={subtitle}
    >
      {currentPath === '/overview' && (
        <Overview
          onNavigate={setCurrentPath}
          onSelectTicket={handleNavigateTicket}
        />
      )}
      {currentPath === '/inbox' && (
        <Inbox
          initialTicketId={targetTicketId}
          onClearInitialTicket={() => setTargetTicketId(null)}
        />
      )}
      {currentPath === '/needs-approval' && (
        <NeedsApproval onNavigateTicket={handleNavigateTicket} />
      )}
      {currentPath === '/vip-critical' && (
        <VipCritical onNavigateTicket={handleNavigateTicket} />
      )}
      {currentPath === '/customers' && (
        <Customers onNavigateTicket={handleNavigateTicket} />
      )}
      {currentPath === '/orders' && <Orders />}
      {currentPath === '/agent' && <AgentWorkspace />}
      {currentPath === '/knowledge-base' && <KnowledgeBase />}
      {currentPath === '/automations' && <Automations />}
      {currentPath === '/analytics' && <Analytics />}
      {currentPath === '/settings' && <Settings />}
    </DashboardLayout>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
