import { describe, expect, it } from 'vitest';
import {
  EMOJIS_BY_CATEGORY,
  emojiForSkinTone,
  emojiFromUnified,
  emojiRecordForUnified,
  filterEmojiRecords,
  normalizeEmojiSearch,
  type EmojiSection,
} from './data/emoji-catalog';
import { buildEmojiVirtualRows } from './emoji-virtual-grid';

const catalogSections: EmojiSection[] = [
  {
    id: 'smileys_people',
    label: 'Caras y personas',
    emojis: EMOJIS_BY_CATEGORY.smileys_people,
  },
  {
    id: 'animals_nature',
    label: 'Animales y naturaleza',
    emojis: EMOJIS_BY_CATEGORY.animals_nature,
  },
  {
    id: 'food_drink',
    label: 'Comida y bebida',
    emojis: EMOJIS_BY_CATEGORY.food_drink,
  },
  {
    id: 'activities',
    label: 'Actividades',
    emojis: EMOJIS_BY_CATEGORY.activities,
  },
  {
    id: 'travel_places',
    label: 'Viajes y lugares',
    emojis: EMOJIS_BY_CATEGORY.travel_places,
  },
  {
    id: 'objects',
    label: 'Objetos',
    emojis: EMOJIS_BY_CATEGORY.objects,
  },
  {
    id: 'symbols',
    label: 'Símbolos',
    emojis: EMOJIS_BY_CATEGORY.symbols,
  },
  {
    id: 'flags',
    label: 'Banderas',
    emojis: EMOJIS_BY_CATEGORY.flags,
  },
];

describe('emoji virtual grid layout', () => {
  it('keeps every catalog emoji exactly once while chunking complete rows', () => {
    const rows = buildEmojiVirtualRows(catalogSections, 7);
    const original = catalogSections.flatMap((section) => section.emojis);
    const rendered = rows.flatMap((row) =>
      row.type === 'emojis' ? row.emojis : []
    );

    expect(rendered.map((emoji) => emoji.unified)).toEqual(
      original.map((emoji) => emoji.unified)
    );
    expect(rows.filter((row) => row.type === 'label')).toHaveLength(
      catalogSections.length
    );
    expect(
      rows
        .filter((row) => row.type === 'emojis')
        .every((row) => row.emojis.length <= 7)
    ).toBe(true);
  });

  it('changes row count with width without losing or duplicating emojis', () => {
    const narrow = buildEmojiVirtualRows(catalogSections, 5);
    const wide = buildEmojiVirtualRows(catalogSections, 11);
    const ids = (rows: ReturnType<typeof buildEmojiVirtualRows>) =>
      rows.flatMap((row) =>
        row.type === 'emojis' ? row.emojis.map((emoji) => emoji.unified) : []
      );

    expect(narrow.length).toBeGreaterThan(wide.length);
    expect(ids(narrow)).toEqual(ids(wide));
  });

  it('uses normalized Spanish aliases for search without scanning DOM nodes', () => {
    const emojiWithAccent = EMOJIS_BY_CATEGORY.symbols.find((emoji) =>
      emoji.names.some((name) => /[áéíóú]/i.test(name))
    );
    const alias = emojiWithAccent!.names.find((name) => /[áéíóú]/i.test(name))!;
    const query = normalizeEmojiSearch(alias.toUpperCase());
    const results = filterEmojiRecords(EMOJIS_BY_CATEGORY.symbols, query);

    expect(results.length).toBeGreaterThan(0);
    expect(results).toContain(emojiWithAccent);
    expect(results.every((emoji) => emoji.searchText.includes(query))).toBe(
      true
    );
  });

  it('uses the matching native Unicode skin-tone sequence when available', () => {
    const emojiWithVariations = EMOJIS_BY_CATEGORY.smileys_people.find(
      (emoji) => emoji.variations.length > 0
    );

    expect(emojiWithVariations).toBeDefined();
    const selected = emojiForSkinTone(emojiWithVariations!, '1f3fb');
    expect(selected.unified).toContain('1f3fb');
    expect(selected.emoji).not.toBe('');
    expect(emojiFromUnified('1f600')).toBe('😀');
  });

  it('keeps an individually selected tone when it becomes a recent emoji', () => {
    const base = EMOJIS_BY_CATEGORY.smileys_people.find(
      (emoji) => emoji.variations.length > 0
    );
    const variation = base!.variations[0]!;
    const recent = emojiRecordForUnified(variation);

    expect(recent.unified).toBe(variation);
    expect(recent.baseUnified).toBe(base!.unified);
    expect(recent.emoji).toBe(emojiFromUnified(variation));
  });
});
