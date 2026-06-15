import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';

interface InputBarProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  isReady: boolean;
  ragEnabled: boolean;
}

export function InputBar({ onSend, onStop, isGenerating, isReady, ragEnabled }: InputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating || !isReady) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-area">
      <div className="input-wrapper">
        {ragEnabled && (
          <span title="RAG context active" style={{ fontSize: 16, lineHeight: 1, alignSelf: 'center', opacity: 0.7 }}>
            🔍
          </span>
        )}
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder={
            !isReady
              ? 'Load a model to start chatting…'
              : isGenerating
              ? 'Generating…'
              : ragEnabled
              ? 'Ask anything (RAG context active)…'
              : 'Ask me anything… (Enter to send, Shift+Enter for newline)'
          }
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isReady || isGenerating}
          rows={1}
        />

        {isGenerating ? (
          <button className="stop-btn" onClick={onStop} title="Stop generation">
            <Square size={15} fill="currentColor" />
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!value.trim() || !isReady}
            title="Send message (Enter)"
          >
            <Send size={15} />
          </button>
        )}
      </div>
      <p className="input-hint">
        Zero AI runs locally on your device · Private · No internet needed after model load
      </p>
    </div>
  );
}
