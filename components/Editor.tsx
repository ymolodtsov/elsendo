import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { markInputRule } from '@tiptap/core';
import { Toolbar } from './Toolbar';
import { useNotes } from '../src/hooks/useNotes';
import { useAutoSave } from '../src/hooks/useAutoSave';

interface EditorProps {
  noteId: string;
  isShared?: boolean;
}

export const Editor: React.FC<EditorProps> = ({ noteId, isShared = false }) => {
  const [isLoading, setIsLoading] = useState(true);
  const { getNote, updateNote, getNoteByShareToken } = useNotes();

  const { save, isSaving, isSaved } = useAutoSave({
    onSave: async (content: string) => {
      if (!isShared) {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const firstHeading = doc.querySelector('h1, h2')?.textContent;
        const title = firstHeading || null;

        await updateNote(noteId, { content, title });
      }
    },
    delay: 1000,
  });

  const CustomLink = Link.extend({
    addInputRules() {
      return [
        markInputRule({
          find: /(?:^|[\s])\[([^\]]+)\]\(([^)]+)\)$/,
          type: this.type,
          getAttributes: (match) => ({
            href: match[2],
          }),
        }),
      ];
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      CustomLink.configure({
        openOnClick: true,
        autolink: true,
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Start writing your thoughts...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[60vh] leading-relaxed transition-colors duration-200 [&_li]:!my-1 [&_li>p]:!m-0 [&_li>ul]:!m-0 [&_li>ol]:!m-0 prose-headings:text-stone-800 dark:prose-headings:text-stone-100 prose-p:text-stone-600 dark:prose-p:text-stone-200 prose-a:text-stone-600 prose-a:underline hover:prose-a:text-stone-800 prose-strong:text-stone-800 dark:prose-strong:text-stone-100 prose-ul:text-stone-600 dark:prose-ul:text-stone-200 prose-ol:text-stone-600 dark:prose-ol:text-stone-200',
      },
    },
    editable: !isShared,
    onUpdate: ({ editor }) => {
      if (!isShared) {
        save(editor.getHTML());
      }
    },
  });

  useEffect(() => {
    const loadNote = async () => {
      if (!editor) return;

      setIsLoading(true);
      try {
        const note = isShared
          ? await getNoteByShareToken(noteId)
          : await getNote(noteId);

        if (note && note.content) {
          editor.commands.setContent(note.content);
        }
      } catch (error) {
        console.error('Error loading note:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNote();
  }, [noteId, editor, isShared]);

  if (!editor) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin" />
          <p className="text-stone-400 dark:text-stone-500 text-sm">Loading note...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col animate-fade-in">
      <div className="flex-1 py-4">
        <EditorContent editor={editor} />
      </div>

      {!isShared && (
        <div className="fixed bottom-4 sm:bottom-8 left-0 right-0 flex flex-col items-center justify-center pointer-events-none z-50">
          {/* Save status indicator */}
          <div
            className={`
              mb-3 px-4 py-1.5 rounded-full text-xs font-medium
              bg-white/90 dark:bg-stone-800/90 backdrop-blur-md
              border border-stone-200/50 dark:border-stone-700/50
              shadow
              transition-all duration-500
              ${isSaved ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
            `}
          >
            {isSaving ? (
              <span className="text-stone-400 dark:text-stone-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" />
                Saving...
              </span>
            ) : (
              <span className="text-stone-600 dark:text-stone-400">Saved</span>
            )}
          </div>

          {/* Toolbar */}
          <div className="pointer-events-auto">
            <Toolbar editor={editor} noteId={noteId} />
          </div>
        </div>
      )}
    </div>
  );
};
