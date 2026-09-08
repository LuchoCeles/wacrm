import { describe, expect, it } from 'vitest';
import {
  APPLE_EMOJI_ASSET_BASE_URL,
  emojiToUnified,
  getAppleEmojiAssetUrlByUnified,
  segmentGraphemes,
  tokenizeEmojiText,
} from './unicode';

const COMPLEX_EMOJIS = [
  '😀',
  '❤️',
  '👍',
  '👍🏻',
  '👍🏼',
  '👍🏽',
  '👍🏾',
  '👍🏿',
  '👋🏽',
  '👨‍💻',
  '👩‍💻',
  '👨🏽‍💻',
  '👩🏿‍⚕️',
  '👨‍👩‍👧‍👦',
  '👩‍❤️‍👨',
  '🏳️‍🌈',
  '🏳️‍⚧️',
  '🧑‍🚀',
  '🫱🏻‍🫲🏿',
  '👨🏻‍🫯‍👨🏼',
];

describe('emoji Unicode helpers', () => {
  it('keeps every required complex emoji as one grapheme', () => {
    for (const emoji of COMPLEX_EMOJIS) {
      expect(segmentGraphemes(emoji)).toEqual([emoji]);
    }
  });

  it('creates one graphic token for every required compound sequence', () => {
    for (const emoji of COMPLEX_EMOJIS) {
      expect(tokenizeEmojiText(emoji)).toEqual([
        {
          type: 'emoji',
          value: emoji,
          unified: emojiToUnified(emoji),
        },
      ]);
    }
  });

  it('tokenizes mixed text without losing whitespace, newlines, URLs, or Unicode', () => {
    const input = 'Hola 👋🏽 ¿cómo estás? 😄\nhttps://example.test/🏳️‍🌈 #️⃣ 🇦🇷';
    const tokens = tokenizeEmojiText(input);

    expect(tokens.map((token) => token.value).join('')).toBe(input);
    expect(
      tokens
        .filter((token) => token.type === 'emoji')
        .map((token) => token.value)
    ).toEqual(['👋🏽', '😄', '🏳️‍🌈', '#️⃣', '🇦🇷']);
  });

  it('preserves the exact Unicode sequence when deriving asset IDs', () => {
    const emoji = '👨🏻‍🫯‍👨🏼';
    const unified = '1f468-1f3fb-200d-1faef-200d-1f468-1f3fc';

    expect(emojiToUnified(emoji)).toBe(unified);
    expect(getAppleEmojiAssetUrlByUnified(unified)).toBe(
      `${APPLE_EMOJI_ASSET_BASE_URL}${unified}.png`
    );
  });

  it('keeps an asset candidate intact for the visual fallback', () => {
    const candidate = '👨🏻‍🫯‍👨🏼';
    expect(tokenizeEmojiText(candidate)).toEqual([
      {
        type: 'emoji',
        value: candidate,
        unified: emojiToUnified(candidate),
      },
    ]);
  });
});
