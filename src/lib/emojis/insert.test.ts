import { describe, expect, it } from 'vitest';
import { insertEmojiAtSelection } from './insert';

describe('insertEmojiAtSelection', () => {
  it('inserts a compound emoji at the textarea cursor', () => {
    expect(insertEmojiAtSelection('Hola  cómo estás', '👨🏻‍💻', 5)).toEqual({
      value: 'Hola 👨🏻‍💻 cómo estás',
      cursorPosition: 12,
    });
  });

  it('replaces the selected text while preserving variation selectors and ZWJ sequences', () => {
    expect(insertEmojiAtSelection('Hola amigo', '🏳️‍🌈', 5, 10)).toEqual({
      value: 'Hola 🏳️‍🌈',
      cursorPosition: 11,
    });
  });
});
