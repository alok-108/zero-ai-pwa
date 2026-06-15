import { useState, useCallback, useRef } from 'react';

export type VisionStatus = 'idle' | 'loading' | 'ready' | 'detecting' | 'success' | 'error';

export interface DetectionResult {
  box: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  label: string;
  score: number;
}

export function useVisionDetector() {
  const [status, setStatus] = useState<VisionStatus>('idle');
  const [progress, setProgress] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [error, setError] = useState<string>('');
  const detectorRef = useRef<any>(null);
  const currentModelRef = useRef<string>('');

  const initDetector = useCallback(async (modelType: 'owlvit' | 'detr') => {
    const modelName = modelType === 'owlvit' ? 'Xenova/owlvit-base-patch32' : 'Xenova/detr-resnet-50';
    const taskName = modelType === 'owlvit' ? 'zero-shot-object-detection' : 'object-detection';

    if (detectorRef.current && currentModelRef.current === modelName) {
      setStatus('ready');
      return detectorRef.current;
    }

    // Dispose old model if different
    if (detectorRef.current) {
      detectorRef.current = null;
    }

    setStatus('loading');
    setProgress(`Initializing ${modelType === 'owlvit' ? 'Zero-shot (OWL-ViT)' : 'Standard (DETR)'} model…`);
    setProgressPct(0);
    setError('');

    try {
      const { pipeline } = await import('@xenova/transformers');
      
      const detector = await pipeline(taskName as any, modelName, {
        progress_callback: (data: any) => {
          if (data.status === 'downloading') {
            setProgress(`Downloading model files: ${data.file}…`);
            if (data.progress) {
              setProgressPct(Math.round(data.progress));
            }
          } else if (data.status === 'done') {
            setProgress(`Loaded file: ${data.file}`);
          }
        },
      });

      detectorRef.current = detector;
      currentModelRef.current = modelName;
      setStatus('ready');
      setProgress('');
      setProgressPct(100);
      return detector;
    } catch (err: any) {
      console.error('Vision detector load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load vision model.');
      setStatus('error');
      return null;
    }
  }, []);

  const detectObjects = useCallback(async (
    imageSrc: string | HTMLImageElement | HTMLCanvasElement,
    modelType: 'owlvit' | 'detr',
    options?: {
      queries?: string[];
      threshold?: number;
    }
  ) => {
    setStatus('detecting');
    setError('');

    try {
      const detector = await initDetector(modelType);
      if (!detector) throw new Error('Detector is not initialized.');

      const threshold = options?.threshold ?? 0.15;
      let rawResults: any[] = [];

      if (modelType === 'owlvit') {
        const queries = options?.queries ?? ['object'];
        if (queries.length === 0 || !queries[0]) {
          throw new Error('Please provide at least one search query for Zero-shot detection.');
        }
        setProgress(`Running zero-shot detection for: ${queries.join(', ')}…`);
        rawResults = await detector(imageSrc, queries, { threshold });
      } else {
        setProgress('Running standard object detection…');
        rawResults = await detector(imageSrc, { threshold });
      }

      setResults(rawResults);
      setStatus('success');
      setProgress('');
    } catch (err: any) {
      console.error('Inference error:', err);
      setError(err instanceof Error ? err.message : 'Object detection inference failed.');
      setStatus('error');
    }
  }, [initDetector]);

  const disposeDetector = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current = null;
      currentModelRef.current = '';
      setResults([]);
      setStatus('idle');
    }
  }, []);

  return {
    status,
    progress,
    progressPct,
    results,
    error,
    detectObjects,
    initDetector,
    disposeDetector,
  };
}
