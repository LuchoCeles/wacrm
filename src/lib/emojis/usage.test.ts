import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearEmojiUsage,
  getFrequentlyUsedEmojis,
  registerEmojiUsage,
} from './usage';

describe('emoji usage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: new MapStorage() });
  });

  it('sorts emojis by frequency and then by last use without altering Unicode', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3);
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
});

class MapStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
