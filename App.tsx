import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Editor } from './components/Editor';
import { NotesPanel } from './src/components/NotesPanel';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { NotesProvider, useNotes } from './src/contexts/NotesContext';
import { LoginForm } from './src/components/LoginForm';
import { Feather, Plus, FileText, X, Loader2 } from 'lucide-react';
import { ConnectivityProvider, useConnectivity } from './src/contexts/ConnectivityContext';
import { OfflineBanner } from './src/components/OfflineBanner';
import { ConflictResolver } from './src/components/ConflictResolver';

const AuthenticatedApp: React.FC = () => {
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [showMigrationToast, setShowMigrationToast] = useState(false);
  const { notes, loading, createNote, deleteNote, getNotes } = useNotes();
  const { isOnline } = useConnectivity();
  const navigate = useNavigate();
  const location = useLocation();
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
    if (!isOnline) return;

    const newNote = await createNote({
      content: '<p></p>',
      title: null,
    });

    if (newNote) {
      localStorage.setItem('elsendo-last-note', newNote.id);
      navigate(`/note/${newNote.id}`);
      setIsNotesOpen(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    // Check if we're deleting the currently viewed note
    const currentNoteId = location.pathname.match(/\/note\/(.+)/)?.[1];
    const isCurrentNote = currentNoteId === id;

    await deleteNote(id);
    await getNotes();

    // If we deleted the current note, navigate to another one
    if (isCurrentNote) {
      const remainingNotes = notes.filter(n => n.id !== id);
      if (remainingNotes.length > 0) {
        localStorage.setItem('elsendo-last-note', remainingNotes[0].id);
        navigate(`/note/${remainingNotes[0].id}`);
      } else {
        localStorage.removeItem('elsendo-last-note');
        navigate('/');
      }
    }
  };

  const handleSelectNote = (id: string) => {
    localStorage.setItem('elsendo-last-note', id);
    navigate(`/note/${id}`);
    setIsNotesOpen(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex flex-col relative overflow-hidden transition-colors duration-300">
      <OfflineBanner />
      <ConflictResolver />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<HomeRedirect notes={notes} loading={loading} onNewNote={handleNewNote} />} />
          <Route path="/note/:noteId" element={<EditorRoute />} />
        </Routes>
      </main>

      {/* Floating controls */}
      <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50" ref={panelRef}>
        <button
          onClick={() => setIsNotesOpen(!isNotesOpen)}
          className={`p-3 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
            isNotesOpen
              ? 'bg-stone-800 text-white'
              : 'bg-white/90 dark:bg-stone-800/90 text-stone-500 hover:text-stone-700 hover:bg-white dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-700/90'
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
            currentNoteId={location.pathname.match(/\/note\/(.+)/)?.[1]}
            onSelectNote={handleSelectNote}
            onDeleteNote={handleDeleteNote}
            onNewNote={handleNewNote}
          />
        )}
      </div>

      <button
        onClick={handleNewNote}
        disabled={!isOnline}
        className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-50 p-3 rounded-full shadow-lg transition-all duration-200 ${
          isOnline
            ? 'bg-stone-800 hover:bg-stone-700 text-white hover:shadow-xl hover:scale-105 active:scale-95'
            : 'bg-stone-300 dark:bg-stone-700 text-stone-400 dark:text-stone-500 cursor-not-allowed'
        }`}
        aria-label="New note"
        title={isOnline ? 'New note' : 'Connect to create new notes'}
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
    if (loading) return;

    const lastNoteId = localStorage.getItem('elsendo-last-note');
    if (lastNoteId) {
      navigate(`/note/${lastNoteId}`, { replace: true });
    } else if (notes.length > 0) {
      localStorage.setItem('elsendo-last-note', notes[0].id);
      navigate(`/note/${notes[0].id}`, { replace: true });
    }
  }, [notes, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // No notes — show empty state
  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 text-center">
          <Feather className="w-10 h-10 text-stone-300 dark:text-stone-600" strokeWidth={1.5} />
          <p className="text-stone-400 dark:text-stone-500 text-sm">No notes yet</p>
          <button
            onClick={onNewNote}
            className="mt-2 px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors"
          >
            Create your first note
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
  useEffect(() => {
    if (noteId) {
      localStorage.setItem('elsendo-last-note', noteId);
    }
  }, [noteId]);

  if (!noteId) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 pt-16 sm:pt-12 pb-48 transition-all duration-300">
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

// App component with auth guard
const App: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-stone-400 animate-spin" />
          <p className="text-stone-500 dark:text-stone-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return <AuthenticatedApp />;
};

// Wrapper component with Router and Auth
const AppWithRouter: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ConnectivityProvider>
          <NotesProvider>
            <Routes>
              <Route path="/shared/:token" element={<SharedNoteView />} />
              <Route path="/*" element={<App />} />
            </Routes>
          </NotesProvider>
        </ConnectivityProvider>
      </AuthProvider>
    </Router>
  );
};

export default AppWithRouter;
