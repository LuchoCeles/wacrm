'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

let emojiPickerContentPromise:
  | Promise<typeof import('./emoji-picker-content')>
  | undefined;

function loadEmojiPickerContent() {
  emojiPickerContentPromise ??= import('./emoji-picker-content');
  return emojiPickerContentPromise;
}

type IdleSchedulerWindow = {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number }
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleWhenIdle(callback: () => void, timeout: number): () => void {
  // TypeScript's DOM lib declares the API unconditionally, while older
  // browsers do not expose it. Keep the runtime fallback without narrowing
  // `window` to `never` in the fallback branch.
  const idleWindow = window as unknown as IdleSchedulerWindow;
  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, Math.min(timeout, 250));
  return () => window.clearTimeout(handle);
}

const EmojiPickerContent = dynamic(
  () =>
    loadEmojiPickerContent().then(
      (module) => module.EmojiPickerContent
    ),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/40 h-[500px] max-h-[calc(100dvh-96px)] animate-pulse rounded-xl" />
    ),
  }
);

export interface EmojiPickerProps {
  open: boolean;
  onEmojiSelect: (emoji: string) => void;
  usageVersion: number;
}

/** Preload the dataset before a click without adding it to the inbox bundle. */
export function preloadEmojiPicker(): void {
  void loadEmojiPickerContent();
}

const LoadedEmojiPicker = memo(function LoadedEmojiPicker({
  onEmojiSelect,
  open,
}: Omit<EmojiPickerProps, 'usageVersion'>) {
  return <EmojiPickerContent onEmojiSelect={onEmojiSelect} open={open} />;
});

/**
 * Delays the first expensive picker render until after the popover entrance
 * starts. The parent keeps this mounted after first use, so close/reopen does
 * not recreate the emoji grid.
 */
export function EmojiPicker({
  open,
  onEmojiSelect,
  usageVersion,
}: EmojiPickerProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  // The picker has no public API to invalidate only its suggested category.
  // A key is therefore required to re-read localStorage, but doing that while
  // the picker is visible would recreate its data index and scroll state in
  // the middle of an interaction. Refresh it while the popover is closed,
  // then keep that prepared instance for the next opening.
  const [preparedUsageVersion, setPreparedUsageVersion] =
    useState(usageVersion);
  const onEmojiSelectRef = useRef(onEmojiSelect);

  // MessageComposer's insertion callback naturally changes with the current
  // textarea value. Keeping the latest callback in a ref prevents that change
  // from propagating into the loaded picker on every keystroke.
  useEffect(() => {
    onEmojiSelectRef.current = onEmojiSelect;
  }, [onEmojiSelect]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    onEmojiSelectRef.current(emoji);
  }, []);

  // The chunk and its static dataset stay out of the inbox's initial work,
  // while an idle browser gets it ready before the first click. Pointer/focus
  // preloading remains as the fast path when the user approaches the button.
  useEffect(() => {
    let cancelled = false;
    const cancelPreload = scheduleWhenIdle(() => {
      if (!cancelled) preloadEmojiPicker();
    }, 2_000);

    return () => {
      cancelled = true;
      cancelPreload();
    };
  }, []);

  useEffect(() => {
    if (open || usageVersion === preparedUsageVersion) return;

    let cancelled = false;
    const cancelPreparation = scheduleWhenIdle(() => {
      if (!cancelled) setPreparedUsageVersion(usageVersion);
    }, 1_000);

    return () => {
      cancelled = true;
      cancelPreparation();
    };
  }, [open, preparedUsageVersion, usageVersion]);

  useEffect(() => {
    if (!open || hasLoaded) return;

    // Let the portal paint and its transform/opacity animation start first.
    // Two animation frames are deterministic across refresh rates and keep
    // the picker module out of the opening frame.
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setHasLoaded(true));
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [hasLoaded, open]);

  if (!hasLoaded) {
    return (
      <div className="bg-muted/40 h-[500px] max-h-[calc(100dvh-96px)] animate-pulse rounded-xl" />
    );
  }

  return (
    <LoadedEmojiPicker
      key={preparedUsageVersion}
      onEmojiSelect={handleEmojiSelect}
      open={open}
    />
  );
}
