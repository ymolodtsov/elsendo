import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Note, NoteInsert, NoteUpdate } from '../types';
import { nanoid } from 'nanoid';
import { useAuth } from './AuthContext';
import { useConnectivity } from './ConnectivityContext';
import {
  getOfflineQueue,
  saveToOfflineQueue,
  removeFromOfflineQueue,
  hasOfflineChanges,
} from '../lib/offlineQueue';

// Share token validation: alphanumeric + dash/underscore, 32 chars
const SHARE_TOKEN_REGEX = /^[A-Za-z0-9_-]{32}$/;

interface NotesContextType {
  notes: Note[];
  archivedNotes: Note[];
  showArchive: boolean;
  setShowArchive: (show: boolean) => void;
  loading: boolean;
  error: string | null;
  getNotes: () => Promise<Note[]>;
  getArchivedNotes: () => Promise<Note[]>;
  getNote: (id: string) => Promise<Note | null>;
  createNote: (noteData: NoteInsert) => Promise<Note | null>;
  updateNote: (id: string, updates: NoteUpdate) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;
  archiveNote: (id: string) => Promise<boolean>;
  unarchiveNote: (id: string) => Promise<boolean>;
  createShareLink: (noteId: string) => Promise<string | null>;
  getNoteByShareToken: (shareToken: string) => Promise<Note | null>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isOnline, setIsSyncing } = useConnectivity();
  const prevOnlineRef = useRef(isOnline);
  const [notes, setNotes] = useState<Note[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all notes
  const getNotes = useCallback(async () => {
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
        .eq('is_archived', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch notes';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch archived notes
  const getArchivedNotes = useCallback(async () => {
    if (!user) {
      setArchivedNotes([]);
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_archived', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setArchivedNotes(data || []);
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch archived notes';
      setError(errorMessage);
      return [];
    }
  }, [user]);

  // Fetch a single note by ID
  const getNote = useCallback(async (id: string): Promise<Note | null> => {
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
      return null;
    }
  }, [user]);

  // Create a new note
  const createNote = useCallback(async (noteData: NoteInsert): Promise<Note | null> => {
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
      return null;
    }
  }, [user]);

  // Update an existing note (with offline fallback)
  const updateNote = useCallback(async (id: string, updates: NoteUpdate): Promise<Note | null> => {
    if (!user) return null;

    const now = new Date().toISOString();

    // Find the current note to get its server timestamp for conflict detection
    const currentNote = notes.find(n => n.id === id);

    const saveOffline = () => {
      saveToOfflineQueue(id, {
        content: updates.content || currentNote?.content || '',
        title: updates.title !== undefined ? updates.title : currentNote?.title || null,
        updatedAt: now,
        serverUpdatedAt: currentNote?.updated_at || now,
      });
      // Optimistically update local state
      if (currentNote) {
        const optimistic = { ...currentNote, ...updates, updated_at: now };
        setNotes(prev => prev.map(n => n.id === id ? optimistic : n));
        return optimistic;
      }
      return null;
    };

    if (!isOnline) {
      return saveOffline();
    }

    try {
      const { data, error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Success — clear from offline queue if it was there
      removeFromOfflineQueue(id);

      // Update local state
      setNotes(prevNotes =>
        prevNotes.map(note => (note.id === id ? data : note))
      );
      return data;
    } catch {
      // Network failure — fall back to offline queue
      return saveOffline();
    }
  }, [user, isOnline, notes]);

  // Soft delete a note
  const deleteNote = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_deleted: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state (remove from both lists)
      setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
      setArchivedNotes(prevNotes => prevNotes.filter(note => note.id !== id));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete note';
      setError(errorMessage);
      return false;
    }
  }, [user]);

  // Archive a note
  const archiveNote = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('notes')
        .update({ is_archived: true })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Move from notes to archivedNotes
      setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
      setArchivedNotes(prevNotes => [data, ...prevNotes]);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive note';
      setError(errorMessage);
      return false;
    }
  }, [user]);

  // Unarchive a note
  const unarchiveNote = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('notes')
        .update({ is_archived: false })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Move from archivedNotes to notes
      setArchivedNotes(prevNotes => prevNotes.filter(note => note.id !== id));
      setNotes(prevNotes => [data, ...prevNotes]);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unarchive note';
      setError(errorMessage);
      return false;
    }
  }, [user]);

  // Create a share link for a note
  const createShareLink = useCallback(async (noteId: string): Promise<string | null> => {
    if (!user) return null;

    try {
      const shareToken = nanoid(32);

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
      return null;
    }
  }, [user]);

  // Get note by share token (for read-only view)
  const getNoteByShareToken = useCallback(async (shareToken: string): Promise<Note | null> => {
    // Validate share token format to prevent injection
    if (!SHARE_TOKEN_REGEX.test(shareToken)) {
      setError('Invalid share token format');
      return null;
    }

    try {
      // Single query with join to avoid N+1
      const { data, error } = await supabase
        .from('shared_notes')
        .select('note_id, notes!inner(id, content, title, created_at, updated_at, is_deleted, is_archived)')
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .eq('notes.is_deleted', false)
        .single();

      if (error) throw error;

      // Extract the note from the joined result
      const note = data?.notes as unknown as Note;
      return note || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch shared note';
      setError(errorMessage);
      return null;
    }
  }, []);

  // Load notes on mount and when user changes
  useEffect(() => {
    if (user) {
      getNotes();
    } else {
      setNotes([]);
      setLoading(false);
    }
  }, [user, getNotes]);

  // Sync offline queue when coming back online
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!isOnline || !wasOffline || !user) return;
    if (!hasOfflineChanges()) return;

    const syncQueue = async () => {
      setIsSyncing(true);
      const queue = getOfflineQueue();

      for (const [noteId, entry] of Object.entries(queue)) {
        try {
          // Check current server state
          const { data: serverNote } = await supabase
            .from('notes')
            .select('updated_at')
            .eq('id', noteId)
            .eq('user_id', user.id)
            .single();

          if (!serverNote) {
            // Note was deleted on server — discard offline edit
            removeFromOfflineQueue(noteId);
            continue;
          }

          // Last-write-wins: push if our edit is newer than server
          const serverTime = new Date(serverNote.updated_at).getTime();
          const localTime = new Date(entry.updatedAt).getTime();

          if (localTime >= serverTime) {
            await supabase
              .from('notes')
              .update({
                content: entry.content,
                title: entry.title,
                updated_at: entry.updatedAt,
              })
              .eq('id', noteId)
              .eq('user_id', user.id);
          }

          removeFromOfflineQueue(noteId);
        } catch {
          // Network dropped again mid-sync — stop, will retry next time
          break;
        }
      }

      // Refresh full list from server
      await getNotes();
      setIsSyncing(false);
    };

    syncQueue();
  }, [isOnline, user, getNotes, setIsSyncing]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    notes,
    archivedNotes,
    showArchive,
    setShowArchive,
    loading,
    error,
    getNotes,
    getArchivedNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    archiveNote,
    unarchiveNote,
    createShareLink,
    getNoteByShareToken,
  }), [
    notes,
    archivedNotes,
    showArchive,
    loading,
    error,
    getNotes,
    getArchivedNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    archiveNote,
    unarchiveNote,
    createShareLink,
    getNoteByShareToken,
  ]);

  return (
    <NotesContext.Provider value={contextValue}>
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
