import React from 'react';
import { useParams } from 'react-router-dom';
import { Note } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Plus } from 'lucide-react';

interface NotesPanelProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onNewNote: () => void;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({
  notes,
  onSelectNote,
  onDeleteNote,
  onNewNote,
}) => {
  const { noteId } = useParams();

  const extractTitle = (note: Note): string => {
    if (note.title) return note.title;

    const doc = new DOMParser().parseFromString(note.content, 'text/html');
    const firstHeading = doc.querySelector('h1, h2')?.textContent;
    if (firstHeading) return firstHeading.slice(0, 40);

    const firstParagraph = doc.querySelector('p')?.textContent;
    if (firstParagraph) return firstParagraph.slice(0, 40);

    return 'Untitled';
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this note?')) {
      onDeleteNote(id);
    }
  };

  return (
    <div className="absolute top-14 left-0 w-72 bg-white dark:bg-stone-800 rounded-2xl shadow-2xl border border-stone-200/50 dark:border-stone-700/50 overflow-hidden animate-scale-in">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-700/50 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-600 dark:text-stone-300">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
        <button
          onClick={onNewNote}
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
          aria-label="New note"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {/* Notes list */}
      <div className="max-h-80 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-stone-400 dark:text-stone-500 text-sm">No notes yet</p>
          </div>
        ) : (
          <div className="py-2">
            {notes.map((note) => {
              const title = extractTitle(note);
              const isActive = note.id === noteId;

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

                    <button
                      onClick={(e) => handleDelete(e, note.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                      aria-label="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
