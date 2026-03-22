import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Note } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Plus, LogOut, Archive, ArchiveRestore, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotes } from '../contexts/NotesContext';
import { ConfirmDialog } from './ConfirmDialog';

// Reusable DOMParser instance
const domParser = new DOMParser();

// Extract title from note content - memoized per note
const extractTitleFromContent = (content: string): string => {
  const doc = domParser.parseFromString(content, 'text/html');
  const firstHeading = doc.querySelector('h1, h2')?.textContent;
  if (firstHeading) return firstHeading.slice(0, 40);

  const firstParagraph = doc.querySelector('p')?.textContent;
  if (firstParagraph) return firstParagraph.slice(0, 40);

  return 'Untitled';
};

interface NotesPanelProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onNewNote: () => void;
}

export const NotesPanel: React.FC<NotesPanelProps> = React.memo(({
  notes,
  onSelectNote,
  onDeleteNote,
  onNewNote,
}) => {
  const { noteId } = useParams();
  const { signOut } = useAuth();
  const { archivedNotes, showArchive, setShowArchive, archiveNote, unarchiveNote, getArchivedNotes } = useNotes();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-switch to archive view if the current note is archived
  useEffect(() => {
    if (noteId && !notes.some(n => n.id === noteId)) {
      getArchivedNotes().then((archived) => {
        if (archived.some(n => n.id === noteId)) {
          setShowArchive(true);
        }
      });
    }
  }, [noteId, notes, getArchivedNotes, setShowArchive]);

  const displayedNotes = showArchive ? archivedNotes : notes;
  const [animatingOut, setAnimatingOut] = useState<{ id: string; type: 'archive' | 'delete' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'delete' | 'logout';
    noteId?: string;
    noteTitle?: string;
  } | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleArchiveClick = useCallback(async () => {
    if (!showArchive) {
      await getArchivedNotes();
    }
    setShowArchive(!showArchive);
  }, [showArchive, getArchivedNotes, setShowArchive]);

  const handleLogout = useCallback(() => {
    setConfirmDialog({ type: 'logout' });
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    setConfirmDialog(null);
    await signOut();
  }, [signOut]);

  // Memoize title extraction for all displayed notes
  const noteTitles = useMemo(() => {
    const titles = new Map<string, string>();
    for (const note of displayedNotes) {
      titles.set(note.id, note.title || extractTitleFromContent(note.content));
    }
    return titles;
  }, [displayedNotes]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setConfirmDialog({ type: 'delete', noteId: id, noteTitle: title });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!confirmDialog?.noteId) return;
    const noteId = confirmDialog.noteId;
    setConfirmDialog(null);
    setAnimatingOut({ id: noteId, type: 'delete' });
    timeoutRef.current = setTimeout(() => {
      onDeleteNote(noteId);
      // Don't clear animatingOut - item will be removed from list anyway
    }, 250);
  }, [confirmDialog, onDeleteNote]);

  const handleCancelDialog = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  return (
    <div className="absolute top-14 left-0 w-72 bg-white dark:bg-stone-800 rounded-2xl shadow-2xl border border-stone-200/50 dark:border-stone-700/50 overflow-hidden animate-scale-in">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-700/50 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-600 dark:text-stone-300">
          {showArchive ? (
            <>{archivedNotes.length} archived</>
          ) : (
            <>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</>
          )}
        </span>
        <div className="flex items-center gap-1">
          {showArchive ? (
            <button
              onClick={handleArchiveClick}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
              aria-label="Back to notes"
              title="Back to notes"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            </button>
          ) : (
            <>
              <button
                onClick={onNewNote}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                aria-label="New note"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
              </button>
              <button
                onClick={handleArchiveClick}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                aria-label="View archive"
                title="View archive"
              >
                <Archive className="w-4 h-4" strokeWidth={2} />
              </button>
            </>
          )}
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className="max-h-96 overflow-y-auto">
        {displayedNotes.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-stone-400 dark:text-stone-500 text-sm">
              {showArchive ? 'No archived notes' : 'No notes yet'}
            </p>
          </div>
        ) : (
          <div className="py-2">
            {displayedNotes.map((note) => {
              const title = noteTitles.get(note.id) || 'Untitled';
              const isActive = note.id === noteId;

              const handleArchive = (e: React.MouseEvent) => {
                e.stopPropagation();
                setAnimatingOut({ id: note.id, type: 'archive' });
                timeoutRef.current = setTimeout(async () => {
                  if (showArchive) {
                    await unarchiveNote(note.id);
                  } else {
                    await archiveNote(note.id);
                  }
                  // Don't clear animatingOut - item will be removed from list anyway
                }, 250);
              };

              const isAnimating = animatingOut?.id === note.id;
              const animationClass = isAnimating
                ? animatingOut.type === 'archive'
                  ? 'animate-slide-out-left'
                  : 'animate-slide-out-right'
                : '';

              return (
                <div
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className={`
                    group px-4 py-2.5 cursor-pointer
                    transition-colors duration-150
                    ${isActive
                      ? 'bg-stone-100 dark:bg-stone-700'
                      : 'hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }
                    ${animationClass}
                  `}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`
                          text-sm truncate
                          ${isActive
                            ? 'font-medium text-stone-800 dark:text-stone-100'
                            : 'text-stone-600 dark:text-stone-300'
                          }
                        `}
                      >
                        {title}
                      </h3>
                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                        {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={handleArchive}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-stone-100 dark:hover:bg-stone-600 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-all"
                        aria-label={showArchive ? 'Unarchive note' : 'Archive note'}
                        title={showArchive ? 'Unarchive' : 'Archive'}
                      >
                        {showArchive ? (
                          <ArchiveRestore className="w-3.5 h-3.5" strokeWidth={2} />
                        ) : (
                          <Archive className="w-3.5 h-3.5" strokeWidth={2} />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(e, note.id, title)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={confirmDialog?.type === 'delete'}
        title="Delete note"
        message={`Are you sure you want to delete "${confirmDialog?.noteTitle || 'this note'}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDialog}
      />

      {/* Logout confirmation dialog */}
      <ConfirmDialog
        open={confirmDialog?.type === 'logout'}
        title="Sign out"
        message="Are you sure you want to sign out of Elsendo?"
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        variant="default"
        onConfirm={handleConfirmLogout}
        onCancel={handleCancelDialog}
      />
    </div>
  );
});
