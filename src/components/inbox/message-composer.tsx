'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import {
  Send,
  LayoutTemplate,
  Paperclip,
  Image as ImageIcon,
  Video,
  FileText,
  Mic,
  X,
  Loader2,
  Sparkles,
  Plus,
  MessageSquareDashed,
  Zap,
  Smile,
  ContactRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GatedButton } from '@/components/ui/gated-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCan } from '@/hooks/use-can';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  uploadAccountMedia,
  deleteAccountMedia,
  MEDIA_MAX_BYTES_BY_KIND,
} from '@/lib/storage/upload-media';
import { ReplyQuote } from './reply-quote';
import { useTranslations } from 'next-intl';
import {
  InteractiveBuilder,
  blankButtonsPayload,
} from '@/components/interactive/interactive-builder';
import { validateInteractivePayload } from '@/lib/whatsapp/interactive';
import type { InteractiveMessagePayload, QuickReply } from '@/types';
import type { Contact, SharedContactPayload } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { QuickReplyPicker } from './quick-reply-picker';
import {
  EmojiPicker,
  preloadEmojiPicker,
} from '@/components/emojis/emoji-picker';
import { insertEmojiAtSelection } from '@/lib/emojis/insert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { AudioRecordingControls } from './audio-recording-controls';

/** Media content types an agent can send from the composer. */
export type ComposerMediaKind = 'image' | 'video' | 'document' | 'audio';

/** Supabase Storage bucket holding agent-sent chat attachments (migration 023). */
export const CHAT_MEDIA_BUCKET = 'chat-media';

/** Meta caps media captions at 1024 chars. Enforced here and in the send route. */
export const MEDIA_CAPTION_MAX = 1024;

/** Hard cap on a single voice recording so it can't blow the upload/
 *  transcode limits — auto-stops the recorder when reached. */
const MAX_RECORDING_SECONDS = 5 * 60;
const MAX_COMPOSER_LINES = 7;

export interface SendMediaPayload {
  kind: ComposerMediaKind;
  /** Public chat-media URL Meta fetches at send time. */
  mediaUrl: string;
  /** Storage object path — lets the caller GC the object if the send fails. */
  path: string;
  /** Optional caption (image/video/document only). */
  caption?: string;
  /** Original file name — surfaced to the recipient for documents. */
  filename?: string;
  replyToId?: string;
}

export interface SendContactPayload {
  contact: SharedContactPayload;
  replyToId?: string;
}

interface ReplyDraft {
  /** Internal UUID of the message being replied to — sent back through onSend. */
  id: string;
  authorLabel: string;
  preview: string;
}

// Mirrors the chat-media bucket's allowed_mime_types (migration 023) for
// the file picker so unsupported files are rejected before upload rather
// than failing with a confusing Storage error. Audio has no picker — it's
// captured via the recorder.
const PICKER_ACCEPT: Record<'image' | 'video' | 'document', string> = {
  image: 'image/png,image/jpeg,image/webp',
  video: 'video/mp4,video/3gpp',
  document:
    'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain',
};

