-- ============================================================================
-- ELSENDO AUTHENTICATION SETUP
-- ============================================================================
-- This file contains all SQL needed to set up authentication for Elsendo
-- Run these queries in the Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: DATABASE SCHEMA UPDATES
-- ============================================================================
-- Run this first to add user_id columns and set up RLS policies

-- Add user_id columns to tables
ALTER TABLE notes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE shared_notes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX notes_user_id_idx ON notes(user_id);
CREATE INDEX shared_notes_user_id_idx ON shared_notes(user_id);

-- Drop overly permissive policies (if they exist)
DROP POLICY IF EXISTS "Allow all operations on notes" ON notes;
DROP POLICY IF EXISTS "Allow all operations on shared_notes" ON shared_notes;

-- User-specific RLS policies for notes
CREATE POLICY "Users can view own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);

-- Public access for shared notes (anyone can view if shared)
CREATE POLICY "Public can view shared notes" ON notes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM shared_notes WHERE shared_notes.note_id = notes.id AND shared_notes.is_active = true)
  );

-- Shared_notes policies
CREATE POLICY "Anyone can view active shares" ON shared_notes
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can create shares for own notes" ON shared_notes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM notes WHERE id = note_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can manage own shares" ON shared_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shares" ON shared_notes
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- STEP 2: CREATE USER ACCOUNT
-- ============================================================================
-- Don't run this SQL - do this in the Supabase Dashboard instead:
--
-- 1. Go to: Authentication → Users → Add User
-- 2. Enter your email
-- 3. Enter your password
-- 4. IMPORTANT: Check "Auto Confirm User" (to skip email confirmation)
-- 5. Click "Create User"
--
-- Copy the user ID from the dashboard - you'll need it for Step 3


-- ============================================================================
-- STEP 3: MIGRATE EXISTING NOTES
-- ============================================================================
-- Run this AFTER creating your user account in Step 2
-- This assigns all existing notes to the first user

DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the first user ID (or the user you just created)
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  -- Assign all notes without a user_id to this user
  UPDATE notes SET user_id = first_user_id WHERE user_id IS NULL;
  UPDATE shared_notes SET user_id = first_user_id WHERE user_id IS NULL;

  -- Show confirmation
  RAISE NOTICE 'Migration complete! Assigned notes to user: %', first_user_id;
END $$;


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify everything is set up correctly

-- Check schema changes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('notes', 'shared_notes')
ORDER BY table_name, ordinal_position;

-- Check RLS policies
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('notes', 'shared_notes')
ORDER BY tablename, policyname;

-- Verify notes have user_id assigned
SELECT id, title, user_id, created_at
FROM notes
ORDER BY created_at DESC
LIMIT 5;

-- Count notes by user
SELECT user_id, COUNT(*) as note_count
FROM notes
WHERE is_deleted = false
GROUP BY user_id;


-- ============================================================================
-- ROLLBACK (IF NEEDED)
-- ============================================================================
-- Only run this if you need to undo the changes

/*
-- Drop new policies
DROP POLICY IF EXISTS "Users can view own notes" ON notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
DROP POLICY IF EXISTS "Users can update own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
DROP POLICY IF EXISTS "Public can view shared notes" ON notes;
DROP POLICY IF EXISTS "Anyone can view active shares" ON shared_notes;
DROP POLICY IF EXISTS "Users can create shares for own notes" ON shared_notes;
DROP POLICY IF EXISTS "Users can manage own shares" ON shared_notes;
DROP POLICY IF EXISTS "Users can delete own shares" ON shared_notes;

-- Remove user_id columns
ALTER TABLE notes DROP COLUMN IF EXISTS user_id;
ALTER TABLE shared_notes DROP COLUMN IF EXISTS user_id;

-- Drop indexes
DROP INDEX IF EXISTS notes_user_id_idx;
DROP INDEX IF EXISTS shared_notes_user_id_idx;

-- Restore permissive policies (if needed)
CREATE POLICY "Allow all operations on notes" ON notes FOR ALL USING (true);
CREATE POLICY "Allow all operations on shared_notes" ON shared_notes FOR ALL USING (true);
*/
