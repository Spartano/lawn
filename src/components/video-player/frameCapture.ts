/** Seek and wait for decode; handles no-op seeks that skip `seeked`. */
export async function seekVideoForCapture(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;

  const t = Math.min(Math.max(timeSeconds, 0), Math.max(0, duration - 1e-6));

  await new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);

    if (Math.abs(video.currentTime - t) < 1e-4) {
      video.removeEventListener("seeked", onSeeked);
      requestAnimationFrame(() => resolve());
    } else {
      video.currentTime = t;
    }
  });
}

export async function waitForVideoDimensions(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return;
  await new Promise<void>((resolve) => {
    let attempts = 0;
    const maxAttempts = 120;
    const tick = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}
