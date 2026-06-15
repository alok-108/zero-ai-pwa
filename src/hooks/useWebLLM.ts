import { useState, useCallback, useRef } from 'react';
import { CreateMLCEngine, type MLCEngine, type InitProgressReport } from '@mlc-ai/web-llm';
import type { Message } from '../lib/db';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';

export const MODELS = [
  {
    id: 'SmolLM2-360M-Instruct-q0f16-MLC',
    label: 'SmolLM2 360M',
    size: '135 MB',
    speed: 'Fastest',
    ram: '< 1 GB',
    badge: '⚡',
    description: 'Ultra-light, instant load. Great for older devices.',
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 1B',
    size: '1.1 GB',
    speed: 'Fast',
    ram: '2–4 GB',
    badge: '⭐',
    description: 'Best balance of quality and speed. Recommended.',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen 2.5 1.5B',
    size: '1.1 GB',
    speed: 'Fast',
    ram: '4–6 GB',
    badge: '🌏',
    description: 'Better multilingual and coding tasks.',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    label: 'Phi 3.5 Mini',
    size: '2.5 GB',
    speed: 'Moderate',
    ram: '6+ GB',
    badge: '🚀',
    description: 'Near 7B quality. Best responses on powerful hardware.',
  },
];

export function useWebLLM(modelId: string) {
  const [engine, setEngine] = useState<MLCEngine | null>(null);
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [progress, setProgress] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const engineRef = useRef<MLCEngine | null>(null);

  const checkWebGPU = useCallback(async (): Promise<boolean> => {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }, []);

  const initEngine = useCallback(async () => {
    setStatus('loading');
    setError('');
    setProgress('Checking WebGPU support…');
    setProgressPct(0);

    const hasWebGPU = await checkWebGPU();
    if (!hasWebGPU) {
      setStatus('unsupported');
      setError(
        'WebGPU is not available in your browser. Please use Chrome 113+ or Edge 113+. ' +
          'Firefox/Safari support is coming in a future update.'
      );
      return;
    }

    try {
      setProgress('Initializing engine…');
      const eng = await CreateMLCEngine(modelId, {
        initProgressCallback: (report: InitProgressReport) => {
          setProgress(report.text);
          // Extract percentage from progress text like "Loading model [78/100]"
          const match = report.text.match(/(\d+(?:\.\d+)?)%/) || report.text.match(/\[(\d+)\/(\d+)\]/);
          if (match) {
            if (match[2]) {
              setProgressPct(Math.round((parseInt(match[1]) / parseInt(match[2])) * 100));
            } else {
              setProgressPct(Math.round(parseFloat(match[1])));
            }
          }
        },
      });
      engineRef.current = eng;
      setEngine(eng);
      setStatus('ready');
      setProgressPct(100);
    } catch (err) {
      console.error('WebLLM init error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to initialize AI engine. Please refresh and try again.');
    }
  }, [modelId, checkWebGPU]);

  // Don't auto-init — user must explicitly click "Load Model"
  const loadModel = useCallback(() => {
    initEngine();
  }, [initEngine]);

  const reloadModel = useCallback(async (_newModelId?: string) => {
    if (engineRef.current) {
      try {
        await engineRef.current.unload();
      } catch { /* ignore */ }
    }
    setEngine(null);
    setStatus('idle');
    setProgressPct(0);
  }, []);

  const generateResponse = useCallback(
    async (
      messages: Message[],
      temperature: number,
      maxTokens: number,
      onToken: (token: string) => void,
      signal?: AbortSignal
    ): Promise<string> => {
      if (!engine) throw new Error('Engine not ready');

      const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));

      const stream = await engine.chat.completions.create({
        messages: apiMessages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const token = chunk.choices[0]?.delta?.content ?? '';
        fullResponse += token;
        onToken(token);
      }
      return fullResponse;
    },
    [engine]
  );

  return {
    engine,
    status,
    progress,
    progressPct,
    error,
    loadModel,
    reloadModel,
    generateResponse,
  };
}
