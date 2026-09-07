export interface EmojiInsertion {
  value: string;
  cursorPosition: number;
}

/**
 * Replaces a text selection with a complete Unicode emoji sequence. The
 * selection indices intentionally come from the textarea DOM (UTF-16 code
 * units), so slicing never splits an emoji that sits outside the selection.
 */
export function insertEmojiAtSelection(
  value: string,
  emoji: string,
  selectionStart = value.length,
  selectionEnd = selectionStart
): EmojiInsertion {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));

  return {
    value: `${value.slice(0, start)}${emoji}${value.slice(end)}`,
    cursorPosition: start + emoji.length,
  };
}
