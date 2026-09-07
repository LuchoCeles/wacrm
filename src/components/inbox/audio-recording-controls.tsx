'use client';

import { useEffect } from 'react';
import { Loader2, Mic, Pause, Play, Send, Trash2 } from 'lucide-react';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import type { AudioRecorderStatus } from '@/hooks/use-audio-recorder';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AudioWaveform } from './audio-waveform';

interface AudioRecordingControlsProps {
  durationSeconds: number;
  labels: {
    cancel: string;
    pause: string;
    pausePlayback: string;
    play: string;
    resume: string;
    seek: string;
    send: string;
  };
  onCancel: () => void;
  onPause: () => void;
  onPlaybackError: () => void;
  onResume: () => void;
  onSend: () => void;
  previewUrl: string | null;
  status: AudioRecorderStatus;
  waveform: number[];
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function AudioAction({
  children,
  className,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-45',
              className
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The single-line WhatsApp-like recording/preview state of the composer. */
export function AudioRecordingControls({
  durationSeconds,
  labels,
  onCancel,
  onPause,
  onPlaybackError,
  onResume,
  onSend,
  previewUrl,
  status,
  waveform,
}: AudioRecordingControlsProps) {
  const isRecording = status === 'recording';
  const canPreview = status === 'preview' || status === 'error';
  const { currentTime, isPlaying, seek, stop, toggle } = useAudioPlayback({
    src: previewUrl,
    onError: onPlaybackError,
  });

  useEffect(() => {
    if (isRecording) stop();
  }, [isRecording, stop]);

  const progress = durationSeconds
    ? Math.min(1, currentTime / durationSeconds)
    : undefined;
  const canSeek = canPreview && Boolean(previewUrl) && durationSeconds > 0;
  const timeLabel = isPlaying
    ? `${formatDuration(Math.floor(currentTime))} / ${formatDuration(durationSeconds)}`
    : formatDuration(durationSeconds);

  return (
    <TooltipProvider>
      <div className="bg-muted/45 flex min-h-11 w-full items-center gap-0.5 overflow-hidden rounded-2xl px-1.5 py-1 transition-[background-color] duration-200 sm:ml-auto sm:w-[clamp(20rem,45%,24rem)] sm:gap-1 lg:w-[clamp(20rem,25%,24rem)]">
        <AudioAction label={labels.cancel} onClick={onCancel}>
          <Trash2 className="h-4 w-4" />
        </AudioAction>

        {isRecording ? (
          <span
            aria-label="Recording in progress"
            className="bg-destructive h-2.5 w-2.5 shrink-0 animate-pulse rounded-full"
          />
        ) : (
          <AudioAction
            disabled={!canPreview || !previewUrl}
            label={isPlaying ? labels.pausePlayback : labels.play}
            onClick={() => void toggle()}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 translate-x-px" />
            )}
          </AudioAction>
        )}

        <AudioWaveform
          durationSeconds={canSeek ? durationSeconds : undefined}
          onSeek={
            canSeek ? (position) => seek(position * durationSeconds) : undefined
          }
          progress={progress}
          seekLabel={labels.seek}
          values={waveform}
        />
        <span className="text-foreground w-14 shrink-0 text-right font-mono text-xs tabular-nums sm:w-[4.75rem]">
          {timeLabel}
        </span>

        {isRecording ? (
          <AudioAction label={labels.pause} onClick={() => void onPause()}>
            <Pause className="h-4 w-4" />
          </AudioAction>
        ) : (
          <AudioAction
            disabled={!canPreview || status === 'error'}
            label={labels.resume}
            onClick={() => {
              stop();
              onResume();
            }}
          >
            <Mic className="h-4 w-4" />
          </AudioAction>
        )}

        <AudioAction
          className="bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground shadow-primary/20 h-10 w-10 shadow-sm"
          disabled={status === 'sending'}
          label={labels.send}
          onClick={() => void onSend()}
        >
          {status === 'sending' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </AudioAction>
      </div>
    </TooltipProvider>
  );
}
