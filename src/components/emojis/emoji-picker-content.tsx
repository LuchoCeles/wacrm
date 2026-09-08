'use client';

import { useCallback, type CSSProperties } from 'react';
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
import { registerEmojiUsage } from '@/lib/emojis/usage';
import { getAppleEmojiAssetUrlByUnified } from '@/lib/emojis/unicode';

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

  const handleEmojiClick = useCallback(
    (emoji: EmojiClickData) => {
      // Both stores use the complete Unicode sequence as their key. This
      // makes 👍 and 👍🏽 different frequent entries without serializing an
      // asset URL or a shortcode into composer state.
      registerEmojiUsage(emoji.emoji);
      onEmojiSelect(emoji.emoji);
    },
    [onEmojiSelect]
  );

  return (
    <Picker
      autoFocusSearch={false}
      categories={categories}
      className="emoji-picker scrollbar-emoji"
      emojiData={emojiData}
      emojiStyle={EmojiStyle.APPLE}
      getEmojiUrl={getAppleEmojiAssetUrlByUnified}
      height="min(500px, calc(100dvh - 96px))"
      lazyLoadEmojis
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
  );
}
