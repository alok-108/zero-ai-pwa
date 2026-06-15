import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Trash2, FileText, Loader2, RefreshCw } from 'lucide-react';
import { MODELS } from '../hooks/useWebLLM';
import type { AppSettings, RagDocument } from '../lib/db';
import {
  saveRagDocument,
  getAllRagDocuments,
  deleteRagDocument,
} from '../lib/db';
import { initRAG, addDocumentToRAG, resetRAG, rebuildRAGIndex } from '../lib/rag';

interface SettingsPanelProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
  onModelReload: (modelId: string) => void;
  currentModelId: string;
}

export function SettingsPanel({ settings, onSave, onClose, onModelReload, currentModelId }: SettingsPanelProps) {
  const [local, setLocal] = useState<AppSettings>({ ...settings });
  const [ragDocs, setRagDocs] = useState<RagDocument[]>([]);
  const [ragStatus, setRagStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isReindexing, setIsReindexing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved docs on mount
  useEffect(() => {
    getAllRagDocuments().then(setRagDocs);
  }, []);

  // Init RAG when enabled
  useEffect(() => {
    if (local.ragEnabled && ragStatus === 'idle') {
      setRagStatus('loading');
      initRAG()
        .then(async () => {
          // Re-index existing docs
          const docs = await getAllRagDocuments();
          for (const doc of docs) {
            await addDocumentToRAG(doc.id, doc.name, doc.content, local.ragChunkSize, local.ragChunkOverlap);
          }
          setRagStatus('ready');
        })
        .catch(() => setRagStatus('error'));
    }
    if (!local.ragEnabled) {
      resetRAG();
      setRagStatus('idle');
    }
  }, [local.ragEnabled]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const doc: RagDocument = {
      id: crypto.randomUUID(),
      name: file.name,
      content,
      addedAt: Date.now(),
    };
    await saveRagDocument(doc);
    
    if (ragStatus === 'ready') {
      await addDocumentToRAG(doc.id, doc.name, content, local.ragChunkSize, local.ragChunkOverlap);
    }
    
    setRagDocs((prev) => [doc, ...prev]);
    e.target.value = '';
  };

  const handleDeleteDoc = async (id: string) => {
    await deleteRagDocument(id);
    const updated = ragDocs.filter((d) => d.id !== id);
    setRagDocs(updated);
    
    if (ragStatus === 'ready') {
      setIsReindexing(true);
      try {
        await rebuildRAGIndex(updated, local.ragChunkSize, local.ragChunkOverlap);
      } catch (err) {
        console.error(err);
      } finally {
        setIsReindexing(false);
      }
    }
  };

  const handleReindexAll = async () => {
    if (ragStatus !== 'ready' || isReindexing) return;
    setIsReindexing(true);
    try {
      await rebuildRAGIndex(ragDocs, local.ragChunkSize, local.ragChunkOverlap);
      alert('RAG Index successfully rebuilt with new chunking settings!');
    } catch (err) {
      console.error(err);
      alert('Failed to rebuild RAG Index.');
    } finally {
      setIsReindexing(false);
    }
  };

  const handleSave = () => {
    onSave(local);
    if (local.modelId !== currentModelId) {
      onModelReload(local.modelId);
    }
    onClose();
  };

  const fmt = (n: number) => n.toFixed(1);

  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="settings-panel"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="settings-body">
          {/* Model */}
          <div className="settings-section">
            <div className="settings-section-title">Model</div>
            <div className="model-selector" style={{ gap: 8 }}>
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  className={`model-option ${local.modelId === m.id ? 'selected' : ''}`}
                  onClick={() => setLocal({ ...local, modelId: m.id })}
                  style={{ padding: '10px 12px' }}
                >
                  <span style={{ fontSize: 18 }}>{m.badge}</span>
                  <div className="model-info">
                    <div className="model-name" style={{ fontSize: 13 }}>{m.label}</div>
                    <div className="model-tags">
                      <span className="model-tag">{m.size}</span>
                      <span className="model-tag">{m.ram}</span>
                    </div>
                  </div>
                  {local.modelId === m.id && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </button>
              ))}
            </div>
            {local.modelId !== currentModelId && (
              <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 8 }}>
                ⚠️ Saving will reload the AI engine with the new model
              </p>
            )}
          </div>

          {/* Generation */}
          <div className="settings-section">
            <div className="settings-section-title">Generation Parameters</div>

            <div className="settings-item">
              <div className="settings-label">
                <span>Temperature</span>
                <span className="settings-value">{fmt(local.temperature)}</span>
              </div>
              <input
                type="range" min="0.1" max="1.0" step="0.1"
                value={local.temperature}
                onChange={(e) => setLocal({ ...local, temperature: parseFloat(e.target.value) })}
              />
            </div>

            <div className="settings-item">
              <div className="settings-label">
                <span>Max Response Tokens</span>
                <span className="settings-value">{local.maxTokens}</span>
              </div>
              <input
                type="range" min="128" max="2048" step="64"
                value={local.maxTokens}
                onChange={(e) => setLocal({ ...local, maxTokens: parseInt(e.target.value) })}
              />
            </div>

            <div className="settings-item">
              <div className="settings-label"><span>System Persona Prompt</span></div>
              <textarea
                className="system-prompt-input"
                value={local.systemPrompt}
                onChange={(e) => setLocal({ ...local, systemPrompt: e.target.value })}
                placeholder="You are a helpful AI assistant…"
              />
            </div>
          </div>

          {/* RAG */}
          <div className="settings-section">
            <div className="settings-section-title">RAG — Local Document Context</div>

            <div className="toggle-row">
              <div className="toggle-info">
                <label>Enable RAG Vector Search</label>
                <span>Inject uploaded file contents into LLM context</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.ragEnabled}
                  onChange={(e) => setLocal({ ...local, ragEnabled: e.target.checked })}
                />
                <span className="toggle-track" />
              </label>
            </div>

            <AnimatePresence>
              {local.ragEnabled && (
                <motion.div
                  className="rag-docs"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {ragStatus === 'loading' && (
                    <p style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 8 }}>
                      ⏳ Loading feature extraction model (~40 MB)…
                    </p>
                  )}
                  {ragStatus === 'error' && (
                    <p style={{ fontSize: 12, color: 'var(--error)', marginBottom: 8 }}>
                      ❌ Failed loading local Embeddings. Check internet connections.
                    </p>
                  )}

                  {/* Chunk Config Sliders */}
                  <div className="settings-item" style={{ marginTop: 10, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                    <div className="settings-label">
                      <span>Chunk Size (words)</span>
                      <span className="settings-value">{local.ragChunkSize}</span>
                    </div>
                    <input
                      type="range" min="100" max="1000" step="50"
                      value={local.ragChunkSize}
                      onChange={(e) => setLocal({ ...local, ragChunkSize: parseInt(e.target.value) })}
                    />

                    <div className="settings-label" style={{ marginTop: 10 }}>
                      <span>Chunk Overlap (words)</span>
                      <span className="settings-value">{local.ragChunkOverlap}</span>
                    </div>
                    <input
                      type="range" min="0" max="200" step="10"
                      value={local.ragChunkOverlap}
                      onChange={(e) => setLocal({ ...local, ragChunkOverlap: parseInt(e.target.value) })}
                    />
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, marginBottom: 10 }}>
                    <button className="upload-btn" onClick={() => fileInputRef.current?.click()} style={{ flex: 1, margin: 0 }}>
                      <Upload size={13} />
                      Upload File
                    </button>
                    {ragDocs.length > 0 && (
                      <button 
                        className="btn btn-ghost" 
                        onClick={handleReindexAll}
                        disabled={isReindexing || ragStatus !== 'ready'}
                        style={{ padding: '8px 12px', fontSize: 12 }}
                        title="Rebuild index with new chunk parameters"
                      >
                        {isReindexing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        Re-index All
                      </button>
                    )}
                  </div>

                  {/* Document Manager list */}
                  {ragDocs.length > 0 && (
                    <div className="doc-list" style={{ marginTop: 8 }}>
                      <strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                        Document Manager ({ragDocs.length})
                      </strong>
                      {ragDocs.map((doc) => (
                        <div key={doc.id} className="doc-item" style={{ fontSize: 12 }}>
                          <FileText size={13} color="var(--accent)" />
                          <span className="doc-name" style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {doc.name}
                          </span>
                          <span className="doc-size" style={{ marginRight: 8 }}>
                            {(doc.content.length / 1024).toFixed(1)}KB
                          </span>
                          <button
                            className="btn-icon btn-danger"
                            style={{ padding: 4 }}
                            onClick={() => handleDeleteDoc(doc.id)}
                            disabled={isReindexing}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Multimodal Settings */}
          <div className="settings-section">
            <div className="settings-section-title">Multimodal Configurations</div>
            
            <div className="settings-item">
              <div className="settings-label">
                <span>Hugging Face API Token</span>
              </div>
              <input
                type="password"
                value={local.hfToken || ''}
                onChange={(e) => setLocal({ ...local, hfToken: e.target.value })}
                placeholder="hf_..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginTop: 6,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
              <span className="input-help">Optional free API key to query cloud Flux generators.</span>
            </div>

            <div className="settings-item" style={{ marginTop: 12 }}>
              <div className="settings-label">
                <span>Default Image Generator Engine</span>
              </div>
              <select
                value={local.imgGenEngine}
                onChange={(e) => setLocal({ ...local, imgGenEngine: e.target.value as 'cloud' | 'local' })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginTop: 6,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              >
                <option value="cloud">Cloud (Flux.1 Schnell - Instant & Free)</option>
                <option value="local">Local WebGPU (Stable Diffusion 2.1 - Heavy download)</option>
              </select>
            </div>

            <div className="settings-item" style={{ marginTop: 12 }}>
              <div className="settings-label">
                <span>Default Object Detection Model</span>
              </div>
              <select
                value={local.detectModel}
                onChange={(e) => setLocal({ ...local, detectModel: e.target.value as 'owlvit' | 'detr' })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginTop: 6,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              >
                <option value="detr">DETR ResNet-50 (~166 MB, Fast standard)</option>
                <option value="owlvit">OWL-ViT Base (~600 MB, Zero-shot targets)</option>
              </select>
            </div>
          </div>

          {/* Theme */}
          <div className="settings-section">
            <div className="settings-section-title">Appearance</div>
            <div className="toggle-row">
              <div className="toggle-info">
                <label>Light Mode</label>
                <span>Switch between dark and light themes</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.theme === 'light'}
                  onChange={(e) => setLocal({ ...local, theme: e.target.checked ? 'light' : 'dark' })}
                />
                <span className="toggle-track" />
              </label>
            </div>
          </div>

          {/* Save */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}
            onClick={handleSave}
            disabled={isReindexing}
          >
            Save Settings
          </button>
        </div>
      </motion.div>
    </div>
  );
}
