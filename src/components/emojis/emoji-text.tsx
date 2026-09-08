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
}

interface EmojiImageProps {
  emoji: string;
  unified: string;
}

// Assets that returned 404 once are kept as Unicode for the rest of the
// session, avoiding repeated failed requests as a conversation re-renders.
const failedEmojiAssets = new Set<string>();

/**
 * A single inline graphic emoji with an exact-Unicode fallback. The URL is
 * derived exclusively from code points, never from arbitrary message HTML.
 */
const EmojiImage = memo(function EmojiImage({
  emoji,
  unified,
}: EmojiImageProps) {
  const [failed, setFailed] = useState(() => failedEmojiAssets.has(unified));
  const source = getAppleEmojiAssetUrlByUnified(unified);

  if (failed || !source) return <>{emoji}</>;

  return (
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
});

/**
 * Renders mixed text as ordinary React text nodes plus graphic emoji assets.
 * It never parses HTML or mutates the supplied Unicode string.
 */
export const EmojiText = memo(function EmojiText({
  text,
  className,
}: EmojiTextProps) {
  const value = text ?? '';
  const tokens = useMemo(() => tokenizeEmojiText(value), [value]);

  if (!value) return null;

  return (
    <span className={cn('emoji-text', className)}>
      {tokens.map((token, index) =>
        token.type === 'emoji' ? (
          <EmojiImage
            emoji={token.value}
            key={`${token.unified}-${index}`}
            unified={token.unified}
          />
        ) : (
          <span key={`text-${index}`}>{token.value}</span>
        )
      )}
    </span>
  );
});
