import { emojiToUnified } from './unicode';

/**
 * Browser-local usage data for the emoji picker. Emoji strings are always
 * used as keys as-is: this deliberately preserves variation selectors and
 * zero-width joiners in compound Unicode emojis.
 */
export interface EmojiUsage {
  count: number;
  lastUsed: number;
}

export type EmojiUsageMap = Record<string, EmojiUsage>;

const STORAGE_KEY = 'wacrm:emoji-usage';
// emoji-picker-react owns the visible "Más usados" list. Keep its storage in
// sync when a message is successfully sent, rather than when an emoji is
// merely inserted into a draft.
const PICKER_SUGGESTED_STORAGE_KEY = 'epr_suggested';
const MAX_FREQUENT_EMOJIS = 32;
const SKIN_TONE_UNIFIED_VALUES = new Set([
  '1f3fb',
  '1f3fc',
  '1f3fd',
  '1f3fe',
  '1f3ff',
]);

export const DEFAULT_FREQUENT_EMOJIS = [
  '😂',
  '❤️',
  '👍',
  '🙏',
  '🔥',
  '😊',
  '🎉',
  '😭',
  '😍',
  '👏',
  '✅',
  '👋',
  '😅',
  '😁',
  '🤔',
  '😢',
  '😎',
  '💪',
  '🤝',
  '✨',
  '🚀',
  '💯',
  '🎂',
  '🙌',
];

function readUsage(): EmojiUsageMap {
  if (typeof window === 'undefined') return {};

  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '{}'
    );

    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    return Object.fromEntries(
      Object.entries(value).filter(
        ([, usage]) =>
          usage &&
          typeof usage === 'object' &&
          typeof (usage as EmojiUsage).count === 'number' &&
          typeof (usage as EmojiUsage).lastUsed === 'number'
      )
    ) as EmojiUsageMap;
  } catch {
    return {};
  }
}

function writeUsage(usage: EmojiUsageMap): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Private browsing or a full quota should never block composing a message.
  }
}

interface PickerSuggestedEmoji {
  unified: string;
  original: string;
  count: number;
}

function readPickerSuggestions(): PickerSuggestedEmoji[] {
  if (typeof window === 'undefined') return [];

  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(PICKER_SUGGESTED_STORAGE_KEY) ?? '[]'
    );
    if (!Array.isArray(value)) return [];

    return value.filter(
      (suggestion): suggestion is PickerSuggestedEmoji =>
        suggestion &&
        typeof suggestion === 'object' &&
        typeof (suggestion as PickerSuggestedEmoji).unified === 'string' &&
        typeof (suggestion as PickerSuggestedEmoji).original === 'string' &&
        typeof (suggestion as PickerSuggestedEmoji).count === 'number'
    );
  } catch {
    return [];
  }
}

function originalUnified(unified: string): string {
  return unified
    .split('-')
    .filter((part) => !SKIN_TONE_UNIFIED_VALUES.has(part))
    .join('-');
}

/**
 * Repairs suggestions written by earlier versions, where `original` repeated
 * the selected skin-tone variant. It is safe to call at picker module load:
 * this storage belongs only to the local frequent-emoji UI.
 */
export function migratePickerSuggestions(): void {
  if (typeof window === 'undefined') return;

  try {
    const suggestions = readPickerSuggestions();
    const normalized = suggestions.map((suggestion) => ({
      ...suggestion,
      original: originalUnified(suggestion.unified),
    }));

    if (
      normalized.some(
        (suggestion, index) =>
          suggestion.original !== suggestions[index]?.original
      )
    ) {
      window.localStorage.setItem(
        PICKER_SUGGESTED_STORAGE_KEY,
        JSON.stringify(normalized)
      );
    }
  } catch {
    // See writeUsage: local preferences must never block composing a message.
  }
}

function writePickerSuggestion(emoji: string): void {
  if (typeof window === 'undefined') return;

  try {
    const unified = emojiToUnified(emoji);
    // `emoji-picker-react` uses `unified` to render the saved variant and
    // `original` to resolve its base emoji metadata. Keeping a skin-tone
    // modifier in both fields makes its suggested-category image lookup
    // unstable for non-neutral variants (and compound ZWJ emojis).
    const original = originalUnified(unified);
    const suggestions = readPickerSuggestions();
    const existing = suggestions.find((item) => item.unified === unified);
    const next = existing
      ? [
          { ...existing, count: existing.count + 1 },
          ...suggestions.filter((item) => item !== existing),
        ]
      : [{ unified, original, count: 1 }, ...suggestions];

    // Match emoji-picker-react's own cap and storage shape so its frequent
    // category reflects sent emojis without relying on a private callback.
    window.localStorage.setItem(
      PICKER_SUGGESTED_STORAGE_KEY,
      JSON.stringify(next.slice(0, 14))
    );
  } catch {
    // See writeUsage: local preferences must never block sending a message.
  }
}

export function getFrequentlyUsedEmojis(limit = MAX_FREQUENT_EMOJIS): string[] {
  const usage = readUsage();
  const frequentlyUsed = Object.entries(usage)
    .sort(
      ([, left], [, right]) =>
        right.count - left.count || right.lastUsed - left.lastUsed
    )
    .slice(0, limit)
    .map(([emoji]) => emoji);

  return frequentlyUsed.length > 0
    ? frequentlyUsed
    : DEFAULT_FREQUENT_EMOJIS.slice(0, limit);
}

export function registerEmojiUsage(emoji: string): void {
  if (!emoji) return;

  const usage = readUsage();
  const current = usage[emoji];
  usage[emoji] = {
    count: (current?.count ?? 0) + 1,
    lastUsed: Date.now(),
  };
  writeUsage(usage);
  writePickerSuggestion(emoji);
}

export function clearEmojiUsage(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See writeUsage: this is a local preference, so failures are harmless.
  }
}
