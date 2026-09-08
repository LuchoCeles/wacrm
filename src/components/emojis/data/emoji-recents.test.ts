import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecentEmojiRecords, registerRecentEmoji } from './emoji-recents';

describe('emoji recent migration', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: new MapStorage() });
  });

  it('keeps existing emoji-picker-react recent values visible', () => {
    window.localStorage.setItem(
      'epr_suggested',
      JSON.stringify([
        { unified: '1f600', original: '1f600', count: 3 },
        { unified: '2764-fe0f', original: '2764-fe0f', count: 2 },
      ])
    );

    expect(
      getRecentEmojiRecords()
        .slice(0, 2)
        .map((emoji) => emoji.emoji)
    ).toEqual(['😀', '❤️']);
  });

  it('updates the legacy recent format while recording current app usage', () => {
    registerRecentEmoji('👍🏻', '1f44d-1f3fb', '1f44d');

    expect(
      JSON.parse(window.localStorage.getItem('epr_suggested') ?? '[]')
    ).toEqual([{ unified: '1f44d-1f3fb', original: '1f44d', count: 1 }]);
    expect(getRecentEmojiRecords()[0]?.emoji).toBe('👍🏻');
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
