-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/qvpxzyzukaayqthdtfka/sql

-- Allow public/anonymous read access to notes that have an active share link
-- This is needed for OpenGraph metadata to work when social media crawlers fetch shared note previews

CREATE POLICY "Allow public read for shared notes" ON notes
FOR SELECT
TO anon
USING (
  id IN (
    SELECT note_id FROM shared_notes
    WHERE is_active = true
  )
);

-- Also allow reading the shared_notes table to verify share tokens
CREATE POLICY "Allow public read of active share tokens" ON shared_notes
FOR SELECT
TO anon
USING (is_active = true);
