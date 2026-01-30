import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Editor } from './components/Editor';
import { NotesPanel } from './src/components/NotesPanel';
import { useNotes } from './src/hooks/useNotes';
import { Feather, Plus, FileText, X } from 'lucide-react';

const App: React.FC = () => {
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [showMigrationToast, setShowMigrationToast] = useState(false);
  const { notes, loading, createNote, deleteNote, getNotes } = useNotes();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // Migrate localStorage content from Flow to Elsendo
  useEffect(() => {
    const FLOW_STORAGE_KEY = 'flow-content-v1';
    const MIGRATION_FLAG_KEY = 'elsendo-migrated';

    const migrateFromLocalStorage = async () => {
      if (localStorage.getItem(MIGRATION_FLAG_KEY)) {
        return;
      }

      const oldContent = localStorage.getItem(FLOW_STORAGE_KEY);
      if (oldContent && oldContent.trim() !== '' && oldContent !== '<p></p>') {
        try {
          const migratedNote = await createNote({
            content: oldContent,
            title: 'Migrated from Flow',
          });

          if (migratedNote) {
            localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
            localStorage.removeItem(FLOW_STORAGE_KEY);
            setShowMigrationToast(true);
            setTimeout(() => setShowMigrationToast(false), 5000);
            navigate(`/note/${migratedNote.id}`);
          }
        } catch (error) {
          console.error('Migration error:', error);
        }
      } else {
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      }
    };

    if (!loading) {
      migrateFromLocalStorage();
    }
  }, [loading, createNote, navigate]);

  // Toggle notes panel keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setIsNotesOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isNotesOpen) {
        setIsNotesOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNotesOpen]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isNotesOpen && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsNotesOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotesOpen]);

  const handleNewNote = async () => {
    const newNote = await createNote({
      content: '<p></p>',
      title: null,
    });

    if (newNote) {
      navigate(`/note/${newNote.id}`);
      setIsNotesOpen(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
    await getNotes();
  };

  const handleSelectNote = (id: string) => {
    navigate(`/note/${id}`);
    setIsNotesOpen(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex flex-col relative overflow-hidden transition-colors duration-300">
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<HomeRedirect notes={notes} loading={loading} onNewNote={handleNewNote} />} />
          <Route path="/note/:noteId" element={<EditorRoute />} />
        </Routes>
      </main>

      {/* Floating controls */}
      <div className="fixed top-6 left-6 z-50" ref={panelRef}>
        <button
          onClick={() => setIsNotesOpen(!isNotesOpen)}
          className={`p-3 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
            isNotesOpen
              ? 'bg-stone-800 text-white'
              : 'bg-white/90 dark:bg-stone-800/90 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
          aria-label={isNotesOpen ? 'Close notes' : 'Open notes'}
          title="Notes (Cmd+Shift+F)"
        >
          {isNotesOpen ? (
            <X className="w-5 h-5" strokeWidth={1.5} />
          ) : (
            <FileText className="w-5 h-5" strokeWidth={1.5} />
          )}
        </button>

        {/* Floating notes panel */}
        {isNotesOpen && (
          <NotesPanel
            notes={notes}
            onSelectNote={handleSelectNote}
            onDeleteNote={handleDeleteNote}
            onNewNote={handleNewNote}
          />
        )}
      </div>

      <button
        onClick={handleNewNote}
        className="fixed top-6 right-6 z-50 p-3 bg-stone-800 hover:bg-stone-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
        aria-label="New note"
        title="New note"
      >
        <Plus className="w-5 h-5" strokeWidth={2} />
      </button>

      {/* Migration Success Toast */}
      {showMigrationToast && (
        <div className="fixed bottom-8 right-8 bg-stone-800 text-white px-5 py-4 rounded-xl shadow-lg z-50 animate-slide-up flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Feather className="w-4 h-4" />
          </div>
          <p className="font-medium">Your note has been migrated!</p>
        </div>
      )}
    </div>
  );
};

// Redirect to the most recent note or show empty state
const HomeRedirect: React.FC<{ notes: any[]; loading: boolean; onNewNote: () => void }> = ({ notes, loading, onNewNote }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && notes.length > 0) {
      navigate(`/note/${notes[0].id}`, { replace: true });
    }
  }, [notes, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin" />
          <p className="text-stone-400 dark:text-stone-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div className="max-w-md animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-stone-200 dark:bg-stone-700 flex items-center justify-center shadow">
            <Feather className="w-10 h-10 text-stone-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-medium text-stone-800 dark:text-stone-100 mb-3">
            Start writing
          </h2>
          <p className="text-stone-500 dark:text-stone-400 mb-6 leading-relaxed">
            A space for your thoughts.
          </p>
          <button
            onClick={onNewNote}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-lg transition-all duration-200 shadow hover:shadow-md active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            <span className="text-sm font-medium">New Note</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};

// Editor route component
const EditorRoute: React.FC = () => {
  const { noteId } = useParams();

  if (!noteId) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-8 pt-12 pb-48 transition-all duration-300">
      <Editor noteId={noteId} />
    </div>
  );
};

// Standalone shared note view (no chrome)
const SharedNoteView: React.FC = () => {
  const { token } = useParams();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-start justify-center">
      <div className="w-full max-w-4xl mx-auto px-6 pt-8 pb-32">
        <Editor noteId={token} isShared />
      </div>
    </div>
  );
};

// Wrapper component with Router
const AppWithRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/shared/:token" element={<SharedNoteView />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </Router>
  );
};

export default AppWithRouter;
