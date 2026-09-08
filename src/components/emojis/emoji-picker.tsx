'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const EmojiPickerContent = dynamic(
  () =>
    import('./emoji-picker-content').then(
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
}

/** Preload the dataset before a click without adding it to the inbox bundle. */
export function preloadEmojiPicker(): void {
  void import('./emoji-picker-content');
}

const LoadedEmojiPicker = memo(function LoadedEmojiPicker({
  onEmojiSelect,
  open,
}: EmojiPickerProps) {
  return <EmojiPickerContent onEmojiSelect={onEmojiSelect} open={open} />;
});

/**
 * Delays the first expensive picker render until after the popover entrance
 * starts. The parent keeps this mounted after first use, so close/reopen does
 * not recreate the emoji grid.
 */
export function EmojiPicker({ open, onEmojiSelect }: EmojiPickerProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
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

  return <LoadedEmojiPicker onEmojiSelect={handleEmojiSelect} open={open} />;
}
