/**
 * Browser-local usage data for the emoji picker. Emoji strings are always
 * used as keys as-is: this deliberately preserves variation selectors and
 * zero-width joiners in compound Unicode emojis.
 */
export interface EmojiUsage {
  count: number;
  lastUsed: number;
}

export type EmojiUsageMap = Record<string, EmojiUsage>;

const STORAGE_KEY = 'wacrm:emoji-usage';
const MAX_FREQUENT_EMOJIS = 32;

export const DEFAULT_FREQUENT_EMOJIS = [
  '😂',
  '❤️',
  '👍',
  '🙏',
  '🔥',
  '😊',
  '🎉',
  '😭',
  '😍',
  '👏',
  '✅',
  '👋',
  '😅',
  '😁',
  '🤔',
  '😢',
  '😎',
  '💪',
  '🤝',
  '✨',
  '🚀',
  '💯',
  '🎂',
  '🙌',
];

function readUsage(): EmojiUsageMap {
  if (typeof window === 'undefined') return {};

  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '{}'
    );

    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    return Object.fromEntries(
      Object.entries(value).filter(
        ([, usage]) =>
          usage &&
          typeof usage === 'object' &&
          typeof (usage as EmojiUsage).count === 'number' &&
          typeof (usage as EmojiUsage).lastUsed === 'number'
      )
    ) as EmojiUsageMap;
  } catch {
    return {};
  }
}

function writeUsage(usage: EmojiUsageMap): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Private browsing or a full quota should never block composing a message.
  }
}

export function getFrequentlyUsedEmojis(limit = MAX_FREQUENT_EMOJIS): string[] {
  const usage = readUsage();
  const frequentlyUsed = Object.entries(usage)
    .sort(
      ([, left], [, right]) =>
        right.count - left.count || right.lastUsed - left.lastUsed
    )
    .slice(0, limit)
    .map(([emoji]) => emoji);

  return frequentlyUsed.length > 0
    ? frequentlyUsed
    : DEFAULT_FREQUENT_EMOJIS.slice(0, limit);
}

export function registerEmojiUsage(emoji: string): void {
  if (!emoji) return;

  const usage = readUsage();
  const current = usage[emoji];
  usage[emoji] = {
    count: (current?.count ?? 0) + 1,
    lastUsed: Date.now(),
  };
  writeUsage(usage);
}

export function clearEmojiUsage(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See writeUsage: this is a local preference, so failures are harmless.
  }
}
