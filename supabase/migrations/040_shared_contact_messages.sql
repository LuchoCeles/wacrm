-- WhatsApp contact cards are first-class messages. Keep a snapshot of the
-- shared person so historical messages remain accurate after a CRM contact is
-- edited or removed.

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video',
    'contact', 'location', 'template', 'interactive'
  ));

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS contact_payload JSONB;
