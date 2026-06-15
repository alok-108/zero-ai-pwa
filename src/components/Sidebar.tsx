import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Check, X, MessageSquare, Menu } from 'lucide-react';
import type { Conversation } from '../lib/db';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSettings: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

function ConvItem({
  conv,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(conv.title);

  const confirmRename = () => {
    if (editValue.trim()) onRename(editValue.trim());
    setEditing(false);
  };

  return (
    <motion.div
      className={`conv-item ${isActive ? 'active' : ''}`}
      onClick={() => !editing && onSelect()}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      layout
    >
      <MessageSquare size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

      {editing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmRename();
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ flex: 1, fontSize: 13, padding: '2px 4px', background: 'var(--bg-elevated)', border: '1px solid var(--border-focus)', borderRadius: 4, color: 'var(--text-primary)' }}
        />
      ) : (
        <span className="conv-title">{conv.title}</span>
      )}

      <div className="conv-actions" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <>
            <button className="btn-icon" onClick={confirmRename} style={{ padding: 3 }}><Check size={12} color="var(--success)" /></button>
            <button className="btn-icon" onClick={() => setEditing(false)} style={{ padding: 3 }}><X size={12} /></button>
          </>
        ) : (
          <>
            <button className="btn-icon" onClick={() => { setEditing(true); setEditValue(conv.title); }} style={{ padding: 3 }} title="Rename"><Edit2 size={12} /></button>
            <button className="btn-icon btn-danger" onClick={onDelete} style={{ padding: 3 }} title="Delete"><Trash2 size={12} /></button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onSettings,
  theme,
  onThemeToggle,
  isOpen,
  onToggle,
}: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 19, display: 'none',
            }}
            className="mobile-backdrop"
          />
        )}
      </AnimatePresence>

      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">🤖</div>
            <span className="gradient-text">Zero AI</span>
          </div>
          <button className="btn-icon" onClick={onToggle} title="Close sidebar">
            <Menu size={18} />
          </button>
        </div>

        {/* New Chat */}
        <button className="new-chat-btn" onClick={onNew}>
          <Plus size={16} />
          New Chat
        </button>

        {/* Conversation List */}
        <div className="conv-list">
          {conversations.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              No conversations yet.<br />Start a new chat!
            </p>
          ) : (
            <AnimatePresence mode="popLayout">
              {conversations.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === activeId}
                  onSelect={() => onSelect(conv.id)}
                  onDelete={() => onDelete(conv.id)}
                  onRename={(title) => onRename(conv.id, title)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }} onClick={onSettings}>
            ⚙️ Settings
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '8px 10px', fontSize: 18 }}
            onClick={onThemeToggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </aside>
    </>
  );
}
