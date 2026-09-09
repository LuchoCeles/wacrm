import emojiRegex from 'emoji-regex';

/**
 * Unicode helpers shared by the picker and the visual renderer.
 *
 * Emoji strings are intentionally never normalized or rewritten here. The
 * value returned to callers is always the exact sequence that came from the
 * message, so it remains safe to persist and send to WhatsApp unchanged.
 */

export const APPLE_EMOJI_ASSET_BASE_URL =
  'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/';
const TWEMOJI_ASSET_BASE_URL =
  'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/';

const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR = /\p{Regional_Indicator}/u;
const COMBINING_MARK = /\p{Mark}/u;
// Constructing emoji-regex compiles a sizeable Unicode table. The matcher is
// immutable and `String#matchAll` clones it for iteration, so it can safely
// be shared by every rendered message.
const EMOJI_MATCHER = emojiRegex();

const ZERO_WIDTH_JOINER = '\u200d';
const TEXT_PRESENTATION_SELECTOR = '\ufe0e';
const KEYCAP = '\u20e3';

function codePointOf(value: string): number {
  return value.codePointAt(0) ?? 0;
}

function isRegionalIndicator(value: string): boolean {
  return REGIONAL_INDICATOR.test(value);
}

function isEmojiModifier(value: string): boolean {
  const codePoint = codePointOf(value);
  return codePoint >= 0x1f3fb && codePoint <= 0x1f3ff;
}

function isVariationSelector(value: string): boolean {
  const codePoint = codePointOf(value);
  return (
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  );
}

function isEmojiTag(value: string): boolean {
  const codePoint = codePointOf(value);
  return codePoint >= 0xe0020 && codePoint <= 0xe007f;
}

function isGraphemeExtension(value: string): boolean {
  return (
    COMBINING_MARK.test(value) ||
    isVariationSelector(value) ||
    isEmojiModifier(value) ||
    isEmojiTag(value) ||
    value === KEYCAP
  );
}

/**
 * Fallback for the small set of older clients without Intl.Segmenter.
 * It preserves emoji modifiers, variation selectors, regional-indicator
 * flags and ZWJ chains as a single unit. Normal text can still be split by
 * code point here without changing its rendered or stored value.
 */
function segmentGraphemesFallback(value: string): string[] {
  const codePoints = Array.from(value);
  const segments: string[] = [];
  let index = 0;

  while (index < codePoints.length) {
    let segment = codePoints[index] ?? '';
    let regionalIndicatorCount = isRegionalIndicator(segment) ? 1 : 0;
    index += 1;

    while (index < codePoints.length) {
      const next = codePoints[index] ?? '';

      if (isGraphemeExtension(next)) {
        segment += next;
        index += 1;
        continue;
      }

      if (next === ZERO_WIDTH_JOINER && index + 1 < codePoints.length) {
        segment += next;
        segment += codePoints[index + 1] ?? '';
        index += 2;
        regionalIndicatorCount = 0;
        continue;
      }

      // Regional indicators form flags in pairs. Do not consume a third one
      // into the same grapheme cluster.
      if (regionalIndicatorCount === 1 && isRegionalIndicator(next)) {
        segment += next;
        regionalIndicatorCount += 1;
        index += 1;
        continue;
      }

      break;
    }

    segments.push(segment);
  }

  return segments;
}

let cachedSegmenter: Intl.Segmenter | null | undefined;

function getGraphemeSegmenter(): Intl.Segmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter;

  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
    cachedSegmenter = null;
    return cachedSegmenter;
  }

  cachedSegmenter = new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
  });
  return cachedSegmenter;
}

/** Returns user-visible grapheme clusters without ever using split(''). */
export function segmentGraphemes(value: string): string[] {
  const segmenter = getGraphemeSegmenter();
  if (!segmenter) return segmentGraphemesFallback(value);

  return Array.from(segmenter.segment(value), ({ segment }) => segment);
}

/**
 * Whether a complete grapheme is an emoji candidate for image rendering.
 * U+FE0E explicitly requests text presentation, so it remains ordinary
 * Unicode text instead of overriding the author's choice with an image.
 */
export function isEmojiGrapheme(value: string): boolean {
  if (!value || value.includes(TEXT_PRESENTATION_SELECTOR)) return false;

  return (
    EXTENDED_PICTOGRAPHIC.test(value) ||
    REGIONAL_INDICATOR.test(value) ||
    value.includes(KEYCAP) ||
    Array.from(value).some(isEmojiTag)
  );
}

/** Converts an existing Unicode sequence to the asset provider's ID format. */
export function emojiToUnified(value: string): string {
  return Array.from(value)
    .map((character) => character.codePointAt(0)?.toString(16) ?? '')
    .filter(Boolean)
    .join('-');
}

