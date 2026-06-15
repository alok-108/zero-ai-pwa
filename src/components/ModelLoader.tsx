import { motion, AnimatePresence } from 'framer-motion';
import { MODELS, type EngineStatus } from '../hooks/useWebLLM';
import { Shield, Wifi, Database, Cpu } from 'lucide-react';

interface ModelLoaderProps {
  status: EngineStatus;
  progress: string;
  progressPct: number;
  error: string;
  selectedModel: string;
  onModelChange: (id: string) => void;
  onLoad: () => void;
}

export function ModelLoader({
  status,
  progress,
  progressPct,
  error,
  selectedModel,
  onModelChange,
  onLoad,
}: ModelLoaderProps) {
  const isLoading = status === 'loading';
  const hasError = status === 'error' || status === 'unsupported';

  return (
    <div className="loader-overlay">
      <motion.div
        className="loader-card"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo */}
        <motion.div
          className="loader-icon"
          animate={isLoading ? { boxShadow: ['0 8px 32px rgba(99,102,241,0.25)', '0 8px 48px rgba(99,102,241,0.5)', '0 8px 32px rgba(99,102,241,0.25)'] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          🤖
        </motion.div>

        <h1>
          <span className="gradient-text">Zero AI</span>
        </h1>
        <p>
          100% private, 100% offline AI — running entirely on your device.<br />
          No servers. No API keys. No bills. Ever.
        </p>

        {/* Feature Pills */}
        <div className="loader-features">
          {[
            { icon: <Shield size={12} />, label: 'Private' },
            { icon: <Wifi size={12} />, label: 'Offline' },
            { icon: <Database size={12} />, label: 'IndexedDB' },
            { icon: <Cpu size={12} />, label: 'WebGPU' },
          ].map((f) => (
            <div key={f.label} className="feature-item">
              <span className="feature-icon">{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>

        {/* Model Selection */}
        {!isLoading && (
          <div className="model-selector">
            {MODELS.map((m) => (
              <button
                key={m.id}
                className={`model-option ${selectedModel === m.id ? 'selected' : ''}`}
                onClick={() => onModelChange(m.id)}
              >
                <span className="model-badge-icon">{m.badge}</span>
                <div className="model-info">
                  <div className="model-name">{m.label}</div>
                  <div className="model-desc">{m.description}</div>
                  <div className="model-tags">
                    <span className="model-tag">{m.size}</span>
                    <span className="model-tag">{m.speed}</span>
                    <span className="model-tag">{m.ram} RAM</span>
                  </div>
                </div>
                {selectedModel === m.id && (
                  <motion.div
                    layoutId="selected-check"
                    style={{ color: 'var(--accent)', fontSize: 18, fontWeight: 700 }}
                  >
                    ✓
                  </motion.div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Progress */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              className="progress-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="progress-label">
                <span style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: '75%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {progress || 'Initializing…'}
                </span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{progressPct}%</span>
              </div>
              <div className="progress-track">
                <motion.div
                  className="progress-fill"
                  style={{ width: `${progressPct}%` }}
                  transition={{ type: 'spring', stiffness: 80 }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                First time? Model is cached after download — next load is instant ⚡
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {hasError && error && (
            <motion.div
              className="error-box"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA Button */}
        {!isLoading && (
          <motion.button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15 }}
            onClick={onLoad}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {hasError ? '🔄 Try Again' : '🚀 Load AI Model'}
          </motion.button>
        )}

        {isLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
            <span className="animate-spin" style={{ display: 'inline-block', marginRight: 6 }}>⟳</span>
            Loading model… please keep this tab open
          </div>
        )}
      </motion.div>
    </div>
  );
}
