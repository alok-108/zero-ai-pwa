import React, { useState, useEffect, useRef } from 'react';
import { useVisionDetector } from '../hooks/useVisionDetector';
import { Upload, Play, Pause, RefreshCw, ZoomIn, Search, Eye, Info, Film } from 'lucide-react';
import type { AppSettings } from '../lib/db';

interface VisionDetectProps {
  settings: AppSettings;
}

export function VisionDetect({ settings }: VisionDetectProps) {
  const { status, progress, progressPct, results, error, detectObjects, disposeDetector } = useVisionDetector();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [modelType, setModelType] = useState<'owlvit' | 'detr'>(settings.detectModel);
  const [queryInput, setQueryInput] = useState('person, cat, car, bag');
  const [threshold, setThreshold] = useState(0.15);
  
  // Real-time tracking settings for video
  const [isPlaying, setIsPlaying] = useState(false);
  const [realtimeTracking, setRealtimeTracking] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const resultsRef = useRef(results);
  const lastDetectionTimeRef = useRef<number>(0);
  const isDetectingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);

  // Sync results for drawing loop
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  // Sync settings model preference
  useEffect(() => {
    setModelType(settings.detectModel);
  }, [settings.detectModel]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disposeDetector();
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [disposeDetector, mediaUrl]);

  // Visual render function for Static Image
  const renderImageCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || mediaType !== 'image' || !mediaUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      drawBoundingBoxes(ctx, canvas.width);
    };

    if (img.complete) {
      img.onload(new Event('load') as any);
    }
  };

  // Bounding Box Drawing Logic
  const drawBoundingBoxes = (ctx: CanvasRenderingContext2D, canvasWidth: number) => {
    resultsRef.current.forEach((det) => {
      const { xmin, ymin, xmax, ymax } = det.box;
      const width = xmax - xmin;
      const height = ymax - ymin;

      // Draw primary boundary stroke
      ctx.strokeStyle = '#8b5cf6'; // Violet theme for vision
      ctx.lineWidth = Math.max(3, Math.round(canvasWidth / 250));
      ctx.strokeRect(xmin, ymin, width, height);

      // Draw contrast shadow
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = Math.max(1, Math.round(canvasWidth / 500));
      ctx.strokeRect(xmin - ctx.lineWidth, ymin - ctx.lineWidth, width + ctx.lineWidth * 2, height + ctx.lineWidth * 2);

      // Draw label background banner
      ctx.fillStyle = '#8b5cf6';
      const fontSize = Math.max(12, Math.round(canvasWidth / 45));
      ctx.font = `600 ${fontSize}px sans-serif`;
      const labelText = `${det.label} (${Math.round(det.score * 100)}%)`;
      const textWidth = ctx.measureText(labelText).width;
      
      const bannerHeight = fontSize + 8;
      ctx.fillRect(xmin, ymin - bannerHeight, textWidth + 12, bannerHeight);

      // Draw text label
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, xmin + 6, ymin - 6);
    });
  };

  // Video Frame animation loop
  const drawVideoFrame = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || mediaType !== 'video') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Synchronize canvas coordinate dimensions with video stream source
    if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawBoundingBoxes(ctx, canvas.width);

    // Dynamic object tracking: run model every 500ms
    const now = Date.now();
    if (isPlaying && realtimeTracking && !isDetectingRef.current && (now - lastDetectionTimeRef.current > 600)) {
      isDetectingRef.current = true;
      lastDetectionTimeRef.current = now;

      // Create an offscreen frame clone
      const offscreen = document.createElement('canvas');
      offscreen.width = video.videoWidth;
      offscreen.height = video.videoHeight;
      const oCtx = offscreen.getContext('2d');
      
      if (oCtx && video.videoWidth > 0) {
        oCtx.drawImage(video, 0, 0);
        const queries = queryInput.split(',').map((q) => q.trim()).filter(Boolean);
        
        detectObjects(offscreen, modelType, { queries, threshold })
          .finally(() => {
            isDetectingRef.current = false;
          });
      } else {
        isDetectingRef.current = false;
      }
    }

    if (!video.paused && !video.ended) {
      animationFrameRef.current = requestAnimationFrame(drawVideoFrame);
    }
  };

  // Trigger redraw on static image change
  useEffect(() => {
    if (mediaType === 'image') {
      renderImageCanvas();
    }
  }, [results, mediaUrl, mediaType]);

  // Listen to video state changes
  useEffect(() => {
    if (mediaType === 'video' && isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(drawVideoFrame);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isPlaying, mediaType, realtimeTracking, modelType, queryInput, threshold]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }

    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const url = URL.createObjectURL(file);
    
    setMediaUrl(url);
    setMediaType(type);
    setIsPlaying(false);
    
    if (type === 'video') {
      // Small timeout to allow video metadata loading
      setTimeout(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(video, 0, 0);
        }
      }, 300);
    }
  };

  const handleDetect = async () => {
    if (!mediaUrl) return;

    if (mediaType === 'image') {
      const queries = queryInput.split(',').map((q) => q.trim()).filter(Boolean);
      await detectObjects(mediaUrl, modelType, { queries, threshold });
    } else {
      // Toggle play/pause
      const video = videoRef.current;
      if (!video) return;

      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        video.play().then(() => {
          setIsPlaying(true);
        });
      }
    }
  };

  const isDetecting = status === 'detecting' || status === 'loading';

  return (
    <div className="tab-container fade-in">
      <div className="split-view">
        {/* Input Panel */}
        <div className="control-panel">
          <div className="control-form">
            <div className="panel-header">
              <h3>🔍 Vision & Video Tracker</h3>
              <p className="panel-subtitle">Detect objects in static pictures or real-time videos offline</p>
            </div>

            {/* Upload Area */}
            <div
              className={`file-dropzone ${mediaUrl ? 'has-file' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                style={{ display: 'none' }}
                disabled={isDetecting && mediaType === 'image'}
              />
              {mediaType === 'video' ? <Film size={24} className="upload-icon" /> : <Upload size={24} className="upload-icon" />}
              <p className="upload-text">
                {mediaUrl 
                  ? `Click to replace ${mediaType}` 
                  : 'Drag & drop image/video or click to upload'}
              </p>
            </div>

            {/* Model Type selection */}
            <div className="engine-select-group" style={{ marginTop: 12 }}>
              <label>Vision Model Type</label>
              <div className="engine-toggle-buttons">
                <button
                  type="button"
                  className={`toggle-option ${modelType === 'detr' ? 'selected' : ''}`}
                  onClick={() => setModelType('detr')}
                  disabled={isDetecting}
                >
                  ⚡ DETR (Fast standard objects)
                </button>
                <button
                  type="button"
                  className={`toggle-option ${modelType === 'owlvit' ? 'selected' : ''}`}
                  onClick={() => setModelType('owlvit')}
                  disabled={isDetecting}
                >
                  🔮 OWL-ViT (Zero-shot open queries)
                </button>
              </div>
            </div>

            {/* Query Targets Input */}
            <div className="form-group" style={{ marginTop: 12 }}>
              <label htmlFor="queries">
                {modelType === 'owlvit' ? 'Query Targets (comma separated)' : 'Confidence Filters (e.g. person, car)'}
              </label>
              <input
                id="queries"
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="e.g. person, backpack, coffee cup"
                disabled={isDetecting && mediaType === 'image'}
              />
              <span className="input-help">Separate targets with commas to detect specific categories.</span>
            </div>

            {/* Threshold slider */}
            <div className="form-group" style={{ marginTop: 12 }}>
              <div className="slider-label">
                <span>Confidence Threshold</span>
                <span className="slider-val">{Math.round(threshold * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.9}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                disabled={isDetecting && mediaType === 'image'}
              />
            </div>

            {/* Video-specific settings */}
            {mediaType === 'video' && mediaUrl && (
              <div className="video-settings-group animate-fade" style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Real-time Tracking Overlay</span>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 44, height: 22 }}>
                    <input
                      type="checkbox"
                      checked={realtimeTracking}
                      onChange={(e) => setRealtimeTracking(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span className="slider round" style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: realtimeTracking ? 'var(--accent)' : '#475569',
                      transition: '0.3s', borderRadius: 22
                    }}>
                      <span style={{
                        position: 'absolute', content: '', height: 16, width: 16, left: realtimeTracking ? 24 : 3, bottom: 3,
                        backgroundColor: 'white', transition: '0.3s', borderRadius: '50%'
                      }} />
                    </span>
                  </label>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, margin: 0 }}>
                  Throttles inference to 2 FPS to ensure local device responsive playback.
                </p>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={handleDetect}
              className="btn btn-primary generate-btn"
              disabled={(isDetecting && mediaType === 'image') || !mediaUrl}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 16 }}
            >
              {mediaType === 'image' ? (
                <>
                  <Eye size={16} />
                  {isDetecting ? 'Running Detection...' : 'Run Object Detection'}
                </>
              ) : (
                <>
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  {isPlaying ? 'Pause Video Tracking' : 'Start Video Tracking'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Canvas/Image Output panel */}
        <div className="output-viewport">
          {mediaUrl ? (
            <div className="vision-output-card">
              <div className="canvas-wrapper">
                {/* Images / Videos hidden reference elements */}
                {mediaType === 'image' ? (
                  <img
                    ref={imageRef}
                    src={mediaUrl}
                    alt="Uploaded target"
                    style={{ display: 'none' }}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={mediaUrl}
                    style={{ display: 'none' }}
                    loop
                    muted
                    playsInline
                  />
                )}
                {/* Responsive canvas showing bounding box drawings */}
                <canvas ref={canvasRef} className="vision-canvas animate-fade" />
              </div>

              {/* Status details overlay */}
              {isDetecting && mediaType === 'image' && (
                <div className="canvas-loader-overlay">
                  <div className="spinner" />
                  <p className="loader-status">Running model...</p>
                  <p className="loader-desc">{progress}</p>
                  {progressPct > 0 && <span className="pct">{progressPct}%</span>}
                </div>
              )}

              {/* Detections list */}
              {results.length > 0 && (
                <div className="results-table-section">
                  <h4>Detections Summary ({results.length})</h4>
                  <div className="results-table-container">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Object Name</th>
                          <th>Confidence</th>
                          <th>Bounding Box coords</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, idx) => (
                          <tr key={idx}>
                            <td><strong>{r.label}</strong></td>
                            <td><span className="conf-badge">{Math.round(r.score * 100)}%</span></td>
                            <td>[{Math.round(r.box.xmin)}, {Math.round(r.box.ymin)}, {Math.round(r.box.xmax)}, {Math.round(r.box.ymax)}]</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="viewport-empty">
              {error ? (
                <div className="generation-error animate-fade">
                  <span className="error-icon">⚠️</span>
                  <h4>Vision Error</h4>
                  <p>{error}</p>
                </div>
              ) : (
                <div className="empty-placeholder">
                  <div className="placeholder-icon-circle">
                    <Search size={32} />
                  </div>
                  <h4>No File Uploaded</h4>
                  <p>Upload a photo or video to trace bounding boxes completely client-side.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
