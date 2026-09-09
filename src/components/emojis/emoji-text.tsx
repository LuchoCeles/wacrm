'use client';

import { memo, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  getAppleEmojiAssetUrlByUnified,
  tokenizeEmojiText,
} from '@/lib/emojis/unicode';

interface EmojiTextProps {
  /** Exact Unicode text from the database, API, or composer state. */
  text: string | null | undefined;
  className?: string;
  /**
   * When supplied by an editor, image emoji occupy the exact advance width
   * of their native Unicode grapheme in this element's computed typography.
   */
  measurementElement?: HTMLElement | null;
  emojiSlotClassName?: string;
}

interface EmojiImageProps {
  emoji: string;
  unified: string;
  slotWidth?: number;
  slotClassName?: string;
}

// Assets that returned 404 once are kept as Unicode for the rest of the
// session, avoiding repeated failed requests as a conversation re-renders.
const failedEmojiAssets = new Set<string>();
const emojiWidthCache = new Map<string, number>();

function getFontMetricsKey(styles: CSSStyleDeclaration): string {
  return [
    styles.font,
    styles.fontKerning,
    styles.fontFeatureSettings,
    styles.fontVariationSettings,
    styles.letterSpacing,
    styles.wordSpacing,
    styles.textTransform,
  ].join('|');
}

/**
 * Measures native Unicode in a browser text run rather than assuming an
 * image's em-size matches the platform emoji font. This is intentionally a
 * DOM measurement: it uses the same shaping and fallback-font path as the
 * textarea, including letter spacing and variable-font settings.
 */
function measureEmojiWidth(
  emoji: string,
  styles: CSSStyleDeclaration,
  metricsKey: string
): number {
  const cacheKey = `${metricsKey}|${emoji}`;
  const cached = emojiWidthCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const meter = document.createElement('span');
  meter.textContent = emoji;
  meter.style.cssText = `
    position: fixed;
    left: -10000px;
    top: -10000px;
    display: inline-block;
    visibility: hidden;
    white-space: pre;
    font: ${styles.font};
    font-kerning: ${styles.fontKerning};
    font-feature-settings: ${styles.fontFeatureSettings};
    font-variation-settings: ${styles.fontVariationSettings};
    letter-spacing: ${styles.letterSpacing};
    word-spacing: ${styles.wordSpacing};
    text-transform: ${styles.textTransform};
  `;
  document.body.append(meter);
  const width = meter.getBoundingClientRect().width;
  meter.remove();

  emojiWidthCache.set(cacheKey, width);
  return width;
}

/**
 * A single inline graphic emoji with an exact-Unicode fallback. The URL is
 * derived exclusively from code points, never from arbitrary message HTML.
 */
const EmojiImage = memo(function EmojiImage({
  emoji,
  unified,
  slotWidth,
  slotClassName,
}: EmojiImageProps) {
  const [failed, setFailed] = useState(() => failedEmojiAssets.has(unified));
  const source = getAppleEmojiAssetUrlByUnified(unified);

  if (failed || !source) return <>{emoji}</>;

  const image = (
    // Standard img is intentional: these tiny external assets are already
    // lazy-loaded by the browser and do not need Next's image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={emoji}
      className="emoji-image"
      decoding="async"
      draggable={false}
      loading="lazy"
      onError={(event) => {
        // Hide the failed element immediately so the browser never leaves a
        // broken-image glyph visible while React swaps in the Unicode fallback.
        failedEmojiAssets.add(unified);
        event.currentTarget.style.display = 'none';
        setFailed(true);
      }}
      src={source}
    />
  );

  // The slot, not the PNG, controls inline layout in editable surfaces. It
  // preserves the textarea's native Unicode advance width for every complete
  // grapheme (flags, skin tones and ZWJ sequences included).
  if (slotWidth !== undefined) {
    return (
      <span
        className={cn('emoji-slot', slotClassName)}
        style={{ width: `${slotWidth}px` }}
      >
        {image}
      </span>
    );
  }

  return image;
});

/**
 * Renders mixed text as ordinary React text nodes plus graphic emoji assets.
 * It never parses HTML or mutates the supplied Unicode string.
 */
export const EmojiText = memo(function EmojiText({
  text,
  className,
  measurementElement,
  emojiSlotClassName,
}: EmojiTextProps) {
  const value = text ?? '';
  const tokens = useMemo(() => tokenizeEmojiText(value), [value]);
  const emojiSlotWidths = useMemo(() => {
    if (!measurementElement) return new Map<string, number>();

    const styles = window.getComputedStyle(measurementElement);
    const metricsKey = getFontMetricsKey(styles);
    const widths = new Map<string, number>();

    for (const token of tokens) {
      if (token.type === 'emoji' && !widths.has(token.value)) {
        widths.set(
          token.value,
          measureEmojiWidth(token.value, styles, metricsKey)
        );
      }
    }

    return widths;
  }, [measurementElement, tokens]);

  if (!value) return null;

  return (
    <span className={cn('emoji-text', className)}>
      {tokens.map((token, index) =>
        token.type === 'emoji' ? (
          <EmojiImage
            emoji={token.value}
            key={`${token.unified}-${index}`}
            slotClassName={emojiSlotClassName}
            slotWidth={emojiSlotWidths.get(token.value)}
            unified={token.unified}
          />
        ) : (
          <span key={`text-${index}`}>{token.value}</span>
        )
      )}
    </span>
  );
});
