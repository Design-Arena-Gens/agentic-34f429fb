"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderFrame, type AnimationOptions, type TemplateId } from "./lib/animations";
import { recordCanvas } from "./hooks/useCanvasRecorder";

const templates: { id: TemplateId; name: string }[] = [
  { id: "bouncingText", name: "Bouncing Text" },
  { id: "barsWave", name: "Waveform Bars" },
  { id: "gradientWipe", name: "Gradient Wipe" },
  { id: "circleReveal", name: "Circle Reveal" },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Page() {
  const [template, setTemplate] = useState<TemplateId>("bouncingText");
  const [text, setText] = useState("Your Title");
  const [backgroundColor, setBackgroundColor] = useState("#0b0f19");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [secondaryColor, setSecondaryColor] = useState("#06b6d4");
  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(6);
  const [sizePreset, setSizePreset] = useState("1080p");
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);

  const dims = useMemo(() => {
    if (sizePreset === "720p") return { w: 1280, h: 720 };
    if (sizePreset === "square") return { w: 1080, h: 1080 };
    if (sizePreset === "story") return { w: 1080, h: 1920 };
    if (sizePreset === "custom") return { w: customW, h: customH };
    return { w: 1920, h: 1080 };
  }, [sizePreset, customW, customH]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);

  const opts: AnimationOptions = useMemo(
    () => ({
      template,
      width: dims.w,
      height: dims.h,
      backgroundColor,
      primaryColor,
      secondaryColor,
      text,
    }),
    [template, dims.w, dims.h, backgroundColor, primaryColor, secondaryColor, text]
  );

  const renderAtTime = useCallback(
    (t: number) => {
      const c = canvasRef.current;
      if (!c) return;
      if (c.width !== opts.width || c.height !== opts.height) {
        c.width = opts.width; c.height = opts.height;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      renderFrame(ctx, t, opts);
    },
    [opts]
  );

  // Preview loop
  useEffect(() => {
    let raf = 0;
    let start = performance.now();

    const loop = () => {
      const now = performance.now();
      const t = ((now - start) / 1000) % Math.max(0.001, duration);
      renderAtTime(t);
      raf = requestAnimationFrame(loop);
    };

    if (isPreviewing) {
      start = performance.now();
      raf = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(raf);
  }, [isPreviewing, duration, renderAtTime]);

  const onRender = useCallback(async () => {
    if (!canvasRef.current) return;
    setIsPreviewing(false);
    setIsRendering(true);
    setProgress(0);

    const start = performance.now();
    const updateProgress = () => {
      const elapsed = (performance.now() - start) / 1000;
      setProgress(Math.min(100, Math.floor((elapsed / duration) * 100)));
      if (elapsed < duration && isRendering) requestAnimationFrame(updateProgress);
    };

    let isRendering = true;
    requestAnimationFrame(updateProgress);

    try {
      const blob = await recordCanvas(canvasRef.current, fps, duration, renderAtTime);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(blob, `${template}-${stamp}-${dims.w}x${dims.h}-${fps}fps.webm`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      isRendering = false;
      setIsRendering(false);
      setProgress(100);
    }
  }, [canvasRef, fps, duration, renderAtTime, template, dims.w, dims.h]);

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="h1">Animation Video Generator</h1>
          <div className="sub">Create short, crisp animated clips right in your browser.</div>
        </div>
      </div>

      <div className="grid">
        <div className="card canvasWrap">
          <div className="canvasOuter">
            <span className="badge">{dims.w}?{dims.h} @ {fps} fps</span>
            <canvas className="canvas" ref={canvasRef} />
          </div>
          <div className="actions" style={{ padding: 16 }}>
            <button className="button secondary" onClick={() => setIsPreviewing((s) => !s)}>
              {isPreviewing ? "Pause Preview" : "Resume Preview"}
            </button>
            <button className="button primary" disabled={isRendering} onClick={onRender}>
              {isRendering ? "Rendering?" : "Render & Download (WebM)"}
            </button>
            <div className="progress" aria-hidden>
              <div className="progressInner" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="footer" style={{ padding: "0 16px 16px" }}>
            Tip: WebM plays in most browsers. Convert to MP4 with ffmpeg if needed.
          </div>
        </div>

        <div className="card controls">
          <div className="row">
            <label className="label">Template</label>
            <select className="select" value={template} onChange={(e) => setTemplate(e.target.value as TemplateId)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="row">
            <label className="label">Title Text</label>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Your Title" />
          </div>

          <div className="row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="label">Background</label>
              <input className="color" type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
            </div>
            <div>
              <label className="label">Primary</label>
              <input className="color" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            </div>
            <div>
              <label className="label">Secondary</label>
              <input className="color" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
            </div>
          </div>

          <div className="row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="label">FPS</label>
              <input className="number" type="number" min={1} max={60} value={fps} onChange={(e) => setFps(parseInt(e.target.value || "30", 10))} />
            </div>
            <div>
              <label className="label">Duration (s)</label>
              <input className="number" type="number" min={1} max={30} value={duration} onChange={(e) => setDuration(parseInt(e.target.value || "6", 10))} />
            </div>
          </div>

          <div className="row">
            <label className="label">Size Preset</label>
            <select className="select" value={sizePreset} onChange={(e) => setSizePreset(e.target.value)}>
              <option value="1080p">1080p (1920?1080)</option>
              <option value="720p">720p (1280?720)</option>
              <option value="square">Square (1080?1080)</option>
              <option value="story">Story (1080?1920)</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {sizePreset === "custom" && (
            <div className="row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="label">Width</label>
                <input className="number" type="number" value={customW} onChange={(e) => setCustomW(parseInt(e.target.value || "1920", 10))} />
              </div>
              <div>
                <label className="label">Height</label>
                <input className="number" type="number" value={customH} onChange={(e) => setCustomH(parseInt(e.target.value || "1080", 10))} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
