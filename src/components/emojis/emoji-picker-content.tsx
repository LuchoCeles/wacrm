'use client';

import type { CSSProperties } from 'react';
import Picker, {
  type CategoryConfig,
  type EmojiClickData,
  type EmojiStyle,
  type SuggestionMode,
  type Theme,
} from 'emoji-picker-react';
import spanishEmojiData from 'emoji-picker-react/dist/data/emojis-es.js';
import type { Categories, EmojiData } from 'emoji-picker-react/dist/types/exposedTypes';
import { registerEmojiUsage } from '@/lib/emojis/usage';

const category = (value: string) => value as Categories;

const emojiData: EmojiData = {
  ...spanishEmojiData,
  categories: {
    ...spanishEmojiData.categories,
    suggested: { category: category('suggested'), name: 'Más usados' },
  },
};

const categories: CategoryConfig[] = [
  { category: category('suggested'), name: 'Más usados' },
  { category: category('smileys_people'), name: 'Caras y personas' },
  { category: category('animals_nature'), name: 'Animales y naturaleza' },
  { category: category('food_drink'), name: 'Comida y bebida' },
  { category: category('activities'), name: 'Actividades' },
  { category: category('travel_places'), name: 'Viajes y lugares' },
  { category: category('objects'), name: 'Objetos' },
  { category: category('symbols'), name: 'Símbolos' },
  { category: category('flags'), name: 'Banderas' },
];

const pickerStyle = {
  '--epr-bg-color': 'var(--popover)',
  '--epr-text-color': 'var(--popover-foreground)',
  '--epr-picker-border-color': 'var(--border)',
  '--epr-search-input-bg-color': 'var(--muted)',
  '--epr-search-input-text-color': 'var(--foreground)',
  '--epr-search-input-placeholder-color': 'var(--muted-foreground)',
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
} as CSSProperties;

interface EmojiPickerContentProps {
  onEmojiSelect: (emoji: string) => void;
}

/** The deferred, full Unicode catalog and Spanish search dataset. */
export function EmojiPickerContent({ onEmojiSelect }: EmojiPickerContentProps) {
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    registerEmojiUsage(emojiData.emoji);
    onEmojiSelect(emojiData.emoji);
  };

  return (
    <Picker
      emojiData={emojiData}
      onEmojiClick={handleEmojiClick}
      theme={'dark' as Theme}
      emojiStyle={'native' as EmojiStyle}
      suggestedEmojisMode={'frequent' as SuggestionMode}
      searchPlaceholder="Buscar emoji"
      previewConfig={{ showPreview: false }}
      skinTonesDisabled={false}
      lazyLoadEmojis
      autoFocusSearch={false}
      width="100%"
      height={390}
      categories={categories}
      style={pickerStyle}
    />
  );
}
