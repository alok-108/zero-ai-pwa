// Pyodide hook — loads Python WASM runtime from CDN (~30 MB, cached after first load)
import { useState, useRef, useCallback } from 'react';

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PyodideResult {
  stdout: string;
  stderr: string;
  result: string | null;
}

// We load Pyodide from CDN instead of the npm package to avoid WASM bundling issues.
// This is the recommended approach per Pyodide docs.
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

export function usePyodide() {
  const [status, setStatus] = useState<PyodideStatus>('idle');
  const [loadProgress, setLoadProgress] = useState('');
  const pyodideRef = useRef<any>(null);

  const loadRuntime = useCallback(async () => {
    if (pyodideRef.current) {
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setLoadProgress('Downloading Python runtime (~30 MB)…');

    try {
      // Dynamically load pyodide from CDN
      if (!(window as any).loadPyodide) {
        const script = document.createElement('script');
        script.src = `${PYODIDE_CDN}pyodide.js`;
        script.async = true;
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pyodide script'));
          document.head.appendChild(script);
        });
      }

      setLoadProgress('Initializing Python engine…');
      const pyodide = await (window as any).loadPyodide({
        indexURL: PYODIDE_CDN,
      });

      pyodideRef.current = pyodide;
      setStatus('ready');
      setLoadProgress('');
    } catch (err) {
      console.error('Pyodide load error:', err);
      setStatus('error');
      setLoadProgress(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const runPython = useCallback(async (code: string): Promise<PyodideResult> => {
    const pyodide = pyodideRef.current;
    if (!pyodide) {
      return { stdout: '', stderr: 'Python runtime not loaded. Click "Load Python" first.', result: null };
    }

    try {
      // Set up stdout/stderr capture
      pyodide.runPython(`
import sys
from io import StringIO
_stdout_capture = StringIO()
_stderr_capture = StringIO()
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
`);

      // Run user code
      let result: string | null = null;
      try {
        const pyResult = pyodide.runPython(code);
        if (pyResult !== undefined && pyResult !== null) {
          result = String(pyResult);
        }
      } catch (pyErr: any) {
        // Capture Python errors to stderr
        const errMsg = pyErr?.message || String(pyErr);
        pyodide.runPython(`_stderr_capture.write("""${errMsg.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')}""")`);
      }

      // Read captured output
      const stdout = pyodide.runPython('_stdout_capture.getvalue()') || '';
      const stderr = pyodide.runPython('_stderr_capture.getvalue()') || '';

      // Reset streams
      pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);

      return { stdout, stderr, result };
    } catch (err) {
      return {
        stdout: '',
        stderr: err instanceof Error ? err.message : 'An error occurred while running your code.',
        result: null,
      };
    }
  }, []);

  const dispose = useCallback(() => {
    pyodideRef.current = null;
    setStatus('idle');
    setLoadProgress('');
  }, []);

  return {
    status,
    loadProgress,
    loadRuntime,
    runPython,
    dispose,
    isReady: status === 'ready',
  };
}
