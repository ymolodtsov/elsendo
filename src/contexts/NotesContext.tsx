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

export interface SyncConflict {
  noteId: string;
  noteTitle: string | null;
  local: { content: string; updatedAt: string };
  server: { content: string; updatedAt: string };
}

interface NotesContextType {
  notes: Note[];
  archivedNotes: Note[];
  showArchive: boolean;
  setShowArchive: (show: boolean) => void;
  loading: boolean;
  error: string | null;
  conflicts: SyncConflict[];
  resolveConflict: (noteId: string, pick: 'local' | 'server') => Promise<void>;
  getNotes: () => Promise<Note[]>;
  getArchivedNotes: () => Promise<Note[]>;
  getNote: (id: string) => Promise<Note | null>;
  createNote: (noteData: NoteInsert) => Promise<Note | null>;
  updateNote: (id: string, updates: NoteUpdate) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;
  archiveNote: (id: string) => Promise<boolean>;
  unarchiveNote: (id: string) => Promise<boolean>;
  getShareLink: (noteId: string) => Promise<string | null>;
  createShareLink: (noteId: string) => Promise<string | null>;
  revokeShareLink: (noteId: string) => Promise<boolean>;
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
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

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

  // Get existing active share link for a note
  const getShareLink = useCallback(async (noteId: string): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('shared_notes')
        .select('share_token')
        .eq('note_id', noteId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data?.share_token || null;
    } catch {
      return null;
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

  // Revoke sharing for a note
  const revokeShareLink = useCallback(async (noteId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('shared_notes')
        .update({ is_active: false })
        .eq('note_id', noteId)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke share link';
      setError(errorMessage);
      return false;
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

  // Resolve a sync conflict — user picks local or server version
  const resolveConflict = useCallback(async (noteId: string, pick: 'local' | 'server') => {
    if (!user) return;

    const conflict = conflicts.find(c => c.noteId === noteId);
    if (!conflict) return;

    if (pick === 'local') {
      // Push our version to server
      await supabase
        .from('notes')
        .update({
          content: conflict.local.content,
          title: conflict.noteTitle,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)
        .eq('user_id', user.id);
    }
    // If pick === 'server', nothing to push — server already has the right version

    removeFromOfflineQueue(noteId);
    setConflicts(prev => prev.filter(c => c.noteId !== noteId));

    // Refresh to get the final state
    await getNotes();
  }, [user, conflicts, getNotes]);

  // Sync offline queue — called on reconnect and on startup
  const syncQueueRef = useRef<() => Promise<void>>();
  syncQueueRef.current = async () => {
    if (!user || !isOnline || !hasOfflineChanges()) return;

    setIsSyncing(true);
    const queue = getOfflineQueue();
    const detectedConflicts: SyncConflict[] = [];

    for (const [noteId, entry] of Object.entries(queue)) {
      try {
        const { data: serverNote } = await supabase
          .from('notes')
          .select('content, title, updated_at')
          .eq('id', noteId)
          .eq('user_id', user.id)
          .single();

        if (!serverNote) {
          removeFromOfflineQueue(noteId);
          continue;
        }

        const serverChanged = serverNote.updated_at > entry.serverUpdatedAt;

        if (!serverChanged) {
          await supabase
            .from('notes')
            .update({
              content: entry.content,
              title: entry.title,
              updated_at: entry.updatedAt,
            })
            .eq('id', noteId)
            .eq('user_id', user.id);
          removeFromOfflineQueue(noteId);
        } else {
          detectedConflicts.push({
            noteId,
            noteTitle: entry.title,
            local: { content: entry.content, updatedAt: entry.updatedAt },
            server: { content: serverNote.content, updatedAt: serverNote.updated_at },
          });
        }
      } catch {
        break;
      }
    }

    await getNotes();
    setIsSyncing(false);

    if (detectedConflicts.length > 0) {
      setConflicts(detectedConflicts);
    }
  };

  // Sync on reconnect (offline → online transition)
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (isOnline && wasOffline) {
      syncQueueRef.current?.();
    }
  }, [isOnline]);

  // Sync on startup if there are queued changes from a previous session
  const didStartupSync = useRef(false);
  useEffect(() => {
    if (didStartupSync.current || !user || !isOnline) return;
    if (!hasOfflineChanges()) return;
    didStartupSync.current = true;
    syncQueueRef.current?.();
  }, [user, isOnline]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    notes,
    archivedNotes,
    showArchive,
    setShowArchive,
    loading,
    error,
    conflicts,
    resolveConflict,
    getNotes,
    getArchivedNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    archiveNote,
    unarchiveNote,
    getShareLink,
    createShareLink,
    revokeShareLink,
    getNoteByShareToken,
  }), [
    notes,
    archivedNotes,
    showArchive,
    loading,
    error,
    conflicts,
    resolveConflict,
    getNotes,
    getArchivedNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    archiveNote,
    unarchiveNote,
    getShareLink,
    createShareLink,
    revokeShareLink,
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
