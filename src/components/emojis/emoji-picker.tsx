'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const EmojiPickerContent = dynamic(
  () =>
    import('./emoji-picker-content').then((module) => module.EmojiPickerContent),
  {
    ssr: false,
    loading: () => <div className="h-[390px] animate-pulse rounded-xl bg-muted/40" />,
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

/**
 * Delays the first expensive picker render until after the popover entrance
 * starts. The parent keeps this mounted after first use, so close/reopen does
 * not recreate the emoji grid.
 */
export function EmojiPicker({ open, onEmojiSelect }: EmojiPickerProps) {
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!open || hasLoaded) return;

    const timer = window.setTimeout(() => setHasLoaded(true), 80);
    return () => window.clearTimeout(timer);
  }, [hasLoaded, open]);

  if (!hasLoaded) {
    return <div className="h-[390px] animate-pulse rounded-xl bg-muted/40" />;
  }

  return <EmojiPickerContent onEmojiSelect={onEmojiSelect} />;
}
