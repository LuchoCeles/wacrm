'use client';

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  EmojiCategoryId,
  EmojiRecord,
  EmojiSection,
  SkinTone,
} from './data/emoji-catalog';
import {
  emojiForSkinTone,
  emojiFromUnified,
  emojiRecordForUnified,
} from './data/emoji-catalog';

const CATEGORY_LABEL_HEIGHT = 34;
const EMOJI_ROW_HEIGHT = 40;
const EMOJI_HORIZONTAL_PADDING = 26;
const DEFAULT_EMOJIS_PER_ROW = 8;
const LONG_PRESS_DELAY = 500;
const VARIATION_MENU_HEIGHT = 52;
const VARIATION_MENU_WIDTH = 274;
const VIEWPORT_MARGIN = 8;

type EmojiVirtualRow =
  | {
      categoryId: EmojiCategoryId;
      height: typeof CATEGORY_LABEL_HEIGHT;
      id: string;
      label: string;
      type: 'label';
    }
  | {
      categoryId: EmojiCategoryId;
      emojis: readonly EmojiRecord[];
      height: typeof EMOJI_ROW_HEIGHT;
      id: string;
      type: 'emojis';
    };

interface VariationPickerState {
  anchor: DOMRect;
  record: EmojiRecord;
}

export interface EmojiVirtualGridHandle {
  focusFirstEmoji: () => void;
  pickFirstEmoji: () => void;
  scrollToCategory: (categoryId: EmojiCategoryId) => boolean;
  scrollToStart: () => void;
}

interface EmojiVirtualGridProps {
  onActiveCategoryChange: (categoryId: EmojiCategoryId | null) => void;
  onEmojiPick: (
    emoji: string,
    unified: string,
    originalUnified: string
  ) => void;
  open: boolean;
  sections: readonly EmojiSection[];
  skinTone: SkinTone;
}

/**
 * Flatten categories into label and complete grid-row items. The expensive
 * catalog is traversed only after a query, recent list, or column count
 * changes -- never while scrolling.
 */
export function buildEmojiVirtualRows(
  sections: readonly EmojiSection[],
  emojisPerRow: number
): EmojiVirtualRow[] {
  const rows: EmojiVirtualRow[] = [];

  for (const section of sections) {
    if (section.emojis.length === 0) continue;

    rows.push({
      categoryId: section.id,
      height: CATEGORY_LABEL_HEIGHT,
      id: `${section.id}:label`,
      label: section.label,
      type: 'label',
    });

    for (let start = 0; start < section.emojis.length; start += emojisPerRow) {
      rows.push({
        categoryId: section.id,
        emojis: section.emojis.slice(start, start + emojisPerRow),
        height: EMOJI_ROW_HEIGHT,
        id: `${section.id}:row:${start}`,
        type: 'emojis',
      });
    }
  }

  return rows;
}

function useEmojisPerRow(
  scrollElement: React.RefObject<HTMLDivElement | null>
) {
  const [emojisPerRow, setEmojisPerRow] = useState(DEFAULT_EMOJIS_PER_ROW);

  useEffect(() => {
    const element = scrollElement.current;
    if (!element) return;

    let frame = 0;
    const updateColumns = () => {
      frame = 0;
      const availableWidth = Math.max(
        EMOJI_ROW_HEIGHT,
        element.clientWidth - EMOJI_HORIZONTAL_PADDING
      );
      const next = Math.max(1, Math.floor(availableWidth / EMOJI_ROW_HEIGHT));
      setEmojisPerRow((current) => (current === next ? current : next));
    };
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateColumns);
    });

    updateColumns();
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [scrollElement]);

  return emojisPerRow;
}

function emojiButtonFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLButtonElement>('button[data-emoji]');
}

function variationRecordFromButton(button: HTMLButtonElement) {
  const unified = button.dataset.originalUnified;
  if (!unified) return null;

  const record = emojiRecordForUnified(unified);
  return record.variations.length > 0 ? record : null;
}

function variationMenuPosition(anchor: DOMRect) {
  const maxLeft = Math.max(
    VIEWPORT_MARGIN,
    window.innerWidth - VARIATION_MENU_WIDTH - VIEWPORT_MARGIN
  );
  const centeredLeft =
    anchor.left + anchor.width / 2 - VARIATION_MENU_WIDTH / 2;
  const left = Math.min(Math.max(VIEWPORT_MARGIN, centeredLeft), maxLeft);
  const top =
    anchor.top - VARIATION_MENU_HEIGHT - VIEWPORT_MARGIN >= VIEWPORT_MARGIN
      ? anchor.top - VARIATION_MENU_HEIGHT - VIEWPORT_MARGIN
      : anchor.bottom + VIEWPORT_MARGIN;

  return { left, top };
}

