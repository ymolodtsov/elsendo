import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Note, NoteInsert, NoteUpdate } from '../types';
import { nanoid } from 'nanoid';
import { useAuth } from './AuthContext';

interface NotesContextType {
  notes: Note[];
  loading: boolean;
  error: string | null;
  getNotes: () => Promise<Note[]>;
  getNote: (id: string) => Promise<Note | null>;
  createNote: (noteData: NoteInsert) => Promise<Note | null>;
  updateNote: (id: string, updates: NoteUpdate) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;
  createShareLink: (noteId: string) => Promise<string | null>;
  getNoteByShareToken: (shareToken: string) => Promise<Note | null>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all notes
  const getNotes = async () => {
    if (!user) {
      setNotes([]);
      setLoading(false);
      return [];
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch notes';
      setError(errorMessage);
      console.error('Error fetching notes:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch a single note by ID
  const getNote = async (id: string): Promise<Note | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch note';
      setError(errorMessage);
      console.error('Error fetching note:', err);
      return null;
    }
  };

  // Create a new note
  const createNote = async (noteData: NoteInsert): Promise<Note | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert([{ ...noteData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setNotes(prevNotes => [data, ...prevNotes]);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create note';
      setError(errorMessage);
      console.error('Error creating note:', err);
      return null;
    }
  };

  // Update an existing note
  const updateNote = async (id: string, updates: NoteUpdate): Promise<Note | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setNotes(prevNotes =>
        prevNotes.map(note => (note.id === id ? data : note))
      );
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update note';
      setError(errorMessage);
      console.error('Error updating note:', err);
      return null;
    }
  };

  // Soft delete a note
  const deleteNote = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_deleted: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete note';
      setError(errorMessage);
      console.error('Error deleting note:', err);
      return false;
    }
  };

  // Create a share link for a note
  const createShareLink = async (noteId: string): Promise<string | null> => {
    if (!user) return null;

    try {
      const shareToken = nanoid(21);

      const { error } = await supabase
        .from('shared_notes')
        .insert([{
          note_id: noteId,
          share_token: shareToken,
          is_active: true,
          user_id: user.id
        }]);

      if (error) throw error;

      return shareToken;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create share link';
      setError(errorMessage);
      console.error('Error creating share link:', err);
      return null;
    }
  };

  // Get note by share token (for read-only view)
  const getNoteByShareToken = async (shareToken: string): Promise<Note | null> => {
    try {
      const { data: sharedNote, error: shareError } = await supabase
        .from('shared_notes')
        .select('note_id')
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .single();

      if (shareError) throw shareError;

      const { data: note, error: noteError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', sharedNote.note_id)
        .eq('is_deleted', false)
        .single();

      if (noteError) throw noteError;

      return note;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch shared note';
      setError(errorMessage);
      console.error('Error fetching shared note:', err);
      return null;
    }
  };

  // Load notes on mount and when user changes
  useEffect(() => {
    if (user) {
      getNotes();
    } else {
      setNotes([]);
      setLoading(false);
    }
  }, [user]);

  return (
    <NotesContext.Provider value={{
      notes,
      loading,
      error,
      getNotes,
      getNote,
      createNote,
      updateNote,
      deleteNote,
      createShareLink,
      getNoteByShareToken,
    }}>
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within NotesProvider');
  }
  return context;
};
