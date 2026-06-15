import React, { useState, useEffect, useRef } from 'react';
import { useSD } from '../hooks/useSD';
import { Download, Play, Image as ImageIcon, Info, HelpCircle, Film, Sparkles } from 'lucide-react';
import type { AppSettings } from '../lib/db';

interface ImageGenProps {
  settings: AppSettings;
}

export function ImageGen({ settings }: ImageGenProps) {
  const { status: sdStatus, progress: sdProgress, imageUrl, error: sdError, generateCloud, generateLocal, clearImage, disposeModel } = useSD();
  
  // Tab states
  const [activeSubTab, setActiveSubTab] = useState<'image' | 'video'>('image');
  
  // Input settings
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState<'cloud' | 'local'>(settings.imgGenEngine);
  const [steps, setSteps] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Video specific inputs
  const [motionPreset, setMotionPreset] = useState<'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'rotate' | 'cinematic' | 'warp-wave'>('zoom-in');
  const [duration, setDuration] = useState(3); // seconds
  const [fps, setFps] = useState(15); // frames per second
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<'idle' | 'generating-base' | 'rendering-motion' | 'success' | 'error'>('idle');
  const [videoProgress, setVideoProgress] = useState('');
  const [videoError, setVideoError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync settings engine preference on mount
  useEffect(() => {
    setEngine(settings.imgGenEngine);
  }, [settings.imgGenEngine]);

  // Clean up model when unmounting
  useEffect(() => {
    return () => {
      disposeModel();
      clearImage();
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [disposeModel, clearImage, videoUrl]);

  // Handle standard image generation
  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setVideoUrl(null); // Clear video if any

    if (engine === 'cloud') {
      await generateCloud(prompt, settings.hfToken);
    } else {
      await generateLocal(prompt, steps);
    }
  };

  // Handle HTML5 Canvas + MediaRecorder Video Generation
  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setVideoError('');
    setVideoStatus('generating-base');
    setVideoProgress('Step 1/2: Generating keyframe starter image...');
    setVideoUrl(null);
    clearImage();

    let baseImgUrl = '';
    try {
      if (engine === 'cloud') {
        await generateCloud(prompt, settings.hfToken);
      } else {
        await generateLocal(prompt, steps);
      }
    } catch (err: any) {
      setVideoStatus('error');
      setVideoError(err?.message || 'Failed to generate keyframe.');
      return;
    }
  };

  // Listen for imageUrl generation changes to proceed to Video Motion Step
  useEffect(() => {
    if (activeSubTab === 'video' && sdStatus === 'success' && imageUrl) {
      animateAndRecordVideo(imageUrl);
    } else if (activeSubTab === 'video' && sdStatus === 'error') {
      setVideoStatus('error');
      setVideoError(sdError || 'Base image generation failed.');
    }
  }, [imageUrl, sdStatus, sdError, activeSubTab]);

  const animateAndRecordVideo = (imgBlobUrl: string) => {
    setVideoStatus('rendering-motion');
    setVideoProgress('Step 2/2: Rendering motion paths and capturing video container...');

    const img = new Image();
    img.crossOrigin = 'anonymous'; // Prevent tainted canvas
    img.src = imgBlobUrl;

    img.onload = () => {
      try {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not initialize canvas graphics.');

        // Record stream settings
        const stream = canvas.captureStream(fps);
        let options = { mimeType: 'video/webm;codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/webm' };
        }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/mp4' };
        }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: '' }; // Fallback to browser default
        }

        const mediaRecorder = new MediaRecorder(stream, options);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const videoBlob = new Blob(chunks, { type: mediaRecorder.mimeType || 'video/webm' });
          const url = URL.createObjectURL(videoBlob);
          setVideoUrl(url);
          setVideoStatus('success');
          setVideoProgress('');
        };

        const totalFrames = duration * fps;
        let currentFrame = 0;

        mediaRecorder.start();

        const renderFrame = () => {
          if (currentFrame >= totalFrames) {
            mediaRecorder.stop();
            return;
          }

          // Progress ratio (0 to 1)
          const t = currentFrame / (totalFrames - 1);
          ctx.clearRect(0, 0, 512, 512);

          // Apply motion presets
          if (motionPreset === 'zoom-in') {
            const scale = 1.0 + t * 0.25; // Zoom up to 125%
            const size = 512 * scale;
            const offset = (size - 512) / 2;
            ctx.drawImage(img, -offset, -offset, size, size);
          } else if (motionPreset === 'zoom-out') {
            const scale = 1.25 - t * 0.25; // Zoom down to 100%
            const size = 512 * scale;
            const offset = (size - 512) / 2;
            ctx.drawImage(img, -offset, -offset, size, size);
          } else if (motionPreset === 'pan-left') {
            const offset = t * 64; // Shift X to the left
            ctx.drawImage(img, -offset, 0, 512 + 64, 512);
          } else if (motionPreset === 'pan-right') {
            const offset = (1 - t) * 64; // Shift X to the right
            ctx.drawImage(img, -offset, 0, 512 + 64, 512);
          } else if (motionPreset === 'rotate') {
            ctx.save();
            ctx.translate(256, 256);
            ctx.rotate(t * 0.12); // Rotate slightly
            ctx.drawImage(img, -256, -256, 512, 512);
            ctx.restore();
          } else if (motionPreset === 'cinematic') {
            const scale = 1.0 + t * 0.15;
            const size = 512 * scale;
            const xOffset = (size - 512) / 2 + t * 25;
            const yOffset = (size - 512) / 2;
            ctx.drawImage(img, -xOffset, -yOffset, size, size);
          } else if (motionPreset === 'warp-wave') {
            const sliceCount = 32;
            const sliceHeight = 512 / sliceCount;
            const phase = t * Math.PI * 4;
            for (let s = 0; s < sliceCount; s++) {
              const shift = Math.sin(s / 4 + phase) * 8;
              ctx.drawImage(
                img,
                0, s * sliceHeight, 512, sliceHeight,
                shift, s * sliceHeight, 512, sliceHeight
              );
            }
          }

          currentFrame++;
          requestAnimationFrame(renderFrame);
        };

        // Trigger animation frame loop
        requestAnimationFrame(renderFrame);

      } catch (err: any) {
        setVideoStatus('error');
        setVideoError(err?.message || 'Motion animation rendering failed.');
      }
    };

    img.onerror = () => {
      setVideoStatus('error');
      setVideoError('Could not load base image for animation.');
    };
  };

  const handleDownloadVideo = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `zero-ai-video-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `zero-ai-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isGeneratingImg = sdStatus === 'generating' || sdStatus === 'loading-model';
  const isGeneratingVid = videoStatus === 'generating-base' || videoStatus === 'rendering-motion' || isGeneratingImg;

  return (
    <div className="tab-container fade-in">
      {/* Sub-tab Switcher Header */}
      <div className="sub-tab-header">
        <button
          className={`sub-tab-btn ${activeSubTab === 'image' ? 'active' : ''}`}
          onClick={() => {
            setActiveSubTab('image');
            setPrompt('');
          }}
          disabled={isGeneratingImg || isGeneratingVid}
        >
          <ImageIcon size={16} />
          Image Studio
        </button>
        <button
          className={`sub-tab-btn ${activeSubTab === 'video' ? 'active' : ''}`}
          onClick={() => {
            setActiveSubTab('video');
            setPrompt('');
          }}
          disabled={isGeneratingImg || isGeneratingVid}
        >
          <Film size={16} />
          Video Studio (₹0 Offline Motion)
        </button>
      </div>

      <div className="split-view" style={{ height: 'calc(100% - 48px)' }}>
        {/* Input Control Panel */}
        <div className="control-panel">
          <form onSubmit={activeSubTab === 'image' ? handleGenerateImage : handleGenerateVideo} className="control-form">
            <div className="panel-header">
              <h3>{activeSubTab === 'image' ? '🎨 Image Generator' : '🎬 Video Studio'}</h3>
              <p className="panel-subtitle">
                {activeSubTab === 'image' 
                  ? 'Create premium images client-side via local WebGPU or fast cloud API' 
                  : 'Animate a prompt into a 3D motion-interpolated video completely offline'}
              </p>
            </div>

            {/* Prompt textarea */}
            <div className="form-group">
              <label htmlFor="prompt">Creative Prompt</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeSubTab === 'image'
                  ? "Describe what you want to see (e.g. 'A high-tech workspace with neon lights, digital art, 8k resolution'...)"
                  : "Describe what to animate (e.g. 'A majestic eagle flying high over green mountains, photorealistic'...)"}
                rows={4}
                disabled={isGeneratingImg || isGeneratingVid}
                required
              />
            </div>

            {/* Engine Selection Toggle */}
            <div className="engine-select-group">
              <label>Generation Engine</label>
              <div className="engine-toggle-buttons">
                <button
                  type="button"
                  className={`toggle-option ${engine === 'cloud' ? 'selected' : ''}`}
                  onClick={() => setEngine('cloud')}
                  disabled={isGeneratingImg || isGeneratingVid}
                >
                  ⚡ Cloud (Flux.1 Schnell)
                </button>
                <button
                  type="button"
                  className={`toggle-option ${engine === 'local' ? 'selected' : ''}`}
                  onClick={() => setEngine('local')}
                  disabled={isGeneratingImg || isGeneratingVid}
                >
                  🛡️ Local WebGPU (SD 2.1)
                </button>
              </div>
            </div>

            {/* Sub-tab settings */}
            {activeSubTab === 'video' && (
              <div className="video-settings-group animate-fade" style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label htmlFor="motionPreset">Motion Pattern</label>
                  <select
                    id="motionPreset"
                    value={motionPreset}
                    onChange={(e: any) => setMotionPreset(e.target.value)}
                    disabled={isGeneratingVid}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  >
                    <option value="zoom-in">🔍 Zoom In (Smooth forward dolly)</option>
                    <option value="zoom-out">🔎 Zoom Out (Backward crane pull)</option>
                    <option value="pan-left">⬅️ Pan Left (Landscape slide)</option>
                    <option value="pan-right">➡️ Pan Right (Landscape glide)</option>
                    <option value="rotate">🔄 Rotate (Cinematic barrel rotation)</option>
                    <option value="cinematic">🎥 Cinematic (Combined zoom + pan)</option>
                    <option value="warp-wave">🌊 Liquid Warp (Flowing fluid wave)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: 12 }}>
                  <div className="slider-label">
                    <span>Video Duration</span>
                    <span className="slider-val">{duration}s</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    disabled={isGeneratingVid}
                  />
                </div>

                <div className="form-group" style={{ marginTop: 12 }}>
                  <div className="slider-label">
                    <span>Frame Rate</span>
                    <span className="slider-val">{fps} FPS</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={30}
                    step={5}
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value))}
                    disabled={isGeneratingVid}
                  />
                  <span className="input-help">Higher FPS creates a smoother video container.</span>
                </div>
              </div>
            )}

            {/* Cloud engine note */}
            {engine === 'cloud' && (
              <div className="engine-info-note" style={{ marginTop: 12 }}>
                <Info size={14} className="info-icon" />
                <span>
                  Uses free Hugging Face Inference API. Runs in 1-3 seconds.
                  {!settings.hfToken && (
                    <strong style={{ display: 'block', marginTop: 4, color: 'var(--warning)' }}>
                      💡 Tip: Add a free Hugging Face token in Settings to avoid rate limits!
                    </strong>
                  )}
                </span>
              </div>
            )}

            {/* Local engine note */}
            {engine === 'local' && (
              <div className="engine-info-note warning" style={{ marginTop: 12 }}>
                <Info size={14} className="info-icon" />
                <span>
                  <strong>Requires WebGPU.</strong> The first generation will download approximately <strong>2.7GB</strong> of model weights.
                </span>
              </div>
            )}

            {/* Advanced Settings for standard image */}
            {activeSubTab === 'image' && (
              <div className="advanced-accordion">
                <button
                  type="button"
                  className="accordion-trigger"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  <span>⚙️ Advanced Settings</span>
                  <span>{showAdvanced ? '▴' : '▾'}</span>
                </button>

                {showAdvanced && (
                  <div className="accordion-content">
                    {engine === 'local' ? (
                      <div className="form-group">
                        <div className="slider-label">
                          <span>Inference Steps</span>
                          <span className="slider-val">{steps}</span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={50}
                          step={1}
                          value={steps}
                          onChange={(e) => setSteps(parseInt(e.target.value))}
                          disabled={isGeneratingImg}
                        />
                        <span className="input-help">Higher steps = better quality, but takes longer.</span>
                      </div>
                    ) : (
                      <p className="no-settings-note">Cloud generation is pre-optimized (4 steps, fast resolution).</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Generate Button */}
            <button
              type="submit"
              className="btn btn-primary generate-btn"
              disabled={activeSubTab === 'image' ? isGeneratingImg : isGeneratingVid || !prompt.trim()}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 16 }}
            >
              <Sparkles size={16} />
              {activeSubTab === 'image'
                ? (isGeneratingImg ? 'Generating...' : 'Generate Image')
                : (isGeneratingVid ? 'Processing Video...' : 'Generate Video')}
            </button>
          </form>
        </div>

        {/* Output Viewport */}
        <div className="output-viewport">
          {activeSubTab === 'image' ? (
            imageUrl ? (
              <div className="generated-image-card">
                <div className="image-wrapper">
                  <img src={imageUrl} alt="Generated AI artwork" className="generated-img animate-fade" />
                </div>
                <div className="image-actions">
                  <span className="prompt-display">"{prompt}"</span>
                  <button className="btn btn-primary download-btn" onClick={handleDownloadImage}>
                    <Download size={15} />
                    Download Image
                  </button>
                </div>
              </div>
            ) : (
              <div className="viewport-empty">
                {isGeneratingImg ? (
                  <div className="generation-loader">
                    <div className="spinner" />
                    <p className="loader-status">{sdStatus === 'loading-model' ? 'Downloading Model weights (~2.7GB)' : 'Inference Processing...'}</p>
                    <p className="loader-desc">{sdProgress}</p>
                  </div>
                ) : sdError ? (
                  <div className="generation-error animate-fade">
                    <span className="error-icon">⚠️</span>
                    <h4>Generation Failed</h4>
                    <p>{sdError}</p>
                  </div>
                ) : (
                  <div className="empty-placeholder">
                    <div className="placeholder-icon-circle">
                      <ImageIcon size={32} />
                    </div>
                    <h4>No Image Generated</h4>
                    <p>Describe your creative vision in the prompt panel and click generate to begin.</p>
                  </div>
                )}
              </div>
            )
          ) : (
            // Video sub-tab output viewport
            videoUrl ? (
              <div className="generated-image-card">
                <div className="image-wrapper">
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    className="generated-img animate-fade"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                  />
                </div>
                <div className="image-actions">
                  <span className="prompt-display">"{prompt}" ({motionPreset} preset)</span>
                  <button className="btn btn-primary download-btn" onClick={handleDownloadVideo}>
                    <Download size={15} />
                    Download Video
                  </button>
                </div>
              </div>
            ) : (
              <div className="viewport-empty">
                {isGeneratingVid ? (
                  <div className="generation-loader">
                    <div className="spinner" />
                    <p className="loader-status">
                      {videoStatus === 'generating-base' 
                        ? (sdStatus === 'loading-model' ? 'Downloading Model weights (~2.7GB)' : 'Generating keyframe base image...')
                        : 'Applying motion presets and recording frame streams...'}
                    </p>
                    <p className="loader-desc">{videoStatus === 'generating-base' ? sdProgress : videoProgress}</p>
                  </div>
                ) : videoError ? (
                  <div className="generation-error animate-fade">
                    <span className="error-icon">⚠️</span>
                    <h4>Video Generation Failed</h4>
                    <p>{videoError}</p>
                  </div>
                ) : (
                  <div className="empty-placeholder">
                    <div className="placeholder-icon-circle">
                      <Film size={32} />
                    </div>
                    <h4>No Video Generated</h4>
                    <p>Provide an animation prompt, select a camera motion preset, and click generate video to compile client-side.</p>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Hidden Canvas used for frame capturing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
