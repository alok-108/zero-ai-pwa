import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';

import { ModelLoader } from './components/ModelLoader';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { ImageGen } from './components/ImageGen';
import { VisionDetect } from './components/VisionDetect';

// Lazy load heavy tabs to avoid bundling Monaco/Chart.js on initial load
const CodeEditor = lazy(() => import('./components/CodeEditor').then(m => ({ default: m.CodeEditor })));
const StockAnalyzer = lazy(() => import('./components/StockAnalyzer').then(m => ({ default: m.StockAnalyzer })));

import { useWebLLM } from './hooks/useWebLLM';
import { useConversations } from './hooks/useConversations';
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type AppSettings, type Message } from './lib/db';
import { retrieveContext } from './lib/rag';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'image-gen' | 'vision' | 'code' | 'stocks'>('chat');
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // WebLLM engine
  const { status, progress, progressPct, error, loadModel, reloadModel, generateResponse } = useWebLLM(settings.modelId);

  // Conversations
  const {
    conversations,
    activeConversation,
    activeId,
    loading: convsLoading,
    newConversation,
    selectConversation,
    addMessage,
    updateLastMessage,
    removeConversation,
    renameConversation,
  } = useConversations();

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      document.documentElement.setAttribute('data-theme', s.theme);
    });
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Auto-create first conversation
  useEffect(() => {
    if (!convsLoading && conversations.length === 0) {
      newConversation();
    }
  }, [convsLoading]);

  const handleSaveSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const handleModelReload = useCallback(async (modelId: string) => {
    await reloadModel(modelId);
  }, [reloadModel]);

  const handleSend = useCallback(async (text: string) => {
    if (!activeId || isGenerating || status !== 'ready') return;

    let convId = activeId;

    // Add user message
    const userMsg = await addMessage(convId, { role: 'user', content: text });

    // Build system prompt with optional RAG context
    let systemContent = settings.systemPrompt;
    if (settings.ragEnabled) {
      const context = await retrieveContext(text);
      if (context) {
        systemContent = `${settings.systemPrompt}\n\nRelevant context from your documents:\n${context}\n\nAnswer based on the context above if relevant.`;
      }
    }

    const systemMsg: Message = {
      id: 'system',
      role: 'system',
      content: systemContent,
      timestamp: Date.now(),
    };

    // Build messages array for API
    const conv = conversations.find((c) => c.id === convId);
    const history = conv ? conv.messages : [];
    const apiMessages: Message[] = [
      systemMsg,
      ...history,
      userMsg,
    ];

    // Add placeholder assistant message
    const assistantPlaceholder = await addMessage(convId, {
      role: 'assistant',
      content: '',
    });
    setStreamingMsgId(assistantPlaceholder.id);
    setIsGenerating(true);

    abortRef.current = new AbortController();
    let fullContent = '';

    try {
      await generateResponse(
        apiMessages,
        settings.temperature,
        settings.maxTokens,
        (token) => {
          fullContent += token;
          updateLastMessage(convId, fullContent);
        },
        abortRef.current.signal
      );
    } catch (err) {
      if (!abortRef.current.signal.aborted) {
        updateLastMessage(convId, '❌ An error occurred. Please try again.');
        console.error(err);
      }
    } finally {
      setStreamingMsgId(null);
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [activeId, isGenerating, status, settings, conversations, addMessage, updateLastMessage, generateResponse]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleNewChat = useCallback(() => {
    newConversation();
    setSidebarOpen(false); // close on mobile
    setActiveTab('chat');
  }, [newConversation]);

  // Show model loader if not ready (only when in chat tab)
  const showLoader = activeTab === 'chat' && (status === 'idle' || status === 'loading' || status === 'error' || status === 'unsupported');

  const activeTitle = activeConversation?.title ?? 'New Chat';

  return (
    <>
      {/* Model Loader Overlay */}
      <AnimatePresence>
        {showLoader && (
          <ModelLoader
            status={status}
            progress={progress}
            progressPct={progressPct}
            error={error}
            selectedModel={settings.modelId}
            onModelChange={(id) => handleSaveSettings({ ...settings, modelId: id })}
            onLoad={loadModel}
          />
        )}
      </AnimatePresence>

      <div className="app-layout">
        {/* Sidebar */}
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => { selectConversation(id); setSidebarOpen(false); setActiveTab('chat'); }}
          onNew={handleNewChat}
          onDelete={removeConversation}
          onRename={renameConversation}
          onSettings={() => setSettingsOpen(true)}
          theme={settings.theme}
          onThemeToggle={() => handleSaveSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />

        {/* Main workspace */}
        <main className="app-main">
          {/* Header */}
          <header className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', minWidth: 140 }}>
              <button
                className="btn-icon"
                onClick={() => setSidebarOpen((v) => !v)}
                title="Toggle sidebar"
                style={{ flexShrink: 0 }}
              >
                <Menu size={18} />
              </button>
              <span className="header-title" style={{ display: activeTab === 'chat' ? 'inline' : 'none' }}>
                {activeTitle}
              </span>
              <span className="header-title" style={{ display: activeTab === 'image-gen' ? 'inline' : 'none' }}>
                🎨 Image Generator
              </span>
              <span className="header-title" style={{ display: activeTab === 'vision' ? 'inline' : 'none' }}>
                🔍 Vision Detector
              </span>
              <span className="header-title" style={{ display: activeTab === 'code' ? 'inline' : 'none' }}>
                💻 Code Editor
              </span>
              <span className="header-title" style={{ display: activeTab === 'stocks' ? 'inline' : 'none' }}>
                📈 Stock Analyzer
              </span>
            </div>

            {/* Header tab navigation */}
            <div className="header-tabs">
              <button
                className={`header-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                💬 Chat
              </button>
              <button
                className={`header-tab-btn ${activeTab === 'image-gen' ? 'active' : ''}`}
                onClick={() => setActiveTab('image-gen')}
              >
                🎨 Image Gen
              </button>
              <button
                className={`header-tab-btn ${activeTab === 'vision' ? 'active' : ''}`}
                onClick={() => setActiveTab('vision')}
              >
                🔍 Vision
              </button>
              <button
                className={`header-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                onClick={() => setActiveTab('code')}
              >
                💻 Code
              </button>
              <button
                className={`header-tab-btn ${activeTab === 'stocks' ? 'active' : ''}`}
                onClick={() => setActiveTab('stocks')}
              >
                📈 Stocks
              </button>
            </div>

            {/* Status badge */}
            <div
              className={`status-badge ${status}`}
              style={{ visibility: activeTab === 'chat' ? 'visible' : 'hidden', minWidth: 80, justifyContent: 'center' }}
            >
              <span className="status-dot" />
              {status === 'ready' && 'AI Ready'}
              {status === 'loading' && `${progressPct}%`}
              {status === 'idle' && 'Offline'}
              {status === 'error' && 'Error'}
              {status === 'unsupported' && 'No WebGPU'}
            </div>
          </header>

          {/* Conditional content views */}
          {activeTab === 'chat' && (
            <>
              {/* Chat */}
              <ChatWindow
                messages={activeConversation?.messages ?? []}
                streamingId={streamingMsgId}
                isReady={status === 'ready'}
                onSuggestion={handleSend}
              />

              {/* Input */}
              <InputBar
                onSend={handleSend}
                onStop={handleStop}
                isGenerating={isGenerating}
                isReady={status === 'ready'}
                ragEnabled={settings.ragEnabled}
              />
            </>
          )}

          {activeTab === 'image-gen' && (
            <ImageGen settings={settings} />
          )}

          {activeTab === 'vision' && (
            <VisionDetect settings={settings} />
          )}

          {activeTab === 'code' && (
            <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading Code Editor…</div>}>
              <CodeEditor
                settings={settings}
                generateResponse={generateResponse}
                aiReady={status === 'ready'}
              />
            </Suspense>
          )}

          {activeTab === 'stocks' && (
            <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading Stock Analyzer…</div>}>
              <StockAnalyzer
                settings={settings}
                generateResponse={generateResponse}
                aiReady={status === 'ready'}
              />
            </Suspense>
          )}
        </main>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onSave={handleSaveSettings}
            onClose={() => setSettingsOpen(false)}
            onModelReload={handleModelReload}
            currentModelId={settings.modelId}
          />
        )}
      </AnimatePresence>
    </>
  );
}
