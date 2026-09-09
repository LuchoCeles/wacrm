'use client';

import {
  useCallback,
  useRef,
  type CSSProperties,
  type SyntheticEvent,
} from 'react';
import Picker, {
  Categories,
  EmojiStyle,
  SkinTonePickerLocation,
  SuggestionMode,
  Theme,
  type CategoryConfig,
  type EmojiClickData,
} from 'emoji-picker-react';
import spanishEmojiData from 'emoji-picker-react/dist/data/emojis-es.js';
import type { EmojiData } from 'emoji-picker-react/dist/types/exposedTypes';
import { useTheme } from '@/hooks/use-theme';
import { migratePickerSuggestions } from '@/lib/emojis/usage';
import { getPickerEmojiAssetUrlByUnified } from '@/lib/emojis/unicode';

const PICKER_SUGGESTED_STORAGE_KEY = 'epr_suggested';

// This module is loaded client-side only. Normalize older saved tone variants
// before emoji-picker-react reads its suggested category for the first time.
migratePickerSuggestions();

const emojiData: EmojiData = {
  ...spanishEmojiData,
  categories: {
    ...spanishEmojiData.categories,
    suggested: { category: Categories.SUGGESTED, name: 'Más usados' },
  },
};

const categories: CategoryConfig[] = [
  { category: Categories.SUGGESTED, name: 'Más usados' },
  { category: Categories.SMILEYS_PEOPLE, name: 'Caras y personas' },
  { category: Categories.ANIMALS_NATURE, name: 'Animales y naturaleza' },
  { category: Categories.FOOD_DRINK, name: 'Comida y bebida' },
  { category: Categories.ACTIVITIES, name: 'Actividades' },
  { category: Categories.TRAVEL_PLACES, name: 'Viajes y lugares' },
  { category: Categories.OBJECTS, name: 'Objetos' },
  { category: Categories.SYMBOLS, name: 'Símbolos' },
  { category: Categories.FLAGS, name: 'Banderas' },
];

// Keep the library's own layout and interaction model, while sourcing every
// colour from the CRM's existing design tokens in light and dark mode.
const pickerStyle = {
  '--epr-bg-color': 'var(--popover)',
  '--epr-text-color': 'var(--popover-foreground)',
  '--epr-picker-border-color': 'var(--border)',
  '--epr-search-input-bg-color': 'var(--card)',
  '--epr-search-input-bg-color-active': 'var(--card)',
  '--epr-search-input-text-color': 'var(--foreground)',
  '--epr-search-input-placeholder-color': 'var(--muted-foreground)',
  '--epr-search-border-color': 'var(--border)',
  '--epr-search-border-color-active': 'var(--primary)',
  '--epr-category-label-bg-color': 'var(--popover)',
  '--epr-category-label-text-color': 'var(--muted-foreground)',
  '--epr-hover-bg-color': 'var(--muted)',
  '--epr-focus-bg-color': 'var(--muted)',
  '--epr-highlight-color': 'var(--primary)',
  '--epr-emoji-size': '25px',
  '--epr-emoji-padding': '4px',
  '--epr-picker-border-radius': '12px',
  '--epr-search-input-height': '36px',
  '--epr-category-navigation-button-size': '28px',
  '--epr-skin-tone-picker-menu-color': 'var(--popover)',
  '--epr-skin-tone-outer-border-color': 'var(--border)',
  '--epr-skin-tone-inner-border-color': 'var(--popover)',
} as CSSProperties;

interface EmojiPickerContentProps {
  onEmojiSelect: (emoji: string) => void;
  open: boolean;
}

/**
 * The lazy, full-featured emoji-picker-react implementation. It keeps the
 * library's search, categories, frequent entries, skin-tone UI and internal
 * lazy image loading; only the selected Unicode string leaves this component.
 */
export function EmojiPickerContent({
  onEmojiSelect,
  open,
}: EmojiPickerContentProps) {
  const { mode } = useTheme();
  const suggestionsBeforeClickRef = useRef<string | null>(null);

  // emoji-picker-react increments its own frequency data before calling
  // onEmojiClick. Snapshot it in the capture phase so a draft insertion can
  // be rolled back; the composer writes a new count only after a successful
  // send.
  const rememberSuggestionsBeforeClick = useCallback(() => {
    try {
      suggestionsBeforeClickRef.current = window.localStorage.getItem(
        PICKER_SUGGESTED_STORAGE_KEY
      );
    } catch {
      suggestionsBeforeClickRef.current = null;
    }
  }, []);

  const restoreSuggestionsAfterClick = useCallback(() => {
    try {
      const previous = suggestionsBeforeClickRef.current;
      if (previous === null) {
        window.localStorage.removeItem(PICKER_SUGGESTED_STORAGE_KEY);
      } else {
        window.localStorage.setItem(PICKER_SUGGESTED_STORAGE_KEY, previous);
      }
    } catch {
      // Local storage can be unavailable; composing must still work.
    }
  }, []);

  const handleEmojiClick = useCallback(
    (emoji: EmojiClickData) => {
      restoreSuggestionsAfterClick();
      onEmojiSelect(emoji.emoji);
    },
    [onEmojiSelect, restoreSuggestionsAfterClick]
  );

  const recoverMissingEmojiAsset = useCallback(
    (event: SyntheticEvent<HTMLDivElement>) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;

      const unified = image
        .closest<HTMLElement>('[data-unified]')
        ?.dataset.unified;
      if (!unified || image.dataset.twemojiFallback === 'true') return;

      // Stop emoji-picker-react from removing an emoji before its fallback
      // asset has a chance to load. This is only reached for an unexpected
      // remote asset gap; known gaps are routed directly below.
      event.stopPropagation();
      image.dataset.twemojiFallback = 'true';
      image.src = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${unified.toLowerCase()}.png`;
    },
    []
  );

  return (
    <div
      onKeyDownCapture={rememberSuggestionsBeforeClick}
      onMouseDownCapture={rememberSuggestionsBeforeClick}
      onTouchStartCapture={rememberSuggestionsBeforeClick}
      onErrorCapture={recoverMissingEmojiAsset}
    >
      <Picker
        autoFocusSearch={false}
        categories={categories}
        className="emoji-picker scrollbar-emoji"
        emojiData={emojiData}
        emojiStyle={EmojiStyle.APPLE}
        getEmojiUrl={getPickerEmojiAssetUrlByUnified}
        // Leave room for the inbox header, the composer, and the gap above
        // its trigger. Otherwise a 500px picker can overlap both controls
        // in a short viewport.
        height="min(500px, calc(100dvh - 152px))"
        onEmojiClick={handleEmojiClick}
        open={open}
        previewConfig={{ showPreview: false }}
        searchClearButtonLabel="Limpiar búsqueda"
        searchPlaceholder="Buscar emoji"
        skinTonePickerLocation={SkinTonePickerLocation.SEARCH}
        skinTonesDisabled={false}
        style={pickerStyle}
        suggestedEmojisMode={SuggestionMode.FREQUENT}
        theme={mode === 'dark' ? Theme.DARK : Theme.LIGHT}
        width="100%"
      />
    </div>
  );
}
