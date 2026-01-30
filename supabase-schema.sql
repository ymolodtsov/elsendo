-- Elsendo Database Schema
-- Run this in your Supabase SQL Editor

-- Notes table
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Shared notes (for read-only sharing)
CREATE TABLE shared_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Indexes for better performance
CREATE INDEX notes_updated_at_idx ON notes(updated_at DESC);
CREATE INDEX shared_notes_token_idx ON shared_notes(share_token);

-- Enable Row Level Security (RLS)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (single-user app)
-- Notes: Allow all operations
CREATE POLICY "Allow all operations on notes" ON notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Shared notes: Allow all operations
CREATE POLICY "Allow all operations on shared_notes" ON shared_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);
