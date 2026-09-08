import spanishEmojiData from 'emoji-picker-react/dist/data/emojis-es.js';

/**
 * The picker is client-only, so keeping the Unicode catalog in this module
 * means it is parsed once with the lazy picker chunk rather than on every
 * picker render. The shape deliberately mirrors the small public data file
 * from emoji-picker-react without importing its Picker runtime.
 */
interface SourceEmoji {
  n: string[];
  u: string;
  v?: string[];
}

interface SourceEmojiData {
  emojis: Record<string, SourceEmoji[]>;
}

export const EMOJI_CATEGORY_IDS = [
  'suggested',
  'smileys_people',
  'animals_nature',
  'food_drink',
  'activities',
  'travel_places',
  'objects',
  'symbols',
  'flags',
] as const;

export type EmojiCategoryId = (typeof EMOJI_CATEGORY_IDS)[number];

export const SKIN_TONES = [
  'neutral',
  '1f3fb',
  '1f3fc',
  '1f3fd',
  '1f3fe',
  '1f3ff',
] as const;

export type SkinTone = (typeof SKIN_TONES)[number];

export interface EmojiRecord {
  /** Unicode code points joined with hyphens, as they occur in the source. */
  unified: string;
  /** Neutral source sequence used when writing a new recent entry. */
  baseUnified: string;
  emoji: string;
  names: readonly string[];
  searchText: string;
  variations: readonly string[];
}

export interface EmojiSection {
  id: EmojiCategoryId;
  label: string;
  emojis: readonly EmojiRecord[];
}

const sourceData = spanishEmojiData as SourceEmojiData;

/** Converts the catalog's `1f600-200d-...` notation without any DOM work. */
export function emojiFromUnified(unified: string): string {
  try {
    return String.fromCodePoint(
      ...unified.split('-').map((codePoint) => Number.parseInt(codePoint, 16))
    );
  } catch {
    return '';
  }
}

/** Accent-insensitive Spanish matching is calculated once per catalog item. */
export function normalizeEmojiSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es');
}

function toEmojiRecord(source: SourceEmoji): EmojiRecord {
  const emoji = emojiFromUnified(source.u);
  const names = source.n.filter((name) => typeof name === 'string');

  return {
    unified: source.u,
    baseUnified: source.u,
    emoji,
    names,
    searchText: normalizeEmojiSearch(`${emoji} ${names.join(' ')}`),
    variations: source.v ?? [],
  };
}

function createCatalog() {
  const byCategory = {} as Record<
    Exclude<EmojiCategoryId, 'suggested'>,
    readonly EmojiRecord[]
  >;
  const byUnified = new Map<string, EmojiRecord>();
  const byEmoji = new Map<string, EmojiRecord>();

  for (const categoryId of EMOJI_CATEGORY_IDS) {
    if (categoryId === 'suggested') continue;

    const records = (sourceData.emojis[categoryId] ?? []).map(toEmojiRecord);
    byCategory[categoryId] = records;

    for (const record of records) {
      byUnified.set(record.unified, record);
      byEmoji.set(record.emoji, record);

      for (const variation of record.variations) {
        byUnified.set(variation, record);
        byEmoji.set(emojiFromUnified(variation), record);
      }
    }
  }

  return { byCategory, byEmoji, byUnified };
}

const catalog = createCatalog();

/**
 * Static category arrays. These references never change while the picker is
 * open, so filtering and virtual rows can retain them without rebuilding the
 * full catalog on unrelated React renders.
 */
export const EMOJIS_BY_CATEGORY = catalog.byCategory;

/**
 * Pick the current global skin-tone variation exactly once per visible
 * button. If a sequence has no matching variation, its neutral form is kept.
 */
export function emojiForSkinTone(
  record: EmojiRecord,
  skinTone: SkinTone
): { emoji: string; unified: string } {
  if (skinTone === 'neutral' || record.variations.length === 0) {
    return { emoji: record.emoji, unified: record.unified };
  }

  const unified =
    record.variations.find((variation) => variation.includes(skinTone)) ??
    record.unified;

  return { emoji: emojiFromUnified(unified), unified };
}

function fallbackRecord(emoji: string, unified = emoji): EmojiRecord {
  return {
    unified,
    baseUnified: unified,
    emoji,
    names: [emoji],
    searchText: normalizeEmojiSearch(emoji),
    variations: [],
  };
}

/** Resolves legacy `epr_suggested` entries without losing unknown sequences. */
export function emojiRecordForUnified(unified: string): EmojiRecord {
  const record = catalog.byUnified.get(unified);
  if (!record || record.unified === unified) {
    return (
      record ?? fallbackRecord(emojiFromUnified(unified) || unified, unified)
    );
  }

  // Recent values preserve the exact selected skin tone until the user picks
  // another global tone, matching the legacy picker's stored behavior.
  return {
    ...record,
    emoji: emojiFromUnified(unified),
    unified,
  };
}

/** Resolves the app's existing Unicode recent-usage values. */
export function emojiRecordForValue(emoji: string): EmojiRecord {
  const record = catalog.byEmoji.get(emoji);
  if (!record || record.emoji === emoji) return record ?? fallbackRecord(emoji);

  const unified =
    record.variations.find(
      (variation) => emojiFromUnified(variation) === emoji
    ) ?? record.unified;
  return { ...record, emoji, unified };
}

export function filterEmojiRecords(
  emojis: readonly EmojiRecord[],
  normalizedQuery: string
): readonly EmojiRecord[] {
  if (!normalizedQuery) return emojis;

  return emojis.filter((emoji) => emoji.searchText.includes(normalizedQuery));
}
