import { cn, formatTimestamp } from "@/lib/utils";

/** Samples from −0.9s to +0.9s around the pause anchor (browser canvas; no Mux cost). */
export const CONTEXT_STRIP_SAMPLES = 20;

interface SubSecondStripProps {
  /** JPEG data URLs from canvas capture */
  frames: string[];
  times: number[];
  /** Center used for −0.9s … +0.9s labels (seconds). */
  anchorSeconds: number;
  activeIndex: number;
  onSeek: (time: number) => void;
  loading: boolean;
}

function formatDeltaSeconds(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}s`;
}

export function SubSecondStrip({
  frames,
  times,
  anchorSeconds,
  activeIndex,
  onSeek,
  loading,
}: SubSecondStripProps) {
  const stepSeconds =
    times.length >= 2
      ? Math.abs(times[1] - times[0])
      : 1.8 / Math.max(1, CONTEXT_STRIP_SAMPLES - 1);

  if (loading && frames.length === 0) {
    return (
      <div className="mb-2 rounded border border-white/10 bg-black/40 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Context strip</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-white/70">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          Capturing…
        </div>
      </div>
    );
  }

  if (frames.length === 0 || times.length === 0) return null;

  return (
    <div className="mb-2 rounded border border-white/10 bg-black/50">
      <div className="flex flex-wrap items-baseline justify-between gap-1 border-b border-white/10 px-2 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-white/55">Context strip</span>
        <span className="font-mono text-[10px] text-white/45">
          {formatDeltaSeconds(-0.9)} … {formatDeltaSeconds(0.9)} · {CONTEXT_STRIP_SAMPLES} tiles ·{" "}
          ~{(1000 * stepSeconds).toFixed(0)} ms
        </span>
      </div>
      <div className="flex gap-0 overflow-x-auto">
        {frames.map((src, i) => {
          const t = times[i] ?? 0;
          const isActive = i === activeIndex;
          const deltaFromAnchor = t - anchorSeconds;
          return (
            <button
              key={`${t}-${i}`}
              type="button"
              className={cn(
                "relative min-w-[52px] flex-1 overflow-hidden border-r border-white/10 transition-all last:border-r-0 sm:min-w-[64px]",
                isActive
                  ? "ring-2 ring-inset ring-[color:var(--accent)] brightness-110"
                  : "brightness-75 hover:brightness-100",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(t);
              }}
              aria-label={`Seek to ${formatTimestamp(t)}`}
              title={formatTimestamp(t)}
            >
              <div className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
                <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-0.5 py-0.5">
                <span className="block text-center font-mono text-[9px] leading-tight text-white/90">
                  {formatDeltaSeconds(deltaFromAnchor)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
