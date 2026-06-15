import { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Square, Trash2, Sparkles, Loader2, Download as DownloadIcon, ChevronDown, ChevronUp, Terminal, Code2, Monitor } from 'lucide-react';
import { usePyodide } from '../hooks/usePyodide';
import type { AppSettings } from '../lib/db';

interface CodeEditorProps {
  settings: AppSettings;
  generateResponse?: (
    messages: any[],
    temperature: number,
    maxTokens: number,
    onToken: (token: string) => void,
    signal?: AbortSignal,
  ) => Promise<string>;
  aiReady?: boolean;
}

const PYTHON_PRESETS = [
  {
    label: '🐍 Fibonacci Sequence',
    code: `# 🐍 Fibonacci sequence calculator
# Runs entirely client-side inside browser Pyodide WASM

def fibonacci(n):
    """Generate first n Fibonacci numbers."""
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result

# Calculate and display
fib = fibonacci(15)
print("🔢 First 15 Fibonacci numbers:")
print(fib)
`
  },
  {
    label: '📊 NumPy Array Operations',
    code: `# 📊 NumPy client-side analysis
# Demonstrating WASM speed inside your browser

import numpy as np

print("⚡ Initializing random normal arrays...")
data = np.random.normal(loc=100.0, scale=15.0, size=500)

mean = np.mean(data)
std = np.std(data)
median = np.median(data)

print(f"📊 Dataset elements count: {len(data)}")
print(f"📈 Arithmetic Mean: {mean:.4f}")
print(f"📉 Standard Deviation: {std:.4f}")
print(f"🎯 Median: {median:.4f}")
`
  },
  {
    label: '📝 String Utilities',
    code: `# 📝 Python string manipulation helpers
text = "zero ai offline client-side pwa workspace"

print("Original Text:", text)
print("Upper Case Format:", text.upper())
print("Title Case Format:", text.title())
print("List of Words:", text.split())
print("Reversed letters:", text[::-1])
`
  }
];