/**
 * Builds a trusted Apple asset URL from a provider unified ID. Keeping this
 * mapping central makes the picker and rendered messages use the same asset
 * family without persisting URLs anywhere.
 */
export function getAppleEmojiAssetUrlByUnified(unified: string): string {
  const parts = unified.toLowerCase().split('-');
  const valid =
    parts.length > 0 &&
    parts.every((part) => {
      if (!/^[0-9a-f]{1,6}$/u.test(part)) return false;
      const codePoint = Number.parseInt(part, 16);
      return codePoint >= 0 && codePoint <= 0x10ffff;
    });

  return valid ? `${APPLE_EMOJI_ASSET_BASE_URL}${parts.join('-')}.png` : '';
}

/**
 * emoji-datasource-apple does not publish PNGs for some valid Unicode
 * skin-tone combinations, notably wrestlers and gendered ZWJ sequences.
 * Route only those known gaps to Twemoji, which has matching Unicode assets,
 * so the browser never paints a broken-image frame before the picker removes
 * the emoji after its image error.
 */
export function getPickerEmojiAssetUrlByUnified(unified: string): string {
  const normalized = unified.toLowerCase();
  const skinToneCount = normalized
    .split('-')
    .filter((part) => /^1f3f[b-f]$/u.test(part)).length;
  const hasSkinTone = skinToneCount > 0;
  const isWrestlerWithTone = /^1f93c-1f3f[b-f](?:-|$)/u.test(normalized);
  const isGenderedToneSequence =
    /-200d-(?:2640|2642)-fe0f$/u.test(normalized);
  const isMultiToneZwJSequence =
    skinToneCount > 1 && normalized.includes('-200d-');

  if (
    hasSkinTone &&
    (isWrestlerWithTone || isGenderedToneSequence || isMultiToneZwJSequence)
  ) {
    return `${TWEMOJI_ASSET_BASE_URL}${normalized}.png`;
  }

  return getAppleEmojiAssetUrlByUnified(normalized);
}

export function getAppleEmojiAssetUrl(value: string): string {
  return getAppleEmojiAssetUrlByUnified(emojiToUnified(value));
}

export type EmojiTextToken =
  | { type: 'text'; value: string }
  | { type: 'emoji'; value: string; unified: string };

function appendTokens(target: EmojiTextToken[], nextTokens: EmojiTextToken[]) {
  for (const token of nextTokens) {
    const previous = target[target.length - 1];
    if (previous?.type === 'text' && token.type === 'text') {
      previous.value += token.value;
    } else {
      target.push(token);
    }
  }
}

/**
 * Covers a sequence that is not yet in emoji-regex's Unicode table. This is
 * deliberately a fallback: the explicit regex remains the cross-browser
 * source of truth for current standard sequences, while Segmenter preserves
 * a complete unknown grapheme for the asset-error Unicode fallback.
 */
function tokenizeUnmatchedText(value: string): EmojiTextToken[] {
  const tokens: EmojiTextToken[] = [];
  let textBuffer = '';

  const flushText = () => {
    if (!textBuffer) return;
    tokens.push({ type: 'text', value: textBuffer });
    textBuffer = '';
  };

  for (const grapheme of segmentGraphemes(value)) {
    if (!isEmojiGrapheme(grapheme)) {
      textBuffer += grapheme;
      continue;
    }

    flushText();
    tokens.push({
      type: 'emoji',
      value: grapheme,
      unified: emojiToUnified(grapheme),
    });
  }

  flushText();
  return tokens;
}

/**
 * Safely tokenizes text into React-renderable text and complete emoji nodes.
 * Joining every token's value always recreates the original string exactly.
 */
export function tokenizeEmojiText(value: string): EmojiTextToken[] {
  const tokens: EmojiTextToken[] = [];
  let textStart = 0;

  // emoji-regex ships its Unicode data with the application rather than
  // relying on the browser/OS ICU version. That matters for recent ZWJ
  // sequences on older Windows installations. Its matches are full emoji
  // sequences; Array.from is used only afterwards to derive an asset ID.
  for (const match of value.matchAll(EMOJI_MATCHER)) {
    const emoji = match[0];
    const start = match.index ?? 0;
    const end = start + emoji.length;

    // U+FE0E requests text presentation. emoji-regex deliberately matches
    // the base character, so keep the whole original pair as normal text.
    if (
      emoji.includes(TEXT_PRESENTATION_SELECTOR) ||
      value.slice(end, end + TEXT_PRESENTATION_SELECTOR.length) ===
        TEXT_PRESENTATION_SELECTOR
    ) {
      continue;
    }

    appendTokens(tokens, tokenizeUnmatchedText(value.slice(textStart, start)));
    tokens.push({
      type: 'emoji',
      value: emoji,
      unified: emojiToUnified(emoji),
    });
    textStart = end;
  }

  appendTokens(tokens, tokenizeUnmatchedText(value.slice(textStart)));

  return tokens;
}
