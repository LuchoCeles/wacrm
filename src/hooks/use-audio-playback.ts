'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAudioPlaybackOptions {
  src: string | null;
  onError?: () => void;
}

/** Small, browser-native player for the recorder's local preview blob. */
export function useAudioPlayback({ src, onError }: UseAudioPlaybackOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onErrorRef = useRef(onError);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  useEffect(() => {
    // A previous preview can still be playing if the recording was paused
    // again after a resume. Pausing it emits its normal `pause` event rather
    // than synchronously changing React state from this setup effect.
    audioRef.current?.pause();
    if (!src) {
      audioRef.current = null;
      return;
    }

    const audio = new Audio(src);
    const syncTime = () => setCurrentTime(audio.currentTime);
    const finish = () => {
      audio.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const pause = () => setIsPlaying(false);
    const play = () => setIsPlaying(true);
    const fail = () => {
      setIsPlaying(false);
      onErrorRef.current?.();
    };

    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('ended', finish);
    audio.addEventListener('pause', pause);
    audio.addEventListener('play', play);
    audio.addEventListener('error', fail);
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('ended', finish);
      audio.removeEventListener('pause', pause);
      audio.removeEventListener('play', play);
      audio.removeEventListener('error', fail);
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [src]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      onErrorRef.current?.();
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const duration = Number.isFinite(audio.duration)
      ? audio.duration
      : Math.max(0, seconds);
    const nextTime = Math.max(0, Math.min(seconds, duration));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  return { currentTime, isPlaying, seek, stop, toggle };
}