interface EmojiButtonProps {
  column: number;
  emoji: string;
  originalUnified: string;
  title: string;
  unified: string;
}

/** A deliberately tiny, memoized button -- all click handling is delegated. */
const EmojiButton = memo(function EmojiButton({
  column,
  emoji,
  originalUnified,
  title,
  unified,
}: EmojiButtonProps) {
  return (
    <button
      aria-label={title}
      className="emoji-picker-emoji"
      data-emoji={emoji}
      data-emoji-column={column}
      data-original-unified={originalUnified}
      data-unified={unified}
      title={title}
      type="button"
    >
      <span aria-hidden="true">{emoji}</span>
    </button>
  );
});

interface EmojiRowProps {
  columns: number;
  row: EmojiVirtualRow;
  skinTone: SkinTone;
}

const EmojiRow = memo(function EmojiRow({
  columns,
  row,
  skinTone,
}: EmojiRowProps) {
  if (row.type === 'label') {
    return (
      <div aria-level={2} className="epr-emoji-category-label" role="heading">
        {row.label}
      </div>
    );
  }

  return (
    <div
      aria-label={row.categoryId}
      className="emoji-picker-grid-row"
      style={{ gridTemplateColumns: `repeat(${columns}, 40px)` }}
    >
      {row.emojis.map((record, column) => {
        const displayed = emojiForSkinTone(record, skinTone);
        return (
          <EmojiButton
            column={column}
            emoji={displayed.emoji}
            key={`${record.unified}:${displayed.unified}`}
            originalUnified={record.baseUnified}
            title={record.names.at(-1) ?? record.emoji}
            unified={displayed.unified}
          />
        );
      })}
    </div>
  );
});

export const EmojiVirtualGrid = forwardRef<
  EmojiVirtualGridHandle,
  EmojiVirtualGridProps
