import { useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../lib/db';

interface ChatWindowProps {
  messages: Message[];
  streamingId: string | null;
  isReady: boolean;
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  'Explain quantum computing simply',
  'Write a Python function to sort a list',
  'What is the meaning of life?',
  'Help me write a professional email',
];

export function ChatWindow({ messages, streamingId, isReady, onSuggestion }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingId]);

  if (messages.length === 0) {
    return (
      <div className="chat-window" style={{ justifyContent: 'center' }}>
        <div className="chat-empty">
          <div className="chat-empty-icon">🤖</div>
          <div>
            <h2>
              {isReady ? 'What can I help you with?' : 'Load the AI model to start'}
            </h2>
            <p>
              {isReady
                ? 'Your personal AI is ready. All conversations stay on your device.'
                : 'Choose a model from the settings above and click "Load AI Model" to begin.'}
            </p>
          </div>
          {isReady && (
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion-chip" onClick={() => onSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="message-group">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={msg.id === streamingId}
            />
          ))}
        </AnimatePresence>
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
