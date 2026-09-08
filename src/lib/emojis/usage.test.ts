import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearEmojiUsage,
  getFrequentlyUsedEmojis,
  migratePickerSuggestions,
  registerEmojiUsage,
} from './usage';

describe('emoji usage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: new MapStorage() });
  });

  it('sorts emojis by frequency and then by last use without altering Unicode', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(3);
    registerEmojiUsage('👨🏻‍💻');
    registerEmojiUsage('❤️');
    registerEmojiUsage('👨🏻‍💻');

    expect(getFrequentlyUsedEmojis(2)).toEqual(['👨🏻‍💻', '❤️']);
  });

  it('clears local usage data', () => {
    registerEmojiUsage('🏳️‍🌈');
    clearEmojiUsage();

    expect(getFrequentlyUsedEmojis(1)).toEqual(['😂']);
  });

  it('updates the picker frequency only when usage is registered', () => {
    registerEmojiUsage('👍🏽');

    expect(
      JSON.parse(window.localStorage.getItem('epr_suggested') ?? '[]')
    ).toEqual([{ unified: '1f44d-1f3fd', original: '1f44d', count: 1 }]);
  });

  it('keeps compound emoji variants intact while resolving their base entry', () => {
    registerEmojiUsage('👨🏻‍💻');

    expect(
      JSON.parse(window.localStorage.getItem('epr_suggested') ?? '[]')
    ).toEqual([
      {
        unified: '1f468-1f3fb-200d-1f4bb',
        original: '1f468-200d-1f4bb',
        count: 1,
      },
    ]);
  });

  it('repairs previously saved skin-tone suggestions on picker load', () => {
    window.localStorage.setItem(
      'epr_suggested',
      JSON.stringify([
        {
          unified: '1f44d-1f3fd',
          original: '1f44d-1f3fd',
          count: 3,
        },
      ])
    );

    migratePickerSuggestions();

    expect(
      JSON.parse(window.localStorage.getItem('epr_suggested') ?? '[]')
    ).toEqual([{ unified: '1f44d-1f3fd', original: '1f44d', count: 3 }]);
  });
});

class MapStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
