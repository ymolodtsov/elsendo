import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { useNotes } from '../contexts/NotesContext';
import type { SyncConflict } from '../contexts/NotesContext';

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.trim() || '';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today at ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` at ${time}`;
}

const ConflictCard: React.FC<{
  conflict: SyncConflict;
  onResolve: (noteId: string, pick: 'local' | 'server') => void;
}> = ({ conflict, onResolve }) => {
  const localNewer = conflict.local.updatedAt >= conflict.server.updatedAt;
  const [selected, setSelected] = useState<'local' | 'server'>(localNewer ? 'local' : 'server');

  const localPreview = stripHtml(conflict.local.content).slice(0, 120);
  const serverPreview = stripHtml(conflict.server.content).slice(0, 120);

  const title = conflict.noteTitle || 'Untitled note';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-stone-800 dark:text-stone-100 mb-1">{title}</h3>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          This note was edited on another device while you were offline.
        </p>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => setSelected('local')}
          className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
            selected === 'local'
              ? 'border-stone-800 dark:border-stone-300 bg-stone-50 dark:bg-stone-700/50'
              : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
              This device
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500">{formatTime(conflict.local.updatedAt)}</span>
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-2">
            {localPreview || 'Empty note'}
          </p>
        </button>

        <button
          onClick={() => setSelected('server')}
          className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
            selected === 'server'
              ? 'border-stone-800 dark:border-stone-300 bg-stone-50 dark:bg-stone-700/50'
              : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
              Other device
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500">{formatTime(conflict.server.updatedAt)}</span>
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-2">
            {serverPreview || 'Empty note'}
          </p>
        </button>
      </div>

      <button
        onClick={() => onResolve(conflict.noteId, selected)}
        className="w-full py-2.5 px-4 bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium rounded-xl transition-all shadow hover:shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
      >
        <Check className="w-4 h-4" strokeWidth={2} />
        Keep this version
      </button>
    </div>
  );
};

export const ConflictResolver: React.FC = () => {
  const { conflicts, resolveConflict } = useNotes();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [conflicts.length]);

  if (conflicts.length === 0) return null;

  const current = conflicts[currentIndex];
  if (!current) return null;

  const handleResolve = async (noteId: string, pick: 'local' | 'server') => {
    await resolveConflict(noteId, pick);
    // conflicts array will shrink, currentIndex stays at 0 since we reset in useEffect
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/20 dark:bg-stone-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl w-full max-w-sm border border-stone-200 dark:border-stone-700 overflow-hidden animate-scale-in">
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-700 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" strokeWidth={2} />
          </div>
          <div>
            <span className="text-lg font-medium text-stone-800 dark:text-stone-100">
              Sync Conflict
            </span>
            {conflicts.length > 1 && (
              <span className="ml-2 text-xs text-stone-400 dark:text-stone-500">
                {currentIndex + 1} of {conflicts.length}
              </span>
            )}
          </div>
        </div>
        <div className="p-5">
          <ConflictCard conflict={current} onResolve={handleResolve} />
        </div>
      </div>
    </div>
  );
};
