import {
  emojiRecordForUnified,
  emojiRecordForValue,
  type EmojiRecord,
} from './emoji-catalog';
import {
  getFrequentlyUsedEmojis,
  registerEmojiUsage,
} from '@/lib/emojis/usage';

const LEGACY_SUGGESTED_STORAGE_KEY = 'epr_suggested';
const MAX_RECENT_EMOJIS = 14;

interface LegacySuggestedEmoji {
  unified: string;
  original: string;
  count: number;
}

function readLegacySuggested(): LegacySuggestedEmoji[] {
  if (typeof window === 'undefined') return [];

  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(LEGACY_SUGGESTED_STORAGE_KEY) ?? '[]'
    );

    if (!Array.isArray(value)) return [];

    return value.filter(
      (entry): entry is LegacySuggestedEmoji =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as LegacySuggestedEmoji).unified === 'string' &&
        typeof (entry as LegacySuggestedEmoji).original === 'string' &&
        typeof (entry as LegacySuggestedEmoji).count === 'number'
    );
  } catch {
    return [];
  }
}

function writeLegacySuggested(entries: LegacySuggestedEmoji[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      LEGACY_SUGGESTED_STORAGE_KEY,
      JSON.stringify(entries)
    );
  } catch {
    // A full or unavailable localStorage must never block emoji insertion.
  }
}

/**
 * Retains every existing emoji-picker-react recent entry, then fills the
 * remainder from the app's own usage store. This makes the migration invisible
 * for existing users while finally connecting the app's tracked usage to UI.
 */
export function getRecentEmojiRecords(): EmojiRecord[] {
  const legacy = readLegacySuggested()
    .sort((left, right) => right.count - left.count)
    .map((entry) => emojiRecordForUnified(entry.unified));
  const seen = new Set(legacy.map((emoji) => emoji.unified));
  const current = getFrequentlyUsedEmojis(MAX_RECENT_EMOJIS)
    .map(emojiRecordForValue)
    .filter((emoji) => {
      if (seen.has(emoji.unified)) return false;
      seen.add(emoji.unified);
      return true;
    });

  return [...legacy, ...current].slice(0, MAX_RECENT_EMOJIS);
}

/** Writes both the current app store and the old picker format for migration. */
export function registerRecentEmoji(
  emoji: string,
  unified: string,
  originalUnified: string
): void {
  registerEmojiUsage(emoji);

  const existingEntries = readLegacySuggested();
  const existing = existingEntries.find((entry) => entry.unified === unified);
  const nextEntry = existing ?? {
    unified,
    original: originalUnified,
    count: 0,
  };

  nextEntry.count += 1;
  writeLegacySuggested(
    [nextEntry, ...existingEntries.filter((entry) => entry !== existing)].slice(
      0,
      MAX_RECENT_EMOJIS
    )
  );
}
