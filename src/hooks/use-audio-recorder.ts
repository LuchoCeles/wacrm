'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const OPUS_ENCODER_PATH = '/opus/encoderWorker.min.js';
// Kept compact enough that the waveform can collapse before controls on a
// narrow phone, while still reading as a continuous audio trace on desktop.
const WAVEFORM_BARS = 28;
const WAVEFORM_INTERVAL_MS = 80;

export type AudioRecorderStatus =
  'idle' | 'recording' | 'preview' | 'sending' | 'error';

interface UseAudioRecorderOptions {
  maxDurationSeconds: number;
  onSend: (file: File) => Promise<void>;
  onError: (message: string) => void;
}

function downsampleWaveform(samples: number[], barCount = WAVEFORM_BARS) {
  if (!samples.length) return Array.from({ length: barCount }, () => 0);

  return Array.from({ length: barCount }, (_, index) => {
    const start = Math.floor((index * samples.length) / barCount);
    const end = Math.max(
      start + 1,
      Math.floor(((index + 1) * samples.length) / barCount)
    );
    const bucket = samples.slice(start, end);
    return Math.max(...bucket);
  });
}

function makePreviewFile(pages: Uint8Array[]) {
  const blob = new Blob(pages as unknown as BlobPart[], {
    type: 'audio/ogg',
  });
  return new File([blob], `voice-${Date.now()}.ogg`, { type: 'audio/ogg' });
}

/**
 * Owns one Ogg/Opus take from permission through send/cancel. The encoder,
 * analyser and preview all share the same microphone stream so the visual
 * waveform is derived from the recording rather than a decorative animation.
 */
