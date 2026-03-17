import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { markInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DOMSerializer } from '@tiptap/pm/model';
import { Toolbar, ToolbarHandle } from './Toolbar';
import { htmlToMarkdown } from '../src/lib/htmlToMarkdown';
import { LinkPreviewOverlay } from './LinkPreview';
import { useNotes } from '../src/contexts/NotesContext';
import { useConnectivity } from '../src/contexts/ConnectivityContext';
import { useAutoSave } from '../src/hooks/useAutoSave';

interface EditorProps {
  noteId: string;
  isShared?: boolean;
}

export const Editor: React.FC<EditorProps> = ({ noteId, isShared = false }) => {
  const [isLoading, setIsLoading] = useState(true);
  const { getNote, updateNote, getNoteByShareToken } = useNotes();
  const { isOnline } = useConnectivity();
  const toolbarRef = useRef<ToolbarHandle>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

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
    inclusive: false,
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
    addProseMirrorPlugins() {
      const linkType = this.type;
      return [
        ...(this.parent?.() || []),
        new Plugin({
          key: new PluginKey('linkSpaceBreak'),
          appendTransaction(transactions, _oldState, newState) {
            if (!transactions.some(tr => tr.docChanged)) return null;

            const tr = newState.tr;
            let modified = false;

            newState.doc.descendants((node, pos) => {
              if (!node.isText) return;
              const mark = linkType.isInSet(node.marks);
              if (!mark || !node.text) return;

              const text = node.text;

              // Strip leading spaces at the start of a link range
              if (text[0] === ' ') {
                const $pos = newState.doc.resolve(pos);
                const before = $pos.nodeBefore;
                const isLinkStart = !before || !linkType.isInSet(before.marks);
                if (isLinkStart) {
                  let i = 0;
                  while (i < text.length && text[i] === ' ') i++;
                  tr.removeMark(pos, pos + i, linkType);
                  modified = true;
                }
              }
            });

            return modified ? tr : null;
          },
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
      Image.configure({
        HTMLAttributes: {
          class: 'editor-image',
        },
        allowBase64: false,
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-list-item',
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your thoughts...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[60vh] leading-relaxed transition-colors duration-200 [&_li]:!my-1 [&_li>p]:!m-0 [&_li>ul]:!m-0 [&_li>ol]:!m-0 [&_ul]:!my-0 [&_ol]:!my-0 prose-headings:text-stone-800 dark:prose-headings:text-stone-100 prose-p:text-stone-700 dark:prose-p:text-stone-200 prose-a:text-stone-700 dark:prose-a:text-stone-300 prose-a:underline hover:prose-a:text-stone-800 dark:hover:prose-a:text-stone-200 prose-strong:text-stone-800 dark:prose-strong:text-stone-100 prose-ul:text-stone-700 dark:prose-ul:text-stone-200 prose-ol:text-stone-700 dark:prose-ol:text-stone-200',
      },
      clipboardTextSerializer: (slice) => {
        const schema = slice.content.firstChild?.type.schema;
        if (!schema) return '';
        const div = document.createElement('div');
        div.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(slice.content));
        return htmlToMarkdown(div.innerHTML);
      },
    },
    editable: !isShared,
    onUpdate: ({ editor }) => {
      if (!isShared) {
        save(editor.getHTML());
      }
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    if (!editor || isShared) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;

      // Cmd/Ctrl + K: Open link modal
      if (isMod && event.key === 'k') {
        event.preventDefault();
        toolbarRef.current?.openLinkModal();
        return;
      }

      // Cmd/Ctrl + U: Toggle underline
      if (isMod && event.key === 'u') {
        event.preventDefault();
        editor.chain().focus().toggleUnderline().run();
        return;
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('keydown', handleKeyDown);

    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, isShared]);

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
      <div ref={editorContainerRef} className="flex-1 py-4">
        <EditorContent editor={editor} />
        <LinkPreviewOverlay containerRef={editorContainerRef} />
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
            ) : !isOnline ? (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Saved locally
              </span>
            ) : (
              <span className="text-stone-600 dark:text-stone-400">Saved</span>
            )}
          </div>

          {/* Toolbar */}
          <div className="pointer-events-auto">
            <Toolbar ref={toolbarRef} editor={editor} noteId={noteId} />
          </div>
        </div>
      )}
    </div>
  );
};
