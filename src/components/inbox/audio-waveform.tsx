'use client';

import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AudioWaveformProps {
  className?: string;
  durationSeconds?: number;
  onSeek?: (position: number) => void;
  progress?: number;
  seekLabel?: string;
  values: number[];
}

/** Compact bars fed from the microphone analyser (or its captured history). */
export function AudioWaveform({
  className,
  durationSeconds,
  onSeek,
  progress,
  seekLabel,
  values,
}: AudioWaveformProps) {
  const seekingRef = useRef(false);
  const canSeek = Boolean(onSeek && durationSeconds && durationSeconds > 0);

  const seekFromClientX = useCallback(
    (clientX: number, element: HTMLDivElement) => {
      if (!onSeek) return;
      const bounds = element.getBoundingClientRect();
      if (!bounds.width) return;
      onSeek(Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)));
    },
    [onSeek]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!canSeek || !durationSeconds || !onSeek) return;
      const current = (progress ?? 0) * durationSeconds;
      const step = Math.min(5, Math.max(1, durationSeconds / 20));
      let next = current;

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next -= step;
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next += step;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = durationSeconds;
          break;
        default:
          return;
      }

      event.preventDefault();
      onSeek(Math.max(0, Math.min(1, next / durationSeconds)));
    },
    [canSeek, durationSeconds, onSeek, progress]
  );

  return (
    <div
      aria-hidden={canSeek ? undefined : true}
      aria-label={canSeek ? seekLabel : undefined}
      aria-valuemax={canSeek ? durationSeconds : undefined}
      aria-valuemin={canSeek ? 0 : undefined}
      aria-valuenow={
        canSeek ? Math.round((progress ?? 0) * durationSeconds!) : undefined
      }
      className={cn(
        'flex h-8 min-w-0 flex-1 items-center gap-0 sm:gap-px',
        canSeek &&
          'focus-visible:ring-ring/50 cursor-pointer touch-none rounded-sm outline-none focus-visible:ring-2',
        className
      )}
      onKeyDown={canSeek ? handleKeyDown : undefined}
      onPointerCancel={
        canSeek
          ? () => {
              seekingRef.current = false;
            }
          : undefined
      }
      onPointerDown={
        canSeek
          ? (event) => {
              seekingRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              seekFromClientX(event.clientX, event.currentTarget);
            }
          : undefined
      }
      onPointerMove={
        canSeek
          ? (event) => {
              if (seekingRef.current) {
                seekFromClientX(event.clientX, event.currentTarget);
              }
            }
          : undefined
      }
      onPointerUp={
        canSeek
          ? (event) => {
              seekingRef.current = false;
              seekFromClientX(event.clientX, event.currentTarget);
            }
          : undefined
      }
      role={canSeek ? 'slider' : undefined}
      tabIndex={canSeek ? 0 : undefined}
    >
      {values.map((value, index) => {
        const active =
          progress === undefined ||
          index / Math.max(values.length - 1, 1) <= progress;
        return (
          <span
            key={index}
            className={cn(
              'min-w-0 flex-1 rounded-full transition-[height,background-color] duration-100 sm:min-w-px',
              active ? 'bg-primary/80' : 'bg-muted-foreground/25'
            )}
            style={{ height: `${Math.max(3, Math.round(3 + value * 29))}px` }}
          />
        );
      })}
    </div>
  );
}