const WEB_PRESETS = [
  {
    label: '🌐 Standard Greeting Template',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      background: #0f172a;
      color: #f1f5f9;
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      gap: 16px;
    }
    h1 {
      color: #8b5cf6;
      text-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
      margin: 0;
    }
    button {
      padding: 10px 24px;
      background: #8b5cf6;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 500;
      transition: background 0.2s;
    }
    button:hover {
      background: #a78bfa;
    }
  </style>
</head>
<body>
  <h1>🌐 Web Sandbox Player</h1>
  <p>Modify HTML/CSS/JS here. Outputs will stream to the preview panels.</p>
  <button onclick="greet()">Trigger Event!</button>

  <script>
    function greet() {
      console.log("👋 Action button clicked inside the iframe!");
      alert("Greetings from Zero AI Web Sandbox!");
    }
    console.log("🚀 Web Sandbox initialized and ready.");
  </script>
</body>
</html>`
  },
  {
    label: '💚 Matrix Digital Rain',
    code: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: black; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="c"></canvas>
  <script>
    const c = document.getElementById("c");
    const ctx = c.getContext("2d");
    
    // Resize canvas
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    
    const characters = "ZERO-AI-101010-PWA-OFFLINE-FREE";
    const alphabet = characters.split("");
    const fontSize = 16;
    const columns = c.width / fontSize;
    const rainDrops = Array(Math.floor(columns)).fill(1);
    
    function draw() {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#0F0";
      ctx.font = fontSize + "px monospace";
      
      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet[Math.floor(Math.random() * alphabet.length)];
        ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);
        
        if (rainDrops[i] * fontSize > c.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
    }
    
    setInterval(draw, 33);
    console.log("🟢 Matrix Code Rain system loaded at 30 FPS!");
  </script>
</body>
</html>`
  },
  {
    label: '✨ SVG Floating Bubbles',
    code: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: #090d16; margin: 0; height: 100vh; overflow: hidden; }
    svg { width: 100%; height: 100%; }
    circle { fill: #8b5cf6; opacity: 0.45; transition: all 0.4s ease; cursor: pointer; }
    circle:hover { fill: #ec4899; scale: 1.4; opacity: 1; }
  </style>
</head>
<body>
  <svg id="s"></svg>
  <script>
    const s = document.getElementById("s");
    for(let i = 0; i < 60; i++) {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", Math.random() * window.innerWidth);
      c.setAttribute("cy", Math.random() * window.innerHeight);
      c.setAttribute("r", Math.random() * 25 + 8);
      s.appendChild(c);
    }
    console.log("✨ Created 60 interactive SVG particles!");
  </script>
</body>
</html>`
  }
];

const AI_PROMPTS = [
  { label: '🐛 Debug this code', prompt: 'Debug the following code. Find any bugs, explain them, and provide the corrected code:\n\n' },
  { label: '📖 Explain this code', prompt: 'Explain the following code in detail. What does each part do?\n\n' },
  { label: '⚡ Optimize this', prompt: 'Optimize the following code for better performance. Explain your optimizations:\n\n' },
  { label: '🧪 Write unit tests', prompt: 'Write comprehensive unit tests for the following code:\n\n' },
  { label: '📝 Add docstrings/comments', prompt: 'Add comprehensive explanations and documentation comments to the following code:\n\n' },
];

interface ConsoleEntry {
  type: 'stdout' | 'stderr' | 'result' | 'info' | 'warn';
  text: string;
  timestamp: number;
}

export function CodeEditor({ settings, generateResponse, aiReady }: CodeEditorProps) {
  // Lang Toggle: python or web (HTML/CSS/JS)
  const [lang, setLang] = useState<'python' | 'web'>('python');

  // Code editors text state
  const [pythonCode, setPythonCode] = useState(PYTHON_PRESETS[0].code);
  const [webCode, setWebCode] = useState(WEB_PRESETS[0].code);
  
  // Console outputs
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Web sandbox iframe source
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<'console' | 'preview'>('console');

  // AI assistant panel
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(0);
  const [showPromptMenu, setShowPromptMenu] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Pyodide loader hook
  const { status: pyStatus, loadProgress, loadRuntime, runPython, isReady: pyReady } = usePyodide();

  // Reset console and toggle templates on language change
  useEffect(() => {
    setConsoleEntries([]);
    setSrcDoc(null);
    setActiveOutputTab('console');
  }, [lang]);

  // Set up message listener to capture Console inputs inside Web Sandbox iframe
  useEffect(() => {
    const handleSandboxConsole = (e: MessageEvent) => {
      if (e.data && e.data.type === 'CONSOLE_LOG') {
        const { level, args } = e.data;
        const textStr = args.join(' ');
        const typeMapping: Record<string, 'stdout' | 'stderr' | 'warn'> = {
          info: 'stdout',
          error: 'stderr',
          warn: 'warn'
        };
        
        setConsoleEntries((prev) => [
          ...prev,
          {
            type: typeMapping[level] || 'stdout',
            text: textStr,
            timestamp: Date.now()
          }
        ]);
      }
    };

    window.addEventListener('message', handleSandboxConsole);
    return () => window.removeEventListener('message', handleSandboxConsole);
  }, []);

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleEntries]);

  // Trigger Python or JS/HTML Sandbox Execution
  const handleRun = useCallback(async () => {
    const ts = Date.now();
    setConsoleEntries((prev) => [...prev, { type: 'info', text: '▶ Running workspace...', timestamp: ts }]);

    if (lang === 'python') {
      if (!pyReady || isRunning) return;
      setIsRunning(true);

      const { stdout, stderr, result } = await runPython(pythonCode);
      const entries: ConsoleEntry[] = [];
      
      if (stdout) entries.push({ type: 'stdout', text: stdout, timestamp: ts + 1 });
      if (stderr) entries.push({ type: 'stderr', text: stderr, timestamp: ts + 2 });
      if (result && result !== 'undefined') entries.push({ type: 'result', text: `→ ${result}`, timestamp: ts + 3 });
      if (entries.length === 0) entries.push({ type: 'info', text: '✓ Code executed (no output)', timestamp: ts + 1 });

      setConsoleEntries((prev) => [...prev, ...entries]);
      setIsRunning(false);
    } else {
      // Execute Web HTML5 sandbox via iframe srcdoc redirection
      setIsRunning(true);
      setActiveOutputTab('preview'); // Auto-switch to visual tab

      // Sandbox log capturing hook script injector
      const captureHook = `
        <script>
          (function() {
            window.addEventListener('error', function(e) {
              window.parent.postMessage({ type: 'CONSOLE_LOG', level: 'error', args: [e.message] }, '*');
            });
            const wrap = (name) => {
              const orig = console[name];
              console[name] = function(...args) {
                orig.apply(console, args);
                window.parent.postMessage({
                  type: 'CONSOLE_LOG',
                  level: name === 'error' ? 'error' : (name === 'warn' ? 'warn' : 'info'),
                  args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))
                }, '*');
              };
            };
            wrap('log');
            wrap('error');
            wrap('warn');
          })();
        </script>
      `;

      // Formulate srcdoc content
      setSrcDoc(captureHook + webCode);
      
      setTimeout(() => {
        setConsoleEntries((prev) => [...prev, { type: 'info', text: '✓ Web frame loaded successfully.', timestamp: Date.now() }]);
        setIsRunning(false);
      }, 500);
    }
  }, [lang, pyReady, isRunning, pythonCode, webCode, runPython]);

  // Stop current execution
  const handleStop = () => {
    if (lang === 'web') {
      setSrcDoc(null);
      setConsoleEntries((prev) => [...prev, { type: 'info', text: '⏹ Sandbox terminated.', timestamp: Date.now() }]);
      setIsRunning(false);
    }
  };

  const handleClearConsole = useCallback(() => {
    setConsoleEntries([]);
  }, []);

  // AI Prompt builder
  const handleAskAI = useCallback(async () => {
    if (!generateResponse || !aiReady || aiLoading) return;

    setAiLoading(true);
    setAiResponse('');
    setShowAiPanel(true);

    const promptObj = AI_PROMPTS[selectedPrompt];
    const systemMsg = { 
      id: 'sys', 
      role: 'system' as const, 
      content: `You are an expert ${lang === 'python' ? 'Python' : 'HTML/CSS/JS Web'} developer. Be concise and help write premium implementations. Format response output in clean markdown blocks.`, 
      timestamp: Date.now() 
    };
    
    const activeCode = lang === 'python' ? pythonCode : webCode;
    const userMsg = { 
      id: 'usr', 
      role: 'user' as const, 
      content: `${promptObj.prompt}\`\`\`${lang === 'python' ? 'python' : 'html'}\n${activeCode}\n\`\`\``, 
      timestamp: Date.now() 
    };

    abortRef.current = new AbortController();
    let full = '';

    try {
      await generateResponse(
        [systemMsg, userMsg],
        settings.temperature,
        settings.maxTokens,
        (token) => {
          full += token;
          setAiResponse(full);
        },
        abortRef.current.signal,
      );
    } catch {
      if (!abortRef.current?.signal.aborted) {
        setAiResponse('❌ AI assistance failed. Please verify the AI model is loaded and fully ready.');
      }
    } finally {
      setAiLoading(false);
      abortRef.current = null;
    }
  }, [generateResponse, aiReady, aiLoading, lang, pythonCode, webCode, selectedPrompt, settings]);

  const handleStopAI = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleDownloadCode = useCallback(() => {
    const blob = new Blob([lang === 'python' ? pythonCode : webCode], { 
      type: lang === 'python' ? 'text/x-python' : 'text/html' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = lang === 'python' ? 'script.py' : 'index.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [lang, pythonCode, webCode]);

  const monacoTheme = settings.theme === 'dark' ? 'vs-dark' : 'light';

  return (
    <div className="tab-container fade-in">
      {/* Top Banner language toggle */}
      <div className="sub-tab-header">
        <button
          className={`sub-tab-btn ${lang === 'python' ? 'active' : ''}`}
          onClick={() => setLang('python')}
        >
          🐍 Python Executor (Pyodide)
        </button>
        <button
          className={`sub-tab-btn ${lang === 'web' ? 'active' : ''}`}
          onClick={() => setLang('web')}
        >
          🌐 Web Sandbox (HTML/CSS/JS)
        </button>
      </div>

      {/* Loader for Pyodide */}
      {lang === 'python' && pyStatus !== 'ready' && (
        <div className="pyodide-banner" style={{ margin: '0px 16px 12px 16px' }}>
          {pyStatus === 'idle' && (
            <>
              <Terminal size={18} />
              <span>Python execution engine is offline</span>
              <button className="btn btn-primary" onClick={loadRuntime} style={{ padding: '6px 16px', fontSize: 13 }}>
                Load Python WebAssembly
              </button>
            </>
          )}
          {pyStatus === 'loading' && (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{loadProgress}</span>
            </>
          )}
          {pyStatus === 'error' && (
            <>
              <span style={{ color: 'var(--error)' }}>❌ Failed loading Python runtime</span>
              <button className="btn btn-ghost" onClick={loadRuntime} style={{ fontSize: 13 }}>
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {/* Editor & Console panels */}
      <div className="code-workspace" style={{ height: 'calc(100% - 48px)' }}>
        {/* Left Side: Editor panel */}
        <div className="code-editor-panel">
          <div className="code-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Code2 size={16} color="var(--accent)" />
              {/* Presets dropdown selector */}
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (lang === 'python') {
                    setPythonCode(PYTHON_PRESETS[parseInt(val)].code);
                  } else {
                    setWebCode(WEB_PRESETS[parseInt(val)].code);
                  }
                  e.target.value = "";
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">📁 Code Templates...</option>
                {lang === 'python' 
                  ? PYTHON_PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)
                  : WEB_PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)
                }
              </select>
            </div>

            {/* Run tools */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-primary code-run-btn"
                onClick={handleRun}
                disabled={lang === 'python' ? (!pyReady || isRunning) : false}
                title="Execute workspace code"
              >
                {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {isRunning ? 'Compiling…' : 'Run'}
              </button>

              {lang === 'web' && srcDoc && (
                <button
                  className="btn btn-ghost"
                  onClick={handleStop}
                  title="Stop frame execution"
                  style={{ color: 'var(--error)' }}
                >
                  <Square size={14} />
                  Stop
                </button>
              )}

              {/* AI assist */}
              <div className="ai-prompt-dropdown" style={{ position: 'relative' }}>
                <button
                  className="btn btn-ghost code-ai-btn"
                  onClick={() => setShowPromptMenu(!showPromptMenu)}
                  disabled={!aiReady}
                  title={aiReady ? 'AI Assistant actions' : 'Model loading needed in Chat tab'}
                >
                  <Sparkles size={14} />
                  {AI_PROMPTS[selectedPrompt].label.split(' ').slice(1).join(' ')}
                  {showPromptMenu ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {showPromptMenu && (
                  <div className="prompt-menu">
                    {AI_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        className={`prompt-menu-item ${i === selectedPrompt ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedPrompt(i);
                          setShowPromptMenu(false);
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border)', padding: '6px 8px' }}>
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', padding: '6px', fontSize: 12 }}
                        onClick={() => {
                          setShowPromptMenu(false);
                          handleAskAI();
                        }}
                      >
                        <Sparkles size={12} /> Ask AI Assist
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button className="btn-icon" onClick={handleDownloadCode} title="Download file">
                <DownloadIcon size={14} />
              </button>
            </div>
          </div>

          <div className="monaco-wrapper">
            <Editor
              height="100%"
              language={lang === 'python' ? 'python' : 'html'}
              theme={monacoTheme}
              value={lang === 'python' ? pythonCode : webCode}
              onChange={(v) => {
                if (lang === 'python') setPythonCode(v || '');
                else setWebCode(v || '');
              }}
              options={{
                fontSize: 14,
                fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace",
                minimap: { enabled: false },
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 },
                automaticLayout: true,
                bracketPairColorization: { enabled: true },
                renderLineHighlight: 'all',
                smoothScrolling: true,
              }}
            />
          </div>
        </div>

        {/* Right Side: Output consoles */}
        <div className="code-output-panel">
          {/* Web Tab bar */}
          {lang === 'web' && (
            <div className="sub-tab-header" style={{ borderBottom: '1px solid var(--border)', margin: 0, padding: '4px 12px' }}>
              <button
                className={`sub-tab-btn ${activeOutputTab === 'console' ? 'active' : ''}`}
                onClick={() => setActiveOutputTab('console')}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                <Terminal size={12} />
                Console Logs
              </button>
              <button
                className={`sub-tab-btn ${activeOutputTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveOutputTab('preview')}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                <Monitor size={12} />
                Live Preview
              </button>
            </div>
          )}

          {/* Terminal Console View */}
          {activeOutputTab === 'console' ? (
            <div className={`code-console ${showAiPanel ? 'shrunk' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="console-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Terminal size={14} />
                  <span>Output Terminal</span>
                  {lang === 'python' && pyReady && <span className="console-ready-badge">Python ready</span>}
                </div>
                <button className="btn-icon" onClick={handleClearConsole} title="Clear terminal screen">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="console-body" style={{ flex: 1, overflowY: 'auto' }}>
                {consoleEntries.length === 0 && (
                  <div className="console-empty">
                    <Terminal size={24} />
                    <p>Print outputs and runtime logs will appear here.</p>
                  </div>
                )}
                {consoleEntries.map((entry, i) => (
                  <div key={i} className={`console-line ${entry.type}`}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{entry.text}</pre>
                  </div>
                ))}
                <div ref={consoleEndRef} />
              </div>
            </div>
          ) : (
            // Live iframe Sandbox View
            <div className={`code-console ${showAiPanel ? 'shrunk' : ''}`} style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
              {srcDoc ? (
                <iframe
                  title="Live Preview Sandbox"
                  srcDoc={srcDoc}
                  sandbox="allow-scripts"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    backgroundColor: '#ffffff'
                  }}
                />
              ) : (
                <div className="console-empty">
                  <Monitor size={24} />
                  <p>Click "Run" to render your HTML/CSS/JS live preview here.</p>
                </div>
              )}
            </div>
          )}

          {/* AI Assist Drawer Panel */}
          {showAiPanel && (
            <div className="ai-assist-panel">
              <div className="ai-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color="var(--violet)" />
                  <span>AI Assistant feedback</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {aiLoading && (
                    <button className="btn btn-ghost" onClick={handleStopAI} style={{ fontSize: 12, padding: '4px 8px' }}>
                      Stop
                    </button>
                  )}
                  <button className="btn-icon" onClick={() => setShowAiPanel(false)}>
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
              <div className="ai-panel-body" style={{ flex: 1, overflowY: 'auto' }}>
                {aiLoading && !aiResponse && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', padding: 16 }}>
                    <Loader2 size={16} className="animate-spin" />
                    <span>AI is formulating suggestion...</span>
                  </div>
                )}
                {aiResponse && (
                  <div className="ai-response-content">
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-primary)' }}>{aiResponse}</pre>
                    {aiLoading && <span className="streaming-cursor" />}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
