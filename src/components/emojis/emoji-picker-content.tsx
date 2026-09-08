'use client';

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Flag,
  Heart,
  History,
  Lightbulb,
  PawPrint,
  Plane,
  Search,
  Smile,
  Trophy,
  Utensils,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  EMOJIS_BY_CATEGORY,
  emojiFromUnified,
  filterEmojiRecords,
  normalizeEmojiSearch,
  SKIN_TONES,
  type EmojiCategoryId,
  type EmojiSection,
  type SkinTone,
} from './data/emoji-catalog';
import {
  getRecentEmojiRecords,
  registerRecentEmoji,
} from './data/emoji-recents';
import {
  EmojiVirtualGrid,
  type EmojiVirtualGridHandle,
} from './emoji-virtual-grid';

interface EmojiPickerContentProps {
  onEmojiSelect: (emoji: string) => void;
  open: boolean;
}

interface CategoryDefinition {
  id: EmojiCategoryId;
  icon: LucideIcon;
  label: string;
}

// Static configuration deliberately lives outside React. It never changes on
// scroll, search, theme updates, or composer text changes.
const CATEGORY_DEFINITIONS: readonly CategoryDefinition[] = [
  { id: 'suggested', label: 'Más usados', icon: History },
  { id: 'smileys_people', label: 'Caras y personas', icon: Smile },
  { id: 'animals_nature', label: 'Animales y naturaleza', icon: PawPrint },
  { id: 'food_drink', label: 'Comida y bebida', icon: Utensils },
  { id: 'activities', label: 'Actividades', icon: Trophy },
  { id: 'travel_places', label: 'Viajes y lugares', icon: Plane },
  { id: 'objects', label: 'Objetos', icon: Lightbulb },
  { id: 'symbols', label: 'Símbolos', icon: Heart },
  { id: 'flags', label: 'Banderas', icon: Flag },
];

const SKIN_TONE_LABELS: Record<SkinTone, string> = {
  neutral: 'Tono de piel predeterminado',
  '1f3fb': 'Tono de piel claro',
  '1f3fc': 'Tono de piel claro medio',
  '1f3fd': 'Tono de piel medio',
  '1f3fe': 'Tono de piel oscuro medio',
  '1f3ff': 'Tono de piel oscuro',
};

function skinTonePreview(skinTone: SkinTone): string {
  return skinTone === 'neutral' ? '👍' : emojiFromUnified(`1f44d-${skinTone}`);
}

interface EmojiCategoryNavProps {
  activeCategory: EmojiCategoryId | null;
  onCategorySelect: (categoryId: EmojiCategoryId) => void;
}

const EmojiCategoryNav = memo(function EmojiCategoryNav({
  activeCategory,
  onCategorySelect,
}: EmojiCategoryNavProps) {
  return (
    <div
      aria-label="Categorías de emojis"
      className="epr-category-nav"
      role="toolbar"
    >
      {CATEGORY_DEFINITIONS.map(({ icon: Icon, id, label }) => (
        <button
          aria-label={label}
          aria-pressed={activeCategory === id}
          className={`epr-cat-btn${activeCategory === id ? 'epr-active' : ''}`}
          key={id}
          onClick={() => onCategorySelect(id)}
          title={label}
          type="button"
        >
          <Icon
            aria-hidden="true"
            className="emoji-picker-category-icon"
            size={18}
            strokeWidth={1.8}
          />
        </button>
      ))}
    </div>
  );
});

interface SkinTonePickerProps {
  onSkinToneChange: (skinTone: SkinTone) => void;
  skinTone: SkinTone;
}

