import { useState, useEffect, useCallback } from 'react';
import {
  getAllConversations,
  saveConversation,
  deleteConversation,
  createConversation,
  type Conversation,
  type Message,
} from '../lib/db';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load all conversations on mount
  useEffect(() => {
    getAllConversations().then((convs) => {
      setConversations(convs);
      if (convs.length > 0) setActiveId(convs[0].id);
      setLoading(false);
    });
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const newConversation = useCallback(() => {
    const conv = createConversation();
    saveConversation(conv);
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    return conv;
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const addMessage = useCallback(
    async (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> => {
      const fullMessage: Message = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const updated: Conversation = {
            ...c,
            messages: [...c.messages, fullMessage],
            updatedAt: Date.now(),
            // Set title from first user message
            title:
              c.messages.length === 0 && message.role === 'user'
                ? message.content.slice(0, 40) + (message.content.length > 40 ? '…' : '')
                : c.title,
          };
          saveConversation(updated);
          return updated;
        })
      );

      return fullMessage;
    },
    []
  );

  const updateLastMessage = useCallback((conversationId: string, content: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c;
        const messages = [...c.messages];
        if (messages.length === 0) return c;
        messages[messages.length - 1] = { ...messages[messages.length - 1], content };
        const updated = { ...c, messages, updatedAt: Date.now() };
        saveConversation(updated);
        return updated;
      })
    );
  }, []);

  const removeConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setConversations((prev) => {
          const remaining = prev.filter((c) => c.id !== id);
          setActiveId(remaining.length > 0 ? remaining[0].id : null);
          return remaining;
        });
      }
    },
    [activeId]
  );

  const renameConversation = useCallback(async (id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, title };
        saveConversation(updated);
        return updated;
      })
    );
  }, []);

  const clearMessages = useCallback(
    async (conversationId: string) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const updated = { ...c, messages: [], updatedAt: Date.now() };
          saveConversation(updated);
          return updated;
        })
      );
    },
    []
  );

  return {
    conversations,
    activeConversation,
    activeId,
    loading,
    newConversation,
    selectConversation,
    addMessage,
    updateLastMessage,
    removeConversation,
    renameConversation,
    clearMessages,
  };
}
