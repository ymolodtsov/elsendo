import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Note } from '../types';
import { useNotes } from '../contexts/NotesContext';

const domParser = new DOMParser();

const extractTitle = (note: Note): string => {
  if (note.title) return note.title;
  const doc = domParser.parseFromString(note.content, 'text/html');
  const heading = doc.querySelector('h1, h2')?.textContent;
  if (heading) return heading.slice(0, 60);
  const paragraph = doc.querySelector('p')?.textContent;
  if (paragraph) return paragraph.slice(0, 60);
  return 'Untitled';
};

interface OmnibarProps {
  onSelect: (id: string) => void;
  onClose: () => void;
}

export const Omnibar: React.FC<OmnibarProps> = ({ onSelect, onClose }) => {
  const { notes, archivedNotes, getArchivedNotes } = useNotes();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch archived notes on mount if not already loaded
  useEffect(() => {
    if (archivedNotes.length === 0) {
      getArchivedNotes();
    }
  }, []);

  const titledNotes = useMemo(
    () => [
      ...notes.map(n => ({ id: n.id, title: extractTitle(n), archived: false })),
      ...archivedNotes.map(n => ({ id: n.id, title: extractTitle(n), archived: true })),
    ],
    [notes, archivedNotes]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return titledNotes;
    const q = query.toLowerCase();
    return titledNotes.filter(n => n.title.toLowerCase().includes(q));
  }, [query, titledNotes]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback((id: string) => {
    onSelect(id);
    onClose();
  }, [onSelect, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filtered, selectedIndex, handleSelect, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" />
      <div
        className="relative w-full max-w-md mx-4 bg-white dark:bg-stone-800 rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Switch to note…"
          className="w-full px-4 py-3 text-base bg-transparent text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 outline-none border-b border-stone-200 dark:border-stone-700"
        />
        <div ref={listRef} className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-stone-400 dark:text-stone-500">
              No matching notes
            </div>
          ) : (
            filtered.map((note, i) => (
              <button
                key={note.id}
                onClick={() => handleSelect(note.id)}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                  i === selectedIndex
                    ? 'bg-stone-100 dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-750'
                }`}
              >
                <span className={note.archived ? 'opacity-60' : ''}>{note.title}</span>
                {note.archived && (
                  <span className="text-xs text-stone-400 dark:text-stone-500 shrink-0">archived</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