const SkinTonePicker = memo(function SkinTonePicker({
  onSkinToneChange,
  skinTone,
}: SkinTonePickerProps) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  return (
    <div className="emoji-picker-skin-tone" ref={pickerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Elegir tono de piel"
        className="emoji-picker-skin-tone-trigger"
        onClick={() => setOpen((current) => !current)}
        title="Elegir tono de piel"
        type="button"
      >
        <span aria-hidden="true">{skinTonePreview(skinTone)}</span>
      </button>
      {open ? (
        <div
          aria-label="Tonos de piel"
          className="emoji-picker-skin-tone-menu"
          role="listbox"
        >
          {SKIN_TONES.map((tone) => (
            <button
              aria-label={SKIN_TONE_LABELS[tone]}
              aria-selected={skinTone === tone}
              className={skinTone === tone ? 'is-selected' : undefined}
              key={tone}
              onClick={() => {
                onSkinToneChange(tone);
                setOpen(false);
              }}
              role="option"
              title={SKIN_TONE_LABELS[tone]}
              type="button"
            >
              <span aria-hidden="true">{skinTonePreview(tone)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});

interface EmojiSearchProps {
  onFocusFirstEmoji: () => void;
  onPickFirstEmoji: () => void;
  onQueryChange: (query: string) => void;
  query: string;
}

const EmojiSearch = memo(function EmojiSearch({
  onFocusFirstEmoji,
  onPickFirstEmoji,
  onQueryChange,
  query,
}: EmojiSearchProps) {
  return (
    <div className="epr-search-container">
      <Search
        aria-hidden="true"
        className="emoji-picker-search-icon"
        size={17}
      />
      <input
        aria-label="Buscar emoji"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query) {
            event.preventDefault();
            onQueryChange('');
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            onFocusFirstEmoji();
          } else if (event.key === 'Enter') {
            event.preventDefault();
            onPickFirstEmoji();
          }
        }}
        placeholder="Buscar emoji"
        type="search"
        value={query}
      />
      {query ? (
        <button
          aria-label="Limpiar búsqueda"
          className="emoji-picker-clear-search"
          onClick={() => onQueryChange('')}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      ) : null}
    </div>
  );
});

function buildEmojiSections(
  normalizedQuery: string,
  recentEmojis: EmojiSection['emojis']
): EmojiSection[] {
  return CATEGORY_DEFINITIONS.map(({ id, label }) => {
    const emojis = id === 'suggested' ? recentEmojis : EMOJIS_BY_CATEGORY[id];
    return {
      id,
      label,
      emojis: filterEmojiRecords(emojis, normalizedQuery),
    };
  }).filter((section) => section.emojis.length > 0);
}

/**
 * Deferred, row-virtualized implementation. It replaces the third-party
 * renderer but keeps its full Spanish Unicode data, categories and stored
 * recent values. The visible DOM remains bounded regardless of catalog size.
 */
export function EmojiPickerContent({
  onEmojiSelect,
  open,
}: EmojiPickerContentProps) {
  const gridRef = useRef<EmojiVirtualGridHandle>(null);
  const [activeCategory, setActiveCategory] = useState<EmojiCategoryId | null>(
    'suggested'
  );
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const previousDeferredQuery = useRef(deferredQuery);
  const [recentEmojis, setRecentEmojis] = useState<EmojiSection['emojis']>(
    getRecentEmojiRecords
  );
  const [skinTone, setSkinTone] = useState<SkinTone>('neutral');

  const sections = useMemo(
    () => buildEmojiSections(normalizeEmojiSearch(deferredQuery), recentEmojis),
    [deferredQuery, recentEmojis]
  );

  // Search results should always begin at the first matching row. Keeping
  // this imperative avoids coupling search state to scroll events or walking
  // rendered DOM nodes to find the first category.
  useEffect(() => {
    if (previousDeferredQuery.current === deferredQuery) return;

    previousDeferredQuery.current = deferredQuery;
    gridRef.current?.scrollToStart();
  }, [deferredQuery]);

  const handleCategorySelect = useCallback((categoryId: EmojiCategoryId) => {
    gridRef.current?.scrollToCategory(categoryId);
  }, []);

  const focusFirstEmoji = useCallback(() => {
    gridRef.current?.focusFirstEmoji();
  }, []);

  const pickFirstEmoji = useCallback(() => {
    gridRef.current?.pickFirstEmoji();
  }, []);

  const handleActiveCategoryChange = useCallback(
    (categoryId: EmojiCategoryId | null) => {
      setActiveCategory((current) =>
        current === categoryId ? current : categoryId
      );
    },
    []
  );

  const handleEmojiPick = useCallback(
    (emoji: string, unified: string, originalUnified: string) => {
      // The browser storage write is deliberately done before the composing
      // callback; it is small and lets the visible recent row update once.
      registerRecentEmoji(emoji, unified, originalUnified);
      setRecentEmojis(getRecentEmojiRecords());
      onEmojiSelect(emoji);
    },
    [onEmojiSelect]
  );

  return (
    <section
      aria-label="Selector de emojis"
      className="emoji-picker scrollbar-emoji"
    >
      <header className="epr-header">
        <div className="emoji-picker-search-row">
          <EmojiSearch
            onFocusFirstEmoji={focusFirstEmoji}
            onPickFirstEmoji={pickFirstEmoji}
            onQueryChange={setQuery}
            query={query}
          />
          <SkinTonePicker
            key={open ? 'picker-open' : 'picker-closed'}
            onSkinToneChange={setSkinTone}
            skinTone={skinTone}
          />
        </div>
        <EmojiCategoryNav
          activeCategory={activeCategory}
          onCategorySelect={handleCategorySelect}
        />
      </header>
      <EmojiVirtualGrid
        onActiveCategoryChange={handleActiveCategoryChange}
        onEmojiPick={handleEmojiPick}
        open={open}
        ref={gridRef}
        sections={sections}
        skinTone={skinTone}
      />
    </section>
  );
}