interface MediaDraft {
  kind: ComposerMediaKind;
  mediaUrl: string;
  /** Storage path — used to GC the object if the draft is discarded. */
  path: string;
  filename: string;
  caption: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (text: string, replyToId?: string) => void;
  onSendMedia: (payload: SendMediaPayload) => void;
  onSendContact: (payload: SendContactPayload) => void;
  onSendInteractive: (
    payload: InteractiveMessagePayload,
    replyToId?: string
  ) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
}

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onSendMedia,
  onSendContact,
  onSendInteractive,
  onOpenTemplates,
  replyTo,
  onClearReply,
}: MessageComposerProps) {
  const t = useTranslations('Inbox.composer');

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Interactive-message builder dialog + quick-reply picker.
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const [interactivePayload, setInteractivePayload] =
    useState<InteractiveMessagePayload>(blankButtonsPayload);
  const [savingQuickReply, setSavingQuickReply] = useState(false);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Media attachment state. `draft` holds an uploaded-but-not-yet-sent
  // attachment; `busy` covers the upload/transcode window.
  const [draft, setDraft] = useState<MediaDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  // Mirror of `draft` for the unmount cleanup, which can't read render
  // state. Kept in sync below so navigating away with a staged-but-unsent
  // attachment GCs the orphaned object.
  const draftRef = useRef<MediaDraft | null>(null);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Best-effort GC of a staged object the user never sent. Fire-and-forget.
  const removeStaged = useCallback((path: string | undefined) => {
    if (!path) return;
    void deleteAccountMedia(CHAT_MEDIA_BUCKET, path).catch(() => {});
  }, []);

  // Viewers (read-only role) can browse the inbox but never send.
  // For solo users this is always true — single-owner accounts pass
  // every capability — so the disabled branch is a no-op there.
  const canSend = useCan('send-messages');
  const readOnly = !canSend;
  // Media (like free-form text) is only allowed inside the 24h window.
  const inputsDisabled = readOnly || sessionExpired;

  // This intentionally sends through the same storage + message callback as
  // every other attachment; audio just bypasses the generic draft card so it
  // can retain the richer recorder preview until the user presses Send.
  const sendRecordedAudio = useCallback(
    async (file: File) => {
      if (inputsDisabled) {
        throw new Error('Messages cannot be sent in this conversation.');
      }
      if (file.size > MEDIA_MAX_BYTES_BY_KIND.audio) {
        throw new Error('Recording is too long (over 16 MB).');
      }

      setBusy(true);
      try {
        const { publicUrl, path } = await uploadAccountMedia(
          CHAT_MEDIA_BUCKET,
          file
        );
        onSendMedia({
          kind: 'audio',
          mediaUrl: publicUrl,
          path,
          replyToId: replyTo?.id,
        });
        onClearReply?.();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Upload failed.';
        toast.error(message);
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [inputsDisabled, onClearReply, onSendMedia, replyTo?.id]
  );

  const audioRecorder = useAudioRecorder({
    maxDurationSeconds: MAX_RECORDING_SECONDS,
    onSend: sendRecordedAudio,
    onError: (message) => toast.error(message),
  });
  const cancelAudioRecording = audioRecorder.cancel;

  useEffect(() => {
    if (!contactPickerOpen) return;
    let cancelled = false;
    setContactsLoading(true);
    void createClient()
      .from('contacts')
      .select(
        'id, name, phone, email, company, user_id, account_id, created_at, updated_at'
      )
      .order('name', { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (!cancelled) {
          if (error) toast.error('Could not load contacts.');
          setContacts((data ?? []) as Contact[]);
          setContactsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contactPickerOpen]);

  // GC a staged-but-unsent attachment on unmount. The audio-recorder hook
  // separately closes its recorder, mic tracks, AudioContext and animation.
  // attachment so it doesn't orphan in the bucket.
  useEffect(() => {
    return () => {
      removeStaged(draftRef.current?.path);
    };
  }, [removeStaged]);

  // Switching the selected conversation discards an in-progress take. This
  // avoids a voice note being attached to the wrong customer after navigation.
  useEffect(() => {
    cancelAudioRecording();
  }, [cancelAudioRecording, conversationId]);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // Calculate from the rendered font metrics instead of a fixed pixel
    // value. This keeps the field capped at exactly seven visible lines even
    // if the user changes the browser's text scale.
    const styles = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
    const verticalInsets =
      Number.parseFloat(styles.paddingTop) +
      Number.parseFloat(styles.paddingBottom) +
      Number.parseFloat(styles.borderTopWidth) +
      Number.parseFloat(styles.borderBottomWidth);
    const maxHeight = lineHeight * MAX_COMPOSER_LINES + verticalInsets;
    // Subsequent content remains accessible through its own vertical
    // scrollbar, without expanding the composer past seven lines.
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;

    setSending(true);
    try {
      onSend(trimmed, replyTo?.id);
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend, replyTo?.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? text.length;
      const end = textarea?.selectionEnd ?? text.length;
      const { value: nextText, cursorPosition } = insertEmojiAtSelection(
        text,
        emoji,
        start,
        end
      );

      setText(nextText);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(cursorPosition, cursorPosition);
        adjustHeight();
      });
    },
    [adjustHeight, text]
  );

  // Ask the AI assistant for a suggested reply and drop it into the
  // composer for the agent to edit + send. Read-only server-side —
  // nothing is sent until the agent hits Send.
  const handleDraft = useCallback(async () => {
    if (drafting) return;
    setDrafting(true);
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'ai_not_configured') {
          toast.error(
            "AI isn't set up yet — enable it in Settings → AI Assistant."
          );
        } else {
          toast.error(data.error ?? "Couldn't draft a reply.");
        }
        return;
      }
      const draftText = typeof data.draft === 'string' ? data.draft.trim() : '';
      if (!draftText) {
        toast.error("The assistant didn't return a reply.");
        return;
      }
      setText(draftText);
      // Let the textarea grow to fit and drop the cursor at the end so
      // the agent can tweak immediately.
      requestAnimationFrame(() => {
        adjustHeight();
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    } catch {
      toast.error("Couldn't reach the AI assistant.");
    } finally {
      setDrafting(false);
    }
  }, [drafting, conversationId, adjustHeight]);

  // ---- Interactive message + quick replies --------------------------

  const openInteractiveBuilder = useCallback(
    (seed?: InteractiveMessagePayload) => {
      setInteractivePayload(seed ?? blankButtonsPayload());
      setInteractiveOpen(true);
    },
    []
  );

  const sendInteractive = useCallback(() => {
    const result = validateInteractivePayload(interactivePayload);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onSendInteractive(interactivePayload, replyTo?.id);
    setInteractiveOpen(false);
    onClearReply?.();
  }, [interactivePayload, onSendInteractive, replyTo?.id, onClearReply]);

  // Persist the current builder payload as a reusable interactive snippet.
  const saveAsQuickReply = useCallback(async () => {
    const result = validateInteractivePayload(interactivePayload);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const title = window.prompt(t('quickReplyNamePrompt'))?.trim();
    if (!title) return;
    setSavingQuickReply(true);
    try {
      const res = await fetch('/api/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          kind: 'interactive',
          interactive_payload: interactivePayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? t('quickReplySaveError'));
        return;
      }
      toast.success(t('quickReplySaved'));
    } catch {
      toast.error(t('quickReplySaveError'));
    } finally {
      setSavingQuickReply(false);
    }
  }, [interactivePayload, t]);

  // A picked quick reply: text fills the composer; interactive opens the
  // builder pre-filled so the agent can tweak before sending.
  const handlePickQuickReply = useCallback(
    (qr: QuickReply) => {
      setQuickReplyOpen(false);
      if (qr.kind === 'interactive' && qr.interactive_payload) {
        openInteractiveBuilder(qr.interactive_payload);
        return;
      }
      const body = qr.content_text ?? '';
      // Separate the snippet from any existing draft with a newline so the
      // words don't run together ("Thanks" + "we'll…" → "Thankswe'll…").
      setText((prev) =>
        prev && !/\s$/.test(prev) ? `${prev}\n${body}` : `${prev}${body}`
      );
      requestAnimationFrame(() => {
        adjustHeight();
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    },
    [openInteractiveBuilder, adjustHeight]
  );

  // Upload a captured file to chat-media and stage it as a draft.
  const stageUpload = useCallback(
    async (kind: ComposerMediaKind, file: File) => {
      // Per-kind ceiling mirrors Meta's caps (image 5 MB, etc.) so we
      // reject before upload rather than orphaning an object that Meta
      // would then refuse at send.
      const max = MEDIA_MAX_BYTES_BY_KIND[kind];
      if (file.size > max) {
        toast.error(
          `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — ${kind} limit is ${Math.round(
            max / 1024 / 1024
          )} MB.`
        );
        return;
      }
      setBusy(true);
      try {
        const { publicUrl, path } = await uploadAccountMedia(
          CHAT_MEDIA_BUCKET,
          file
        );
        // Replacing an existing draft? GC the previous object first.
        removeStaged(draftRef.current?.path);
        setDraft({
          kind,
          mediaUrl: publicUrl,
          path,
          filename: file.name,
          caption: '',
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setBusy(false);
      }
    },
    [removeStaged]
  );

  const handlePicked = useCallback(
    (kind: 'image' | 'video' | 'document', file: File | undefined) => {
      if (file) void stageUpload(kind, file);
    },
    [stageUpload]
  );

  // ---- Voice recording (client-side Ogg/Opus, no server transcode) ---

  const startRecording = useCallback(() => {
    if (inputsDisabled || busy || audioRecorder.status !== 'idle') return;
    void audioRecorder.start();
  }, [audioRecorder, busy, inputsDisabled]);

  // ---- Draft send / discard -----------------------------------------

  const sendDraft = useCallback(() => {
    if (!draft || busy) return;
    onSendMedia({
      kind: draft.kind,
      mediaUrl: draft.mediaUrl,
      path: draft.path,
      // Audio takes no caption (Meta rejects it). Everything else: the
      // trimmed caption, or undefined when blank.
      caption:
        draft.kind === 'audio' ? undefined : draft.caption.trim() || undefined,
      filename: draft.kind === 'document' ? draft.filename : undefined,
      replyToId: replyTo?.id,
    });
    // The object is now owned by the sent message — clear without GC.
    setDraft(null);
    onClearReply?.();
  }, [draft, busy, onSendMedia, replyTo?.id, onClearReply]);

  // Discard GCs the staged object — it was uploaded but never sent.
  const discardDraft = useCallback(() => {
    removeStaged(draft?.path);
    setDraft(null);
  }, [draft?.path, removeStaged]);

  const setCaption = useCallback((caption: string) => {
    setDraft((d) => (d ? { ...d, caption } : d));
  }, []);

  const shareContact = useCallback(
    (contact: Contact) => {
      onSendContact({
        contact: {
          id: contact.id,
          name: contact.name?.trim() || contact.phone,
          phone: contact.phone,
          email: contact.email,
          company: contact.company,
        },
        replyToId: replyTo?.id,
      });
      setContactPickerOpen(false);
      setContactSearch('');
    },
    [onSendContact, replyTo?.id]
  );

  const visibleContacts = contacts.filter((contact) => {
    const query = contactSearch.trim().toLocaleLowerCase();
    if (!query) return true;
    return [contact.name, contact.phone, contact.email, contact.company]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(query));
  });

  // ---- Render --------------------------------------------------------

  return (
    <div
      className={cn(
        'border-border/70 bg-card/95 supports-[backdrop-filter]:bg-card/85 relative z-10 mx-2 mb-2 border p-1.5 shadow-sm shadow-black/5 backdrop-blur sm:mb-2.5',
        replyTo ? 'rounded-[20px]' : 'rounded-full'
      )}
    >
      {replyTo && (
        <div className="mb-2 px-1 pt-1">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}
      {sessionExpired && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-400">{t('sessionExpiredHint')}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-400 hover:text-amber-300"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            {t('templates')}
          </Button>
        </div>
      )}

      {/* Hidden file inputs driven by the attach menu. */}
      <input
        ref={imageInputRef}
        type="file"
        accept={PICKER_ACCEPT.image}
        className="hidden"
        onChange={(e) => {
          handlePicked('image', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={PICKER_ACCEPT.video}
        className="hidden"
        onChange={(e) => {
          handlePicked('video', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept={PICKER_ACCEPT.document}
        className="hidden"
        onChange={(e) => {
          handlePicked('document', e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {draft ? (
        <MediaDraftPreview
          draft={draft}
          busy={busy}
          readOnly={readOnly}
          onCaptionChange={setCaption}
          onDiscard={discardDraft}
          onSend={sendDraft}
          t={t}
        />
      ) : audioRecorder.status !== 'idle' ? (
        <AudioRecordingControls
          durationSeconds={audioRecorder.durationSeconds}
          labels={{
            cancel: t('cancelRecording'),
            pause: t('pauseRecording'),
            pausePlayback: t('pausePlayback'),
            play: t('playAudio'),
            resume: t('resumeRecording'),
            seek: t('seekAudio'),
            send: t('sendAudio'),
          }}
          onCancel={audioRecorder.cancel}
          onPause={audioRecorder.pause}
          onPlaybackError={() => toast.error(t('voicePlaybackError'))}
          onResume={audioRecorder.resume}
          onSend={audioRecorder.send}
          previewUrl={audioRecorder.previewUrl}
          status={audioRecorder.status}
          waveform={audioRecorder.waveform}
        />
      ) : (
        <div className="flex min-h-11 items-center gap-1 sm:gap-1.5">
          <div className="flex shrink-0 items-center gap-0 sm:gap-0.5">
            {/* Attach menu — photo / video / document / voice. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={inputsDisabled || busy}
                title={
                  readOnly
                    ? t('readOnlyTitle')
                    : inputsDisabled
                      ? undefined
                      : t('attachMedia')
                }
                className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="border-border bg-popover"
              >
                <DropdownMenuItem
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  {t('photo')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Video className="mr-2 h-4 w-4" />
                  {t('video')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => documentInputRef.current?.click()}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {t('document')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setContactPickerOpen(true)}>
                  <ContactRound className="mr-2 h-4 w-4" />
                  {t('contact')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* + menu — interactive messages + quick replies. Gated on the
              24h window like free-form text (interactive requires it). */}
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={inputsDisabled}
                title={
                  readOnly
                    ? t('readOnlyTitle')
                    : inputsDisabled
                      ? undefined
                      : t('moreActions')
                }
                className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="border-border bg-popover"
              >
                <DropdownMenuItem onClick={() => openInteractiveBuilder()}>
                  <MessageSquareDashed className="mr-2 h-4 w-4" />
                  {t('interactiveMessage')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuickReplyOpen(true)}>
                  <Zap className="mr-2 h-4 w-4" />
                  {t('quickReplies')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <GatedButton
              variant="ghost"
              size="sm"
              canAct={!readOnly}
              gateReason="send messages"
              title={readOnly ? undefined : t('sendTemplate')}
              className="text-muted-foreground hover:bg-muted hover:text-foreground h-9 w-9 shrink-0 rounded-full p-0"
              onClick={onOpenTemplates}
            >
              <LayoutTemplate className="h-4 w-4" />
            </GatedButton>

            <GatedButton
              variant="ghost"
              size="sm"
              canAct={!readOnly}
              gateReason="send messages"
              disabled={drafting}
              title={readOnly ? undefined : t('draftWithAI')}
              className="text-muted-foreground hover:bg-muted hover:text-primary h-9 w-9 shrink-0 rounded-full p-0"
              onClick={handleDraft}
            >
              {drafting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </GatedButton>
          </div>
          <span
            aria-hidden="true"
            className="border-border/60 mx-1 h-7 shrink-0 border-l"
          />
          <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
            <PopoverTrigger
              type="button"
              disabled={inputsDisabled}
              aria-label={t('insertEmoji')}
              aria-haspopup="dialog"
              aria-expanded={emojiPickerOpen}
              onPointerEnter={preloadEmojiPicker}
              onFocus={preloadEmojiPicker}
              title={t('insertEmoji')}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Smile className="h-5 w-5" />
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              keepMounted
              className="border-border bg-popover w-[calc(100vw-24px)] max-w-[380px] overflow-hidden p-0"
            >
              <EmojiPicker open={emojiPickerOpen} onEmojiSelect={insertEmoji} />
            </PopoverContent>
          </Popover>
          <div className="relative flex min-w-0 flex-1 items-center rounded-md">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={
                readOnly
                  ? t('readOnlyPlaceholder')
                  : sessionExpired
                    ? t('sessionExpiredPlaceholder')
                    : t('typeMessagePlaceholder')
              }
              disabled={sessionExpired || readOnly}
              rows={1}
              // Textarea keeps its own inline title — the GatedButton
              // wrapping pattern doesn't apply to non-button inputs.
              // The placeholder text also surfaces the read-only state.
              title={readOnly ? t('readOnlyTitle') : undefined}
              style={{ caretColor: 'var(--primary)' }}
              className={cn(
                'scrollbar-composer text-foreground placeholder-muted-foreground min-h-11 w-full resize-none bg-transparent px-1 py-2.5 text-sm outline-none',
                (sessionExpired || readOnly) && 'cursor-not-allowed opacity-50'
              )}
            />
          </div>
          <GatedButton
            size="sm"
            canAct={!readOnly}
            gateReason="send messages"
            disabled={
              text.trim()
                ? sessionExpired || sending
                : inputsDisabled || busy || audioRecorder.status !== 'idle'
            }
            onClick={text.trim() ? handleSend : startRecording}
            title={text.trim() ? t('send') : t('voiceNote')}
            aria-label={text.trim() ? t('send') : t('voiceNote')}
            className="bg-primary hover:bg-primary/90 shadow-primary/20 h-10 w-10 shrink-0 rounded-full p-0 shadow-sm disabled:opacity-40 sm:h-11 sm:w-11"
          >
            {text.trim() ? (
              <Send className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </GatedButton>
        </div>
      )}

      {/* Interactive-message builder dialog. */}
      <Dialog open={interactiveOpen} onOpenChange={setInteractiveOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('interactiveMessage')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            <InteractiveBuilder
              value={interactivePayload}
              onChange={setInteractivePayload}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={savingQuickReply}
              onClick={saveAsQuickReply}
            >
              {savingQuickReply ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-1 h-4 w-4" />
              )}
              {t('saveAsQuickReply')}
            </Button>
            <Button onClick={sendInteractive}>
              <Send className="mr-1 h-4 w-4" />
              {t('send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick-reply picker. */}
      <QuickReplyPicker
        open={quickReplyOpen}
        onOpenChange={setQuickReplyOpen}
        onPick={handlePickQuickReply}
      />

      <Dialog open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('selectContact')}</DialogTitle>
          </DialogHeader>
          <input
            value={contactSearch}
            onChange={(event) => setContactSearch(event.target.value)}
            placeholder={t('searchContacts')}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm outline-none"
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto">
            {contactsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="text-primary h-5 w-5 animate-spin" />
              </div>
            ) : visibleContacts.length ? (
              <div className="space-y-1">
                {visibleContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => shareContact(contact)}
                    className="hover:bg-muted flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                  >
                    <span className="bg-primary/12 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <ContactRound className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {contact.name || contact.phone}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {contact.phone}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t('noContactsFound')}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Staged-attachment preview with caption + send/discard. Declared at
 * module scope (not nested in MessageComposer) so React keeps it mounted
 * across the parent's re-renders — a nested component would remount the
 * caption input on every keystroke and drop focus.
 */
function MediaDraftPreview({
  draft,
  busy,
  readOnly,
  onCaptionChange,
  onDiscard,
  onSend,
  t,
}: {
  draft: MediaDraft;
  busy: boolean;
  readOnly: boolean;
  onCaptionChange: (caption: string) => void;
  onDiscard: () => void;
  onSend: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="border-border bg-muted/40 rounded-xl border p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {draft.kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.mediaUrl}
              alt={draft.filename}
              className="max-h-40 rounded-lg object-cover"
            />
          )}
          {draft.kind === 'video' && (
            <video
              src={draft.mediaUrl}
              controls
              className="max-h-40 rounded-lg"
            />
          )}
          {draft.kind === 'audio' && (
            <audio src={draft.mediaUrl} controls className="w-full" />
          )}
          {draft.kind === 'document' && (
            <div className="text-foreground flex items-center gap-2 text-sm">
              <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
              <span className="truncate">{draft.filename}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDiscard}
          aria-label={t('removeAttachment')}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-end gap-2">
        {draft.kind !== 'audio' && (
          <input
            value={draft.caption}
            maxLength={MEDIA_CAPTION_MAX}
            onChange={(e) => onCaptionChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={t('addCaption')}
            className="border-border bg-muted text-foreground placeholder-muted-foreground focus:border-primary/50 flex-1 rounded-xl border px-4 py-2.5 text-sm transition-colors outline-none"
          />
        )}
        <GatedButton
          size="sm"
          canAct={!readOnly}
          gateReason="send messages"
          disabled={busy}
          onClick={onSend}
          className={cn(
            'bg-primary hover:bg-primary/90 h-9 w-9 shrink-0 p-0 disabled:opacity-40',
            draft.kind === 'audio' && 'ml-auto'
          )}
        >
          <Send className="h-4 w-4" />
        </GatedButton>
      </div>
    </div>
  );
}
