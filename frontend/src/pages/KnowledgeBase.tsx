import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Trash2, Edit2, Sliders, CheckCircle2 } from 'lucide-react';
import { PolicySection } from '../types';
import { api } from '../lib/api';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';

export const KnowledgeBase: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';
  const [policies, setPolicies] = useState<PolicySection[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Policy Modal
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('returns');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [saving, setSaving] = useState(false);

  // RAG Tester
  const [ragQuery, setRagQuery] = useState('Can I return a jacket delivered 2 weeks ago?');
  const [ragResults, setRagResults] = useState<any[] | null>(null);
  const [ragLoading, setRagLoading] = useState(false);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const data = await api.getPolicies(categoryFilter);
      setPolicies(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [categoryFilter]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setCategory('returns');
    setContent('');
    setSummary('');
    setTagsStr('');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (p: PolicySection) => {
    setEditingId(p.id);
    setTitle(p.title);
    setCategory(p.category);
    setContent(p.content);
    setSummary(p.summary);
    setTagsStr(p.tags?.join(', ') || '');
    setIsEditorOpen(true);
  };

  const handleSavePolicy = async () => {
    if (!title.trim() || !content.trim()) return;
    try {
      setSaving(true);
      const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
      if (editingId) {
        await api.updatePolicy(editingId, { title, category, content, summary, tags });
      } else {
        await api.createPolicy({ title, category, content, summary, tags, is_active: true });
      }
      setIsEditorOpen(false);
      fetchPolicies();
    } catch (e: any) {
      alert(`Save error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePolicy = async (id: string) => {
    if (!confirm('Are you sure you want to remove this policy section?')) return;
    try {
      await api.deletePolicy(id);
      fetchPolicies();
    } catch (e: any) {
      alert(`Delete error: ${e.message}`);
    }
  };

  const handleTestRAG = async () => {
    if (!ragQuery.trim()) return;
    try {
      setRagLoading(true);
      const res = await api.testRAG(ragQuery);
      setRagResults(res.citations || []);
    } catch (e: any) {
      alert(`RAG test error: ${e.message}`);
    } finally {
      setRagLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-neutral-800" />
            Knowledge Base & Store Policies
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Store policies used by the AI RAG engine to ground customer support replies with verifiable citations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" icon={Plus} onClick={handleOpenCreate} disabled={!canEdit}>
            New Policy Section
          </Button>
        </div>
      </div>

      {/* Interactive Policy RAG Tester */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-subtle space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-neutral-700" />
            Interactive Policy RAG Retrieval Tester
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Test how customer questions are matched against store policies to verify relevance scores and extracted snippets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={ragQuery}
            onChange={(e) => setRagQuery(e.target.value)}
            placeholder="Type customer question (e.g. Can I change my address after order shipped?)..."
            className="flex-1 text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-neutral-400"
          />
          <Button
            size="md"
            variant="primary"
            icon={Search}
            loading={ragLoading}
            onClick={handleTestRAG}
          >
            Test RAG Match
          </Button>
        </div>

        {ragResults && (
          <div className="pt-3 border-t border-neutral-100 space-y-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
              Retrieved Policy Citations ({ragResults.length})
            </span>
            {ragResults.length === 0 ? (
              <p className="text-xs text-neutral-500">No policy sections met the similarity threshold.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ragResults.map((cite, idx) => (
                  <div key={idx} className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-neutral-900">
                      <span>{cite.title}</span>
                      <Badge variant="primary" size="sm">
                        {Math.round(cite.relevance_score * 100)}% match
                      </Badge>
                    </div>
                    <p className="text-neutral-600 text-[11px] leading-relaxed">
                      "{cite.snippet}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Policies List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-700">Category Filter:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-neutral-700 cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="returns">Returns & RMA</option>
              <option value="shipping">Shipping & Delays</option>
              <option value="store_credit">Store Credit & Goodwill</option>
              <option value="escalations">Escalations & VIP</option>
            </select>
          </div>
          <span className="text-xs text-neutral-400">{policies.length} Policy Sections</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-subtle hover:border-neutral-300 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Badge variant="outline" size="sm" className="uppercase font-mono text-[10px]">
                    {p.category}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                      title="Edit Policy"
                      disabled={!canEdit}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePolicy(p.id)}
                      className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                      title="Delete Policy"
                      disabled={!canEdit}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-neutral-900">{p.title}</h3>
                <p className="text-xs text-neutral-600 mt-1 leading-relaxed">{p.content}</p>
              </div>

              {p.tags && p.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-neutral-100">
                  {p.tags.map((t, idx) => (
                    <span key={idx} className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Policy Editor Modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingId ? 'Edit Store Policy Section' : 'Add Store Policy Section'}
        description="Policy text will be indexed by the RAG service and quoted in AI customer replies."
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleSavePolicy}
            >
              Save Policy
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">Policy Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 30-Day Return & RMA Authorization Policy"
              className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white"
            >
              <option value="returns">Returns & RMA</option>
              <option value="shipping">Shipping & Delays</option>
              <option value="store_credit">Store Credit & Goodwill</option>
              <option value="escalations">Escalations & VIP</option>
              <option value="general">General Policies</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">Policy Content</label>
            <textarea
              rows={5}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Detailed rules, conditions, deadlines, and compensation amounts..."
              className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white font-sans leading-relaxed"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">Keywords & Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="return, rma, exchange, 30_days, refund"
              className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:bg-white"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
