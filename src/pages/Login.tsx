import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Shield,
  User,
  Mail,
  Lock,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { useAuth, DemoRole } from '../context/AuthContext';

const DEMO_MODE = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';

export const Login: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
  // Mode: 'signin' | 'signup'
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Sign In credentials
  const [email, setEmail] = useState(DEMO_MODE ? 'admin@aerowear.com' : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'admin123' : '');
  const [selectedDemo, setSelectedDemo] = useState<DemoRole>('admin');

  // Sign Up fields (default user only: Name, Email, Password)
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Async states
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { login, register, loginAsDemo } = useAuth();

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setLoadingRole('manual');
      await login(email, password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoadingRole(null);
    }
  };

  const handleDemoLogin = async (role: DemoRole) => {
    setSelectedDemo(role);
    setError(null);
    try {
      setLoadingRole(role);
      await loginAsDemo(role);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoadingRole(null);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoadingRole('signup');
      // Public registration always creates a customer/user account.
      await register({
        full_name: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
      });
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Registration failed. Email may already be in use.');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#fbfbfb] text-neutral-900 flex flex-col justify-between items-center py-10 px-4 sm:px-6 antialiased selection:bg-neutral-900 selection:text-white">
      {/* Top Brand Header */}
      <div className="w-full max-w-[420px] flex items-center justify-center gap-2.5 mb-6">
        <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-sm">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm tracking-tight text-neutral-900">SupportPilot</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
            v2.0
          </span>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-[420px] bg-white border border-neutral-200/80 rounded-2xl p-7 shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.04)] space-y-5">
        {/* Card Title */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            {authMode === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {authMode === 'signin'
              ? 'Enter your credentials to access your support dashboard.'
              : 'Sign up for a customer account to contact support and track your requests.'}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 animate-in fade-in duration-150">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ===================== VIEW 1: SIGN IN FORM ===================== */}
        {authMode === 'signin' && (
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-neutral-700">Password</label>
                <span className="text-[10px] text-neutral-400 font-mono">Demo: admin123</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all font-mono"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loadingRole === 'manual'}
              className="w-full justify-center h-9 rounded-lg"
              icon={ArrowRight}
              iconPosition="right"
            >
              Sign In to Workspace
            </Button>

            {/* "Don't have an account? Sign up" */}
            <div className="text-center pt-1 text-xs text-neutral-500">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setError(null);
                }}
                className="font-semibold text-neutral-900 hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </div>
          </form>
        )}

        {/* ===================== VIEW 2: SIGN UP FORM (DEFAULT USER ONLY) ===================== */}
        {authMode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="e.g. Marcus Vance"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="marcus@company.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all font-mono"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loadingRole === 'signup'}
              className="w-full justify-center h-9 rounded-lg"
              icon={ArrowRight}
              iconPosition="right"
            >
              Create Account & Enter
            </Button>

            {/* "Already have an account? Sign in" */}
            <div className="text-center pt-1 text-xs text-neutral-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setError(null);
                }}
                className="font-semibold text-neutral-900 hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </div>
          </form>
        )}

        {/* ===================== DEMO ACCOUNT ROLE PILLS (MATCHING SCREENSHOT) ===================== */}
        {DEMO_MODE && <div className="pt-2">
          {/* Divider */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200/80" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold text-neutral-400 bg-white px-2">
              or demo account
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
              Role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('admin')}
                disabled={loadingRole !== null}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedDemo === 'admin'
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                    : 'bg-white text-neutral-700 border-neutral-200/90 hover:bg-neutral-50 hover:border-neutral-300'
                }`}
              >
                {loadingRole === 'admin' ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Admin'
                )}
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('agent')}
                disabled={loadingRole !== null}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedDemo === 'agent'
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                    : 'bg-white text-neutral-700 border-neutral-200/90 hover:bg-neutral-50 hover:border-neutral-300'
                }`}
              >
                {loadingRole === 'agent' ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Agent'
                )}
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('viewer')}
                disabled={loadingRole !== null}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedDemo === 'viewer'
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                    : 'bg-white text-neutral-700 border-neutral-200/90 hover:bg-neutral-50 hover:border-neutral-300'
                }`}
              >
                {loadingRole === 'viewer' ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Auditor'
                )}
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('customer')}
                disabled={loadingRole !== null}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedDemo === 'customer'
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                    : 'bg-white text-neutral-700 border-neutral-200/90 hover:bg-neutral-50 hover:border-neutral-300'
                }`}
              >
                {loadingRole === 'customer' ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Customer'
                )}
              </button>
            </div>
          </div>
        </div>}

        {/* Card Security Footnote */}
        <div className="pt-3 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
          <Shield className="w-3.5 h-3.5 text-neutral-400" />
          <span>Workspace isolated & secure</span>
        </div>
      </div>

      {/* Page Footer */}
      <div className="mt-6 text-center text-xs text-neutral-400">
        <p>© {new Date().getFullYear()} SupportPilot AI. All rights reserved.</p>
      </div>
    </div>
  );
};