export function useAudioRecorder({
  maxDurationSeconds,
  onSend,
  onError,
}: UseAudioRecorderOptions) {
  const [status, setStatus] = useState<AudioRecorderStatus>('idle');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(() =>
    Array.from({ length: WAVEFORM_BARS }, () => 0)
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const statusRef = useRef<AudioRecorderStatus>('idle');
  const recorderRef = useRef<import('opus-recorder').default | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pagesRef = useRef<Uint8Array[]>([]);
  const finalFileRef = useRef<File | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const waveformHistoryRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordStartedAtRef = useRef<number | null>(null);
  const elapsedMillisecondsRef = useRef(0);
  const lastDisplayedSecondRef = useRef(-1);
  const lastWaveformPaintRef = useRef(0);
  const startingRef = useRef(false);
  const discardedRef = useRef(false);
  const recordingTokenRef = useRef(0);
  const onSendRef = useRef(onSend);
  const onErrorRef = useRef(onError);
  const pauseRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const setRecorderStatus = useCallback((next: AudioRecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopWaveform = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const stopOwnedAudioResources = useCallback(async () => {
    const source = sourceRef.current;
    const analyser = analyserRef.current;
    const stream = streamRef.current;
    const context = contextRef.current;

    sourceRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    contextRef.current = null;

    try {
      source?.disconnect();
      analyser?.disconnect();
    } catch {
      // Nodes can already be disconnected by the encoder's cleanup.
    }
    stream?.getTracks().forEach((track) => track.stop());
    if (context && context.state !== 'closed') {
      await context.close().catch(() => {});
    }
  }, []);

  const releaseRecorder = useCallback(async () => {
    stopTimer();
    stopWaveform();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    await recorder?.close().catch(() => {});
    await stopOwnedAudioResources();
  }, [stopOwnedAudioResources, stopTimer, stopWaveform]);

  const reset = useCallback(
    async (stopRecorder: boolean) => {
      recordingTokenRef.current += 1;
      stopTimer();
      stopWaveform();
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (stopRecorder) await recorder?.stop().catch(() => {});
      await recorder?.close().catch(() => {});
      await stopOwnedAudioResources();

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      pagesRef.current = [];
      finalFileRef.current = null;
      waveformHistoryRef.current = [];
      elapsedMillisecondsRef.current = 0;
      recordStartedAtRef.current = null;
      lastDisplayedSecondRef.current = -1;
      lastWaveformPaintRef.current = 0;
      discardedRef.current = false;
      setDurationSeconds(0);
      setWaveform(Array.from({ length: WAVEFORM_BARS }, () => 0));
      setPreviewUrl(null);
      setRecorderStatus('idle');
    },
    [setRecorderStatus, stopOwnedAudioResources, stopTimer, stopWaveform]
  );

  const appendElapsedTime = useCallback(() => {
    const startedAt = recordStartedAtRef.current;
    if (startedAt === null) return;
    elapsedMillisecondsRef.current += performance.now() - startedAt;
    recordStartedAtRef.current = null;
    const seconds = Math.floor(elapsedMillisecondsRef.current / 1000);
    lastDisplayedSecondRef.current = seconds;
    setDurationSeconds(seconds);
  }, []);

  const paintWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || statusRef.current !== 'recording') return;

    const now = performance.now();
    if (now - lastWaveformPaintRef.current >= WAVEFORM_INTERVAL_MS) {
      lastWaveformPaintRef.current = now;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const bars = Array.from({ length: WAVEFORM_BARS }, (_, index) => {
        const start = Math.floor((index * data.length) / WAVEFORM_BARS);
        const end = Math.max(
          start + 1,
          Math.floor(((index + 1) * data.length) / WAVEFORM_BARS)
        );
        let total = 0;
        for (let cursor = start; cursor < end; cursor += 1)
          total += data[cursor];
        return total / (end - start) / 255;
      });

      const sample = Math.max(...bars);
      waveformHistoryRef.current.push(sample);
      // Keep enough source data to preserve a representative full-take
      // waveform without growing indefinitely during a long recording.
      if (waveformHistoryRef.current.length > 4_000) {
        waveformHistoryRef.current = waveformHistoryRef.current.filter(
          (_, index) => index % 2 === 0
        );
      }
      setWaveform(bars);
    }

    animationFrameRef.current = requestAnimationFrame(paintWaveform);
  }, []);

  const startTimer = useCallback(() => {
    recordStartedAtRef.current = performance.now();
    stopTimer();
    timerRef.current = setInterval(() => {
      const startedAt = recordStartedAtRef.current;
      if (startedAt === null || statusRef.current !== 'recording') return;
      const nextSecond = Math.floor(
        (elapsedMillisecondsRef.current + performance.now() - startedAt) / 1000
      );
      if (nextSecond !== lastDisplayedSecondRef.current) {
        lastDisplayedSecondRef.current = nextSecond;
        setDurationSeconds(nextSecond);
      }
      if (nextSecond >= maxDurationSeconds) void pauseRef.current();
    }, 250);
  }, [maxDurationSeconds, stopTimer]);

  const updatePreview = useCallback(() => {
    const file = makePreviewFile(pagesRef.current);
    if (!file.size) return null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setWaveform(downsampleWaveform(waveformHistoryRef.current));
    return file;
  }, []);

  const pause = useCallback(async () => {
    if (statusRef.current !== 'recording') return;
    const recorder = recorderRef.current;
    if (!recorder) return;

    stopTimer();
    appendElapsedTime();
    stopWaveform();
    try {
      // flush=true forces the still-open Ogg page into our preview blob.
      await recorder.pause(true);
      updatePreview();
      setRecorderStatus('preview');
    } catch {
      setRecorderStatus('error');
      onErrorRef.current('Could not pause the voice recording.');
    }
  }, [
    appendElapsedTime,
    setRecorderStatus,
    stopTimer,
    stopWaveform,
    updatePreview,
  ]);

  pauseRef.current = pause;

  const start = useCallback(async () => {
    if (startingRef.current || statusRef.current !== 'idle') return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === 'undefined'
    ) {
      onErrorRef.current("Voice recording isn't supported in this browser.");
      return;
    }

    startingRef.current = true;
    discardedRef.current = false;
    const recordingToken = ++recordingTokenRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (recordingToken !== recordingTokenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);

      streamRef.current = stream;
      contextRef.current = context;
      sourceRef.current = source;
      analyserRef.current = analyser;

      const { default: Recorder } = await import('opus-recorder');
      if (recordingToken !== recordingTokenRef.current) {
        await stopOwnedAudioResources();
        return;
      }
      if (!Recorder.isRecordingSupported()) throw new Error('unsupported');
      const recorder = new Recorder({
        encoderPath: OPUS_ENCODER_PATH,
        encoderApplication: 2048,
        encoderSampleRate: 48000,
        numberOfChannels: 1,
        // opus-recorder expects the actual MediaStreamAudioSourceNode here
        // (it reads node.context and later calls node.disconnect()).
        sourceNode: source,
        streamPages: true,
      });
      recorder.ondataavailable = (page) => {
        if (!discardedRef.current) pagesRef.current.push(page.slice());
      };
      recorderRef.current = recorder;
      // Header pages can arrive while start() is still resolving, so clear
      // the previous take before (not after) the encoder starts publishing.
      elapsedMillisecondsRef.current = 0;
      waveformHistoryRef.current = [];
      pagesRef.current = [];
      finalFileRef.current = null;
      setDurationSeconds(0);
      await recorder.start();
      if (recordingToken !== recordingTokenRef.current) {
        await releaseRecorder();
        return;
      }
      setRecorderStatus('recording');
      startTimer();
      animationFrameRef.current = requestAnimationFrame(paintWaveform);
    } catch {
      await releaseRecorder();
      if (recordingToken === recordingTokenRef.current) {
        setRecorderStatus('idle');
        onErrorRef.current('Microphone access was denied or is unavailable.');
      }
    } finally {
      startingRef.current = false;
    }
  }, [
    paintWaveform,
    releaseRecorder,
    setRecorderStatus,
    startTimer,
    stopOwnedAudioResources,
  ]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'preview') return;
    const recorder = recorderRef.current;
    if (!recorder) return;

    recorder.resume();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setRecorderStatus('recording');
    startTimer();
    animationFrameRef.current = requestAnimationFrame(paintWaveform);
  }, [paintWaveform, setRecorderStatus, startTimer]);

  const cancel = useCallback(() => {
    if (statusRef.current === 'idle' && !startingRef.current) return;
    discardedRef.current = true;
    // Return the composer immediately; cleanup continues without retaining
    // the stream or encoded bytes in component state.
    setRecorderStatus('idle');
    void reset(true);
  }, [reset, setRecorderStatus]);

  const send = useCallback(async () => {
    if (statusRef.current === 'sending') return;
    setRecorderStatus('sending');
    stopTimer();
    stopWaveform();

    try {
      let file = finalFileRef.current;
      if (!file) {
        appendElapsedTime();
        await recorderRef.current?.stop();
        file = updatePreview();
      }
      if (!file || file.size === 0) throw new Error('empty');

      finalFileRef.current = file;
      await releaseRecorder();
      await onSendRef.current(file);
      await reset(false);
    } catch {
      setRecorderStatus('error');
      onErrorRef.current('Could not send the voice recording.');
    }
  }, [
    appendElapsedTime,
    releaseRecorder,
    reset,
    setRecorderStatus,
    stopTimer,
    stopWaveform,
    updatePreview,
  ]);

  useEffect(() => {
    return () => {
      discardedRef.current = true;
      void reset(true);
    };
  }, [reset]);

  return {
    cancel,
    durationSeconds,
    pause,
    previewUrl,
    resume,
    send,
    start,
    status,
    waveform,
  };
}
