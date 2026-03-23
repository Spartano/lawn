import { useCallback, useEffect, useRef } from "react";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const stepSeconds =
    times.length >= 2
      ? Math.abs(times[1] - times[0])
      : 1.8 / Math.max(1, CONTEXT_STRIP_SAMPLES - 1);

  const n = times.length;

  useEffect(() => {
    tileRefs.current = tileRefs.current.slice(0, n);
  }, [n]);

  useEffect(() => {
    const el = tileRefs.current[activeIndex];
    if (!el || !rootRef.current?.contains(document.activeElement)) return;
    el.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activeIndex]);

  const handleStripKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (n === 0) return;
      let next: number | null = null;
      if (e.key === "ArrowRight") next = Math.min(activeIndex + 1, n - 1);
      else if (e.key === "ArrowLeft") next = Math.max(activeIndex - 1, 0);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = n - 1;
      if (next === null) return;
      e.preventDefault();
      e.stopPropagation();
      if (next !== activeIndex) onSeek(times[next] ?? 0);
    },
    [n, activeIndex, onSeek, times],
  );

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
    <div
      ref={rootRef}
      className="mb-2 rounded border border-white/10 bg-black/50 outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      tabIndex={0}
      role="toolbar"
      aria-label="Context strip. Press arrow keys to step between frames around the anchor."
      onKeyDown={handleStripKeyDown}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-1 border-b border-white/10 px-2 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-white/55">Context strip</span>
        <span className="text-right font-mono text-[10px] text-white/45">
          <span className="text-white/70">
            Tile <span className="text-[color:var(--accent)]">{activeIndex + 1}</span> of {n}
          </span>
          <span className="text-white/35"> · </span>
          {formatDeltaSeconds(-0.9)} … {formatDeltaSeconds(0.9)} · {CONTEXT_STRIP_SAMPLES} tiles · ~{(1000 * stepSeconds).toFixed(0)}{" "}
          ms · <span className="text-white/55">←/→ Home/End</span>
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
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              type="button"
              className={cn(
                "relative min-w-[52px] flex-1 overflow-hidden border-y-2 border-r border-white/10 transition-[filter] last:border-r-0 sm:min-w-[64px]",
                isActive
                  ? "z-[1] border-y-[color:var(--accent)] brightness-100 [box-shadow:inset_0_0_0_2px_rgba(255,255,255,0.95)]"
                  : "border-y-transparent brightness-[0.72] hover:brightness-100",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(t);
              }}
              aria-label={`Seek to ${formatTimestamp(t)}${isActive ? " (closest to playhead)" : ""}`}
              aria-current={isActive ? "true" : undefined}
              title={formatTimestamp(t)}
            >
              {isActive && (
                <span className="pointer-events-none absolute left-0 right-0 top-0 z-[2] bg-[color:var(--accent)] py-0.5 text-center font-mono text-[9px] font-semibold uppercase tracking-wide text-black">
                  Playhead
                </span>
              )}
              <div className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
                <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-0.5 py-0.5">
                <span
                  className={cn(
                    "block text-center font-mono text-[9px] leading-tight",
                    isActive ? "font-semibold text-white" : "text-white/90",
                  )}
                >
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
