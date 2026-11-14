import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Sliders, CheckCircle2, Copy, Check } from 'lucide-react';
import { Workspace } from '../types';
import { api } from '../lib/api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended — balanced quality & speed)' },
  { value: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite (Fastest — highest free-tier quota)' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (Fast, newer generation)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Deep reasoning — slower, lower quota)' },
];

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [name, setName] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.90);
  const [storeCreditCap, setStoreCreditCap] = useState(50.0);
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(true);
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const fetchSettings = async () => {
    try {
      const data = await api.getWorkspaceSettings();
      setWorkspace(data);
      setName(data.name);
      setConfidenceThreshold(data.settings.confidence_threshold);
      setStoreCreditCap(data.settings.store_credit_max_cap);
      setAutoPilotEnabled(data.settings.auto_pilot_enabled);
      setGeminiModel(data.settings.gemini_model || 'gemini-2.5-flash');
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      setSaving(true);
      setSavedSuccess(false);
      await api.updateWorkspaceSettings({
        name,
        settings: {
          confidence_threshold: Number(confidenceThreshold),
          store_credit_max_cap: Number(storeCreditCap),
          auto_pilot_enabled: autoPilotEnabled,
          delay_compensation_credit: 15.0,
          gemini_model: geminiModel,
          simulated_carrier: 'FedEx Express',
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      fetchSettings();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/webhooks/shipment-delayed`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-neutral-800" />
          Workspace & AI Safety Settings
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Configure deterministic guardrails, confidence gates, model selection, and integration webhooks.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {!canEdit && (
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-500 shrink-0" />
            <span>Read-only access. Workspace settings can only be changed by an administrator.</span>
          </div>
        )}
        {savedSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Workspace safety settings successfully updated!</span>
          </div>
        )}

        {/* Workspace Identity */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Workspace Identity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">Store / Workspace Name</label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">Slug / Identifier</label>
              <input
                type="text"
                disabled
                value={workspace?.slug || 'aerowear-prod'}
                className="w-full text-xs p-2.5 bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-500 cursor-not-allowed font-mono"
              />
            </div>
          </div>
        </div>

        {/* AI Model & Auto-Pilot */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">AI Model & Auto-Pilot Dispatch</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">Google Gemini Model</label>
              <select
                disabled={!canEdit}
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white cursor-pointer"
              >
                {!GEMINI_MODELS.some((m) => m.value === geminiModel) && (
                  <option value={geminiModel}>{geminiModel} (no longer available — falls back automatically)</option>
                )}
                {GEMINI_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
              <div>
                <span className="text-xs font-semibold text-neutral-900 block">Autonomous Auto-Pilot Resolution</span>
                <span className="text-[11px] text-neutral-500">
                  Allow the AI agent to immediately reply and execute safe permitted actions when confidence meets threshold.
                </span>
              </div>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setAutoPilotEnabled(!autoPilotEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  autoPilotEnabled ? 'bg-neutral-900' : 'bg-neutral-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoPilotEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Confidence Barrier Threshold: {Math.round(confidenceThreshold * 100)}%
                </label>
                <span className="text-[11px] text-neutral-400">
                  Cases below this threshold are routed to human review.
                </span>
              </div>
              <input
                type="range"
                disabled={!canEdit}
                min="0.50"
                max="0.95"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="w-full accent-neutral-900 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Store Financial & Safety Caps */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-700" />
            <h3 className="text-sm font-semibold text-neutral-900">Store Financial & Safety Caps</h3>
          </div>
          <p className="text-xs text-neutral-500">
            Hard financial ceilings enforced strictly by backend rules regardless of AI-generated confidence.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Maximum Store Credit Cap ($)
              </label>
              <input
                type="number"
                disabled={!canEdit}
                min="5"
                max="50"
                value={storeCreditCap}
                onChange={(e) => setStoreCreditCap(Number(e.target.value))}
                className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white font-mono"
              />
              <span className="text-[10px] text-neutral-400 mt-0.5 block">SRS limit: $50.00 absolute maximum</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                VIP Spend Threshold ($)
              </label>
              <input
                type="number"
                disabled
                value={200}
                className="w-full text-xs p-2.5 bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-500 font-mono cursor-not-allowed"
              />
              <span className="text-[10px] text-neutral-400 mt-0.5 block">Customers over $200 with negative sentiment trigger VIP_CHURN_RISK</span>
            </div>
          </div>
        </div>

        {/* Webhook Endpoints */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Carrier & E-Commerce Webhooks</h3>
          <p className="text-xs text-neutral-500">
            Ingest external shipping status exceptions from FedEx, UPS, or Shopify.
          </p>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-neutral-700 block">Shipment Delay Webhook URL</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/api/webhooks/shipment-delayed`}
                className="flex-1 text-xs p-2 bg-neutral-50 border border-neutral-200 rounded-lg font-mono text-neutral-600"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={copiedWebhook ? Check : Copy}
                onClick={copyWebhookUrl}
              >
                {copiedWebhook ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" size="lg" loading={saving} disabled={!canEdit}>
            Save All Workspace Settings
          </Button>
        </div>
      </form>
    </div>
  );
};
