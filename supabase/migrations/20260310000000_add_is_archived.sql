ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS notes_user_archived_idx ON notes(user_id, is_archived);
