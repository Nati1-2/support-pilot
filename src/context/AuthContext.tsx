import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../lib/api';

export type DemoRole = 'admin' | 'agent' | 'viewer' | 'customer';

export interface DemoAccount {
  role: DemoRole;
  email: string;
  name: string;
  title: string;
  description: string;
  password: string;
  badgeColor: string;
}

export const DEMO_ACCOUNTS: Record<DemoRole, DemoAccount> = {
  admin: {
    role: 'admin',
    email: 'admin@aerowear.com',
    name: 'Alexander Hayes',
    title: 'Workspace Administrator',
    description: 'Full workspace privileges, safety cap adjustments, store policies & AI settings.',
    password: 'admin123',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  agent: {
    role: 'agent',
    email: 'sarah.support@aerowear.com',
    name: 'Sarah Jenkins',
    title: 'Support Specialist',
    description: 'Inbox triage, customer conversations, review queue approvals, and action dispatch.',
    password: 'agent123',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  viewer: {
    role: 'viewer',
    email: 'viewer@aerowear.com',
    name: 'Elena Rostova',
    title: 'Support Auditor & Analyst',
    description: 'Read-only audit inspector, analytics metrics review, and execution trace observer.',
    password: 'viewer123',
    badgeColor: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  },
  customer: {
    role: 'customer',
    email: 'customer@aerowear.com',
    name: 'Sophia Rodriguez',
    title: 'Customer Portal User',
    description: 'Submit inquiries, review updates, citations, and reply inside the customer portal.',
    password: 'customer123',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    workspace_name?: string;
  }) => Promise<void>;
  loginAsDemo: (role: DemoRole) => Promise<void>;
  switchDemoUser: (role: DemoRole) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('supportpilot_token');
      if (token) {
        try {
          const me = await api.getCurrentUser();
          setUser(me);
        } catch (err) {
          console.warn('Failed to validate session token, falling back to login');
          localStorage.removeItem('supportpilot_token');
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem('supportpilot_token', res.access_token);
    setUser(res.user);
  };

  const register = async (data: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    workspace_name?: string;
  }) => {
    const res = await api.register(data);
    localStorage.setItem('supportpilot_token', res.access_token);
    setUser(res.user);
  };

  const loginAsDemo = async (role: DemoRole) => {
    const account = DEMO_ACCOUNTS[role];
    if (account) {
      await login(account.email, account.password);
    }
  };

  const switchDemoUser = async (role: DemoRole) => {
    await loginAsDemo(role);
  };

  const logout = () => {
    localStorage.removeItem('supportpilot_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginAsDemo,
        switchDemoUser,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
