import type { Conversation, Contact, Tag } from '@/types';

/**
 * Server-backed Inbox partition. Kept separate from the existing status
 * filter because the two filters compose rather than replace one another.
 */
export type ConversationAssignmentFilter = 'all' | 'mine' | 'unassigned';

export const CONVERSATION_ASSIGNMENT_FILTERS = [
  'all',
  'mine',
  'unassigned',
] as const satisfies readonly ConversationAssignmentFilter[];

export interface ConversationAssignmentCounts {
  all: number;
  mine: number;
  unassigned: number;
}

export const EMPTY_CONVERSATION_ASSIGNMENT_COUNTS: ConversationAssignmentCounts =
  {
    all: 0,
    mine: 0,
    unassigned: 0,
  };

/**
 * Mirrors the database assignment partition for local realtime updates only.
 * Fetches always go through the authenticated RPC; this helper prevents an
 * out-of-scope Realtime row from briefly appearing before the next resync.
 */
export function matchesConversationAssignmentFilter(
  conversation: Conversation,
  filter: ConversationAssignmentFilter,
  currentUserId: string | null | undefined
): boolean {
  switch (filter) {
    case 'mine':
      return Boolean(
        currentUserId && conversation.assigned_agent_id === currentUserId
      );
    case 'unassigned':
      return conversation.assigned_agent_id == null;
    case 'all':
      return true;
  }
}

/**
 * Conversation select that embeds the contact plus its tags, so the Inbox
 * can filter conversations by contact tag without a second round-trip.
 * `contact_tags(tags(*))` returns the join rows; {@link normalizeConversation}
 * flattens them onto `contact.tags`.
 */
export const CONVERSATION_SELECT =
  '*, contact:contacts(*, contact_tags(tags(*)))';

/** Raw shape returned by {@link CONVERSATION_SELECT} before flattening. */
type RawContact = Contact & { contact_tags?: { tags: Tag | null }[] };
type RawConversation = Omit<Conversation, 'contact'> & {
  contact?: RawContact | null;
};

/**
 * Flatten the embedded `contact_tags(tags(*))` join into `contact.tags`.
 * Safe to call on rows fetched with {@link CONVERSATION_SELECT}; a row with
 * no contact (e.g. a freshly-inserted conversation) passes through untouched.
 */
export function normalizeConversation(raw: RawConversation): Conversation {
  const rawContact = raw.contact;
  if (!rawContact) return raw as Conversation;

  const { contact_tags, ...contact } = rawContact;
  return {
    ...raw,
    contact: {
      ...contact,
      tags: (contact_tags ?? [])
        .map((ct) => ct.tags)
        .filter((t): t is Tag => t != null),
    },
  };
}

export function normalizeConversations(
  rows: RawConversation[]
): Conversation[] {
  return rows.map(normalizeConversation);
}

export interface ContactFilters {
  /** Tag ids; a conversation matches if its contact has ANY of them (OR). */
  tagIds: string[];
  /** Exact company match, or null for no company filter. */
  company: string | null;
}

/**
 * Whether a conversation passes the contact-based Inbox filters (issue #272).
 * Empty `tagIds` and null `company` are no-ops, so the default (no filters)
 * always matches. Tags use OR logic, consistent with Broadcast audiences.
 */
export function matchesContactFilters(
  conversation: Conversation,
  { tagIds, company }: ContactFilters
): boolean {
  if (tagIds.length > 0) {
    const contactTagIds = conversation.contact?.tags ?? [];
    if (!contactTagIds.some((t) => tagIds.includes(t.id))) return false;
  }

  if (company !== null && conversation.contact?.company?.trim() !== company) {
    return false;
  }

  return true;
}
