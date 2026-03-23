import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { cn, formatTimestamp } from "@/lib/utils";

const MIN_FRAME_WIDTH = 80;
const FRAME_ASPECT = 9 / 16;
const MAX_FRAMES = 600;

export const FRAME_INTERVALS = [1, 2] as const;
export type FrameInterval = (typeof FRAME_INTERVALS)[number];

interface FrameStripProps {
  muxPlaybackId: string;
  duration: number;
  currentTime: number;
  interval: FrameInterval;
  onSeek: (time: number) => void;
}

function buildFrameThumbnailUrl(playbackId: string, time: number): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${Math.floor(time)}&width=160`;
}

export function FrameStrip({
  muxPlaybackId,
  duration,
  currentTime,
  interval,
  onSeek,
}: FrameStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const frames = useMemo(() => {
    if (!duration || duration <= 0) return [];
    const count = Math.min(Math.ceil(duration / interval), MAX_FRAMES);
    const result: { time: number; index: number }[] = [];
    for (let i = 0; i < count; i++) {
      result.push({ time: i * interval, index: i });
    }
    return result;
  }, [duration, interval]);

  const frameWidth = useMemo(() => {
    if (!containerWidth || frames.length === 0) return MIN_FRAME_WIDTH;
    const naturalWidth = containerWidth / frames.length;
    return Math.max(naturalWidth, MIN_FRAME_WIDTH);
  }, [containerWidth, frames.length]);

  const frameHeight = frameWidth * FRAME_ASPECT;
  const totalStripWidth = frames.length * frameWidth;
  const isScrollable = totalStripWidth > containerWidth;

  const activeFrameIndex = useMemo(() => {
    if (frames.length === 0) return -1;
    const idx = Math.floor(currentTime / interval);
    return Math.min(idx, frames.length - 1);
  }, [currentTime, interval, frames.length]);

  // Auto-scroll to keep playback position visible
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isScrollable || isUserScrollingRef.current) return;
    if (activeFrameIndex < 0) return;

    const frameCenter = activeFrameIndex * frameWidth + frameWidth / 2;
    const targetScroll = frameCenter - containerWidth / 2;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const clampedScroll = Math.max(0, Math.min(targetScroll, maxScroll));

    el.scrollTo({ left: clampedScroll, behavior: "smooth" });
  }, [activeFrameIndex, frameWidth, containerWidth, isScrollable]);

  const handleScroll = useCallback(() => {
    isUserScrollingRef.current = true;
    if (userScrollTimeoutRef.current !== null) {
      window.clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
      userScrollTimeoutRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current !== null) {
        window.clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  const handleFrameClick = useCallback(
    (time: number) => {
      onSeek(time);
    },
    [onSeek],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, index: number) => {
      setHoveredIndex(index);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHoverPos({ x: rect.left + rect.width / 2, y: rect.top });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  if (frames.length === 0) return null;

  const playheadTime = frames[activeFrameIndex]?.time ?? 0;

  return (
    <div className="relative mb-2 rounded border border-white/10 bg-black/50">
      <div className="flex flex-wrap items-baseline justify-between gap-1 border-b border-white/10 px-2 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-white/55">Film strip</span>
        <span className="font-mono text-[10px] text-white/70">
          Playhead{" "}
          <span className="text-[color:var(--accent)]">{formatTimestamp(playheadTime)}</span>
          <span className="text-white/45"> · {interval}s frames · </span>
          <span className="text-white/45">
            {activeFrameIndex + 1} / {frames.length}
          </span>
        </span>
      </div>
      <div
        ref={scrollRef}
        className={cn(
          "frame-strip-scroll flex gap-0 overflow-x-auto px-0",
          isScrollable && "scroll-smooth",
        )}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
        onScroll={handleScroll}
      >
        <style>{`
          .frame-strip-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <div
          className="flex flex-shrink-0"
          style={{ width: isScrollable ? totalStripWidth : "100%" }}
        >
          {frames.map((frame) => {
            const isPlayhead = activeFrameIndex === frame.index;
            return (
              <button
                key={frame.index}
                type="button"
                className={cn(
                  "relative flex-shrink-0 overflow-hidden border-y-2 border-r border-white/10 transition-[filter] last:border-r-0",
                  isPlayhead
                    ? "z-[1] border-y-[color:var(--accent)] brightness-100 [box-shadow:inset_0_0_0_2px_rgba(255,255,255,0.95)]"
                    : "border-y-transparent brightness-[0.72] hover:brightness-100",
                )}
                style={{
                  width: isScrollable ? frameWidth : `${100 / frames.length}%`,
                  height: frameHeight,
                }}
                onClick={() => handleFrameClick(frame.time)}
                onMouseMove={(e) => handleMouseMove(e, frame.index)}
                onMouseLeave={handleMouseLeave}
                aria-label={`Seek to ${formatTimestamp(frame.time)}${isPlayhead ? " (current playhead)" : ""}`}
                aria-current={isPlayhead ? "time" : undefined}
              >
                {isPlayhead && (
                  <span className="pointer-events-none absolute left-0 right-0 top-0 z-[2] bg-[color:var(--accent)] py-0.5 text-center font-mono text-[9px] font-semibold uppercase tracking-wide text-black">
                    Playhead
                  </span>
                )}
                <img
                  src={buildFrameThumbnailUrl(muxPlaybackId, frame.time)}
                  alt=""
                  loading="lazy"
                  className={cn(
                    "pointer-events-none h-full w-full object-cover",
                    isPlayhead && "brightness-105",
                  )}
                  draggable={false}
                />
                {isPlayhead && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-[color:var(--accent)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredIndex !== null && frames[hoveredIndex] && (
        <HoverPreview
          muxPlaybackId={muxPlaybackId}
          time={frames[hoveredIndex].time}
          posX={hoverPos.x}
          posY={hoverPos.y}
          scrollContainerRef={scrollRef}
        />
      )}
    </div>
  );
}

function HoverPreview({
  muxPlaybackId,
  time,
  posX,
  posY,
  scrollContainerRef,
}: {
  muxPlaybackId: string;
  time: number;
  posX: number;
  posY: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const previewWidth = 200;
  const previewHeight = previewWidth * FRAME_ASPECT;

  const containerRect = scrollContainerRef.current?.getBoundingClientRect();
  if (!containerRect) return null;

  const clampedX = Math.max(
    containerRect.left + previewWidth / 2 + 4,
    Math.min(posX, containerRect.right - previewWidth / 2 - 4),
  );

  return (
    <div
      className="pointer-events-none fixed z-50 flex flex-col items-center"
      style={{
        left: clampedX,
        top: posY - previewHeight - 28,
        transform: "translateX(-50%)",
      }}
    >
      <div
        className="overflow-hidden rounded border border-white/20 shadow-2xl"
        style={{ width: previewWidth, height: previewHeight }}
      >
        <img
          src={buildFrameThumbnailUrl(muxPlaybackId, time)}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
      <div className="mt-1 rounded bg-black/90 px-2 py-0.5 text-xs font-mono text-white/90">
        {formatTimestamp(time)}
      </div>
    </div>
  );
}
