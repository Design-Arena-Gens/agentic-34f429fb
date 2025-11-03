export async function recordCanvas(
  canvas: HTMLCanvasElement,
  fps: number,
  durationSec: number,
  renderAtTime: (t: number) => void
): Promise<Blob> {
  if (!("MediaRecorder" in window)) {
    throw new Error("MediaRecorder not supported in this browser");
  }

  const stream = canvas.captureStream(Math.min(60, Math.max(1, Math.floor(fps))));
  const options: MediaRecorderOptions = 
    (MediaRecorder as any).isTypeSupported?.("video/webm;codecs=vp9")
      ? { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 6_000_000 }
      : { mimeType: "video/webm", videoBitsPerSecond: 6_000_000 };

  const recorder = new MediaRecorder(stream, options);
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const started = performance.now();
  const frameIntervalMs = 1000 / fps;
  let timer: number | undefined;

  const run = () => {
    const now = performance.now();
    const t = (now - started) / 1000;
    if (t <= durationSec) {
      renderAtTime(t);
      timer = window.setTimeout(run, frameIntervalMs);
    } else {
      recorder.stop();
      if (timer) window.clearTimeout(timer);
      stream.getTracks().forEach((tr) => tr.stop());
    }
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: options.mimeType });
      resolve(blob);
    };
  });

  recorder.start(Math.max(200, Math.floor(frameIntervalMs)));
  run();

  return done;
}