>(function EmojiVirtualGrid(
  { onActiveCategoryChange, onEmojiPick, open, sections, skinTone },
  forwardedRef
) {
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | undefined>(undefined);
  const suppressNextClickRef = useRef(false);
  const longPressTriggeredRef = useRef(false);
  const variationMenuRef = useRef<HTMLDivElement>(null);
  const [variationPicker, setVariationPicker] =
    useState<VariationPickerState | null>(null);
  const emojisPerRow = useEmojisPerRow(scrollElementRef);
  const rows = useMemo(
    () => buildEmojiVirtualRows(sections, emojisPerRow),
    [emojisPerRow, sections]
  );
  const categoryRowIndexes = useMemo(() => {
    const indexes = new Map<EmojiCategoryId, number>();
    rows.forEach((row, index) => {
      if (row.type === 'label') indexes.set(row.categoryId, index);
    });
    return indexes;
  }, [rows]);

  const getScrollElement = useCallback(() => scrollElementRef.current, []);
  const estimateSize = useCallback(
    (index: number) => rows[index]?.height ?? EMOJI_ROW_HEIGHT,
    [rows]
  );
  const getItemKey = useCallback(
    (index: number) => rows[index]?.id ?? index,
    [rows]
  );

  // TanStack keeps imperative functions on its virtualizer instance by
  // design. We retain that stable instance and only rebuild its row metadata
  // when data or responsive columns change.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    directDomUpdates: true,
    directDomUpdatesMode: 'transform',
    estimateSize,
    getItemKey,
    getScrollElement,
    // Four complete rows above and below gives flicker-free fast scrolls
    // while retaining only a small bounded button count in the DOM.
    overscan: 4,
    useAnimationFrameWithResizeObserver: true,
    useCachedMeasurements: true,
  });

  const activeCategory = (() => {
    if (rows.length === 0) return null;

    const offset = rowVirtualizer.scrollOffset ?? 0;
    const row = rowVirtualizer.getVirtualItemForOffset(offset);
    return rows[row?.index ?? 0]?.categoryId ?? null;
  })();

  useEffect(() => {
    onActiveCategoryChange(activeCategory);
  }, [activeCategory, onActiveCategoryChange]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current === undefined) return;

    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = undefined;
  }, []);

  const openVariationPicker = useCallback((button: HTMLButtonElement) => {
    const record = variationRecordFromButton(button);
    if (!record) return false;

    setVariationPicker({
      anchor: button.getBoundingClientRect(),
      record,
    });
    return true;
  }, []);

  useEffect(() => {
    return clearLongPress;
  }, [clearLongPress]);

  useEffect(() => {
    if (open) return;

    clearLongPress();
    suppressNextClickRef.current = false;
    longPressTriggeredRef.current = false;
    const closeFrame = window.requestAnimationFrame(() => {
      setVariationPicker(null);
    });

    return () => window.cancelAnimationFrame(closeFrame);
  }, [clearLongPress, open]);

  useEffect(() => {
    if (!variationPicker) return;

    const focusFrame = window.requestAnimationFrame(() => {
      variationMenuRef.current
        ?.querySelector<HTMLButtonElement>('button')
        ?.focus();
    });
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!variationMenuRef.current?.contains(event.target as Node)) {
        setVariationPicker(null);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [variationPicker]);

  const emojiRowAt = useCallback(
    (startIndex: number, direction: -1 | 1) => {
      for (
        let index = startIndex + direction;
        index >= 0 && index < rows.length;
        index += direction
      ) {
        const row = rows[index];
        if (row?.type === 'emojis') return { index, row };
      }

      return null;
    },
    [rows]
  );

  const emojiButtonAt = useCallback(
    (rowIndex: number, column: number) =>
      scrollElementRef.current?.querySelector<HTMLButtonElement>(
        `[data-emoji-virtual-row][data-index="${rowIndex}"] button[data-emoji-column="${column}"]`
      ) ?? null,
    []
  );

  const queueEmojiButtonAction = useCallback(
    (
      rowIndex: number,
      column: number,
      action: (button: HTMLButtonElement) => void
    ) => {
      const visibleButton = emojiButtonAt(rowIndex, column);
      if (visibleButton) {
        action(visibleButton);
        return;
      }

      rowVirtualizer.scrollToIndex(rowIndex, {
        align: 'auto',
        behavior: 'auto',
      });
      const runAfterVirtualRender = (remainingFrames: number) => {
        const button = emojiButtonAt(rowIndex, column);
        if (button) {
          action(button);
        } else if (remainingFrames > 0) {
          window.requestAnimationFrame(() =>
            runAfterVirtualRender(remainingFrames - 1)
          );
        }
      };
      window.requestAnimationFrame(() => runAfterVirtualRender(1));
    },
    [emojiButtonAt, rowVirtualizer]
  );

  const firstEmojiPosition = useMemo(() => {
    const index = rows.findIndex((row) => row.type === 'emojis');
    return index === -1 ? null : { column: 0, rowIndex: index };
  }, [rows]);

  const focusFirstEmoji = useCallback(() => {
    if (!firstEmojiPosition) return;
    queueEmojiButtonAction(
      firstEmojiPosition.rowIndex,
      firstEmojiPosition.column,
      (button) => button.focus()
    );
  }, [firstEmojiPosition, queueEmojiButtonAction]);

  const pickFirstEmoji = useCallback(() => {
    if (!firstEmojiPosition) return;
    queueEmojiButtonAction(
      firstEmojiPosition.rowIndex,
      firstEmojiPosition.column,
      (button) => button.click()
    );
  }, [firstEmojiPosition, queueEmojiButtonAction]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      focusFirstEmoji,
      pickFirstEmoji,
      scrollToCategory(categoryId) {
        const rowIndex = categoryRowIndexes.get(categoryId);
        if (rowIndex === undefined) return false;

        rowVirtualizer.scrollToIndex(rowIndex, {
          align: 'start',
          behavior: 'auto',
        });
        return true;
      },
      scrollToStart() {
        rowVirtualizer.scrollToIndex(0, {
          align: 'start',
          behavior: 'auto',
        });
      },
    }),
    [categoryRowIndexes, focusFirstEmoji, pickFirstEmoji, rowVirtualizer]
  );

  const handleGridPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      const button = emojiButtonFromTarget(event.target);
      if (!button || !event.currentTarget.contains(button)) return;
      if (!variationRecordFromButton(button)) return;

      clearLongPress();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = undefined;
        if (!button.isConnected || !openVariationPicker(button)) return;

        longPressTriggeredRef.current = true;
        suppressNextClickRef.current = true;
      }, LONG_PRESS_DELAY);
    },
    [clearLongPress, openVariationPicker]
  );

  const handleGridPointerEnd = useCallback(() => {
    clearLongPress();
    if (!longPressTriggeredRef.current) return;

    // A native click follows pointerup. Keep it suppressed until that event
    // has fired, then restore ordinary click selection for the next emoji.
    window.requestAnimationFrame(() => {
      suppressNextClickRef.current = false;
      longPressTriggeredRef.current = false;
    });
  }, [clearLongPress]);

  const handleGridClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (suppressNextClickRef.current) return;

      const button = emojiButtonFromTarget(event.target);

      if (!button || !event.currentTarget.contains(button)) return;

      const emoji = button.dataset.emoji;
      const unified = button.dataset.unified;
      const originalUnified = button.dataset.originalUnified;
      if (!emoji || !unified || !originalUnified) return;

      setVariationPicker(null);
      onEmojiPick(emoji, unified, originalUnified);
    },
    [onEmojiPick]
  );

  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && variationPicker) {
        event.preventDefault();
        setVariationPicker(null);
        return;
      }

      const button = emojiButtonFromTarget(event.target);
      if (!button || !event.currentTarget.contains(button)) return;

      if (event.key === ' ' || event.key === 'Spacebar') {
        if (openVariationPicker(button)) event.preventDefault();
        return;
      }

      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowUp'
      ) {
        return;
      }

      const rowElement = button.closest<HTMLElement>(
        '[data-emoji-virtual-row]'
      );
      const rowIndex = Number(rowElement?.dataset.index);
      const column = Number(button.dataset.emojiColumn);
      const row = rows[rowIndex];
      if (
        !Number.isInteger(rowIndex) ||
        !Number.isInteger(column) ||
        row?.type !== 'emojis'
      ) {
        return;
      }

      let target: { column: number; rowIndex: number } | null = null;
      if (event.key === 'ArrowLeft') {
        if (column > 0) target = { column: column - 1, rowIndex };
        else {
          const previous = emojiRowAt(rowIndex, -1);
          if (previous) {
            target = {
              column: previous.row.emojis.length - 1,
              rowIndex: previous.index,
            };
          }
        }
      } else if (event.key === 'ArrowRight') {
        if (column < row.emojis.length - 1)
          target = { column: column + 1, rowIndex };
        else {
          const next = emojiRowAt(rowIndex, 1);
          if (next) target = { column: 0, rowIndex: next.index };
        }
      } else {
        const adjacent = emojiRowAt(rowIndex, event.key === 'ArrowUp' ? -1 : 1);
        if (adjacent) {
          target = {
            column: Math.min(column, adjacent.row.emojis.length - 1),
            rowIndex: adjacent.index,
          };
        }
      }

      if (!target) return;
      event.preventDefault();
      queueEmojiButtonAction(target.rowIndex, target.column, (nextButton) =>
        nextButton.focus()
      );
    },
    [
      emojiRowAt,
      openVariationPicker,
      queueEmojiButtonAction,
      rows,
      variationPicker,
    ]
  );

  const handleGridScroll = useCallback(() => {
    if (variationPicker) setVariationPicker(null);
  }, [variationPicker]);

  const visibleRows = rowVirtualizer.getVirtualItems();
  const activeLabel =
    sections.find((section) => section.id === activeCategory)?.label ??
    sections[0]?.label;

  return (
    <div
      aria-label="Lista de emojis"
      className="epr-body"
      onClick={handleGridClick}
      onKeyDown={handleGridKeyDown}
      onPointerCancel={handleGridPointerEnd}
      onPointerDown={handleGridPointerDown}
      onPointerUp={handleGridPointerEnd}
      onScroll={handleGridScroll}
      ref={scrollElementRef}
      role="group"
    >
      {rows.length > 0 ? (
        <>
          <div aria-hidden="true" className="emoji-picker-sticky-label">
            {activeLabel}
          </div>
          <div
            className="emoji-picker-virtual-canvas"
            ref={rowVirtualizer.containerRef}
          >
            {visibleRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  data-index={virtualRow.index}
                  data-emoji-virtual-row=""
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    height: virtualRow.size,
                    left: 0,
                    position: 'absolute',
                    top: 0,
                    width: '100%',
                  }}
                >
                  <EmojiRow
                    columns={emojisPerRow}
                    row={row}
                    skinTone={skinTone}
                  />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="emoji-picker-empty">No se encontraron emojis.</p>
      )}
      {open && variationPicker && typeof document !== 'undefined'
        ? createPortal(
            <div
              aria-label={`Variantes de ${variationPicker.record.names.at(-1) ?? variationPicker.record.emoji}`}
              className="emoji-picker-variation-menu"
              ref={variationMenuRef}
              role="menu"
              style={variationMenuPosition(variationPicker.anchor)}
            >
              {[
                variationPicker.record.unified,
                ...variationPicker.record.variations,
              ]
                .slice(0, 6)
                .map((unified) => {
                  const emoji = emojiFromUnified(unified);
                  if (!emoji) return null;

                  return (
                    <button
                      aria-label={`Seleccionar ${variationPicker.record.names.at(-1) ?? emoji}`}
                      key={unified}
                      onClick={() => {
                        setVariationPicker(null);
                        onEmojiPick(
                          emoji,
                          unified,
                          variationPicker.record.baseUnified
                        );
                      }}
                      role="menuitem"
                      title={variationPicker.record.names.at(-1) ?? emoji}
                      type="button"
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </button>
                  );
                })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
});
