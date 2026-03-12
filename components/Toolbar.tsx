import React, { useState, useEffect, useRef, useImperativeHandle, memo } from 'react';
import { Editor } from '@tiptap/react';
import { findParentNode } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListTodo,
  Link as LinkIcon,
  X,
  Check,
  Download,
  Share2,
  Pencil,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ShareModal } from '../src/components/ShareModal';
import { useNotes } from '../src/contexts/NotesContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert only the current list item to another list type
function convertSingleItem(editor: Editor, fromType: 'taskList' | 'bulletList', toType: 'taskList' | 'bulletList') {
  const { state } = editor;
  const { schema, selection } = state;
  let { tr } = state;

  const toListType = schema.nodes[toType];
  const fromItemType = fromType === 'taskList' ? schema.nodes.taskItem : schema.nodes.listItem;
  const toItemType = toType === 'taskList' ? schema.nodes.taskItem : schema.nodes.listItem;

  if (!toListType || !toItemType) return false;

  // Find the current list item
  const listItemResult = findParentNode(node => node.type === fromItemType)(selection);
  if (!listItemResult) return false;

  // Find the parent list
  const listResult = findParentNode(node => node.type.name === fromType)(selection);
  if (!listResult) return false;

  const { node: listNode, pos: listPos } = listResult;
  const { node: itemNode, pos: itemPos } = listItemResult;

  // Find the index of current item in the list
  let itemIndex = -1;
  let currentPos = listPos + 1;
  listNode.forEach((child: ProseMirrorNode, _offset: number, index: number) => {
    if (currentPos === itemPos) {
      itemIndex = index;
    }
    currentPos += child.nodeSize;
  });

  if (itemIndex === -1) return false;

  // Convert the single item
  const newAttrs = toType === 'taskList' ? { checked: false } : {};
  const newItem = toItemType.create(newAttrs, itemNode.content);
  const newList = toListType.create(null, [newItem]);

  // Build the replacement: items before + converted item + items after
  const fragments: ProseMirrorNode[] = [];
  const fromListType = schema.nodes[fromType];

  // Items before current
  if (itemIndex > 0) {
    const beforeItems: ProseMirrorNode[] = [];
    listNode.forEach((child: ProseMirrorNode, _offset: number, index: number) => {
      if (index < itemIndex) beforeItems.push(child);
    });
    if (beforeItems.length > 0) {
      fragments.push(fromListType.create(null, beforeItems));
    }
  }

  // The converted item
  fragments.push(newList);

  // Items after current
  if (itemIndex < listNode.childCount - 1) {
    const afterItems: ProseMirrorNode[] = [];
    listNode.forEach((child: ProseMirrorNode, _offset: number, index: number) => {
      if (index > itemIndex) afterItems.push(child);
    });
    if (afterItems.length > 0) {
      fragments.push(fromListType.create(null, afterItems));
    }
  }

  // Replace the entire list with the fragments
  const fragment = schema.nodes.doc.create(null, fragments).content;
  tr = tr.replaceWith(listPos, listPos + listNode.nodeSize, fragment);

  editor.view.dispatch(tr);
  return true;
}

interface ToolbarProps {
  editor: Editor | null;
  noteId?: string;
}

const LinkModal = ({
  isOpen,
  onClose,
  onSave,
  initialUrl
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
  initialUrl: string;
}) => {
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl || '');
    }
  }, [isOpen, initialUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/20 dark:bg-stone-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl w-full max-w-sm border border-stone-200 dark:border-stone-700 overflow-hidden animate-scale-in">
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-700 flex justify-between items-center">
          <span className="text-lg font-medium text-stone-800 dark:text-stone-100">Insert Link</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-5">
          <label className="block text-xs font-semibold text-stone-400 dark:text-stone-400 mb-2 uppercase tracking-wide">URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            autoFocus
            className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-700 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400/50 focus:border-stone-400 transition-all text-sm mb-5"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                onSave(url);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(url)}
              className="px-4 py-2.5 text-sm font-medium bg-stone-800 hover:bg-stone-700 text-white rounded-xl transition-all shadow hover:shadow-md flex items-center gap-2 active:scale-[0.98]"
            >
              <Check className="w-4 h-4" strokeWidth={2} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LinkMenu = ({
  isOpen,
  onClose,
  onEdit,
  onRemove,
  onOpen,
  url,
  position
}: {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onOpen: () => void;
  url: string;
  position: { top: number; left: number };
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const actions = [
    { label: 'Open Link', icon: ExternalLink, onClick: onOpen, isDestructive: false },
    { label: 'Edit Link', icon: Pencil, onClick: onEdit, isDestructive: false },
    { label: 'Remove Link', icon: Trash2, onClick: onRemove, isDestructive: true },
  ];

  useEffect(() => {
    if (!isOpen) return;

    // Reset and focus first item when menu opens
    setFocusedIndex(0);
    setTimeout(() => buttonRefs.current[0]?.focus(), 0);

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        setFocusedIndex(i => {
          const next = (i + 1) % actions.length;
          buttonRefs.current[next]?.focus();
          return next;
        });
        break;
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        setFocusedIndex(i => {
          const prev = (i - 1 + actions.length) % actions.length;
          buttonRefs.current[prev]?.focus();
          return prev;
        });
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  // Adjust position to stay within viewport
  const adjustedLeft = Math.min(position.left, window.innerWidth - 220);
  const adjustedTop = Math.min(position.top, window.innerHeight - 160);

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] animate-scale-in"
      style={{ top: adjustedTop, left: adjustedLeft }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-stone-800 rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 overflow-hidden w-52">
        <div className="px-3 py-2 border-b border-stone-100 dark:border-stone-700">
          <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{url}</p>
        </div>
        <div className="p-1">
          {actions.map((action, index) => (
            <button
              key={action.label}
              ref={el => buttonRefs.current[index] = el}
              onClick={action.onClick}
              className={cn(
                "w-full px-3 py-2 text-sm text-left rounded-lg flex items-center gap-2 transition-colors outline-none",
                action.isDestructive
                  ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 focus:bg-red-50 dark:focus:bg-red-900/30"
                  : "text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 focus:bg-stone-100 dark:focus:bg-stone-700"
              )}
            >
              <action.icon className="w-4 h-4" strokeWidth={2} />
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export interface ToolbarHandle {
  openLinkModal: () => void;
}

export const Toolbar = React.forwardRef<ToolbarHandle, ToolbarProps>(({ editor, noteId }, ref) => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
  const [linkMenuPosition, setLinkMenuPosition] = useState({ top: 0, left: 0 });
  const [currentLinkUrl, setCurrentLinkUrl] = useState('');
  const [savedSelection, setSavedSelection] = useState<{ from: number; to: number } | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const { createShareLink } = useNotes();

  // Track the last known selection - updated on every selection change
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const { from, to } = editor.state.selection;
      lastSelectionRef.current = { from, to };
    };

    // Update on selection changes
    editor.on('selectionUpdate', updateSelection);
    // Also capture initial selection
    updateSelection();

    return () => {
      editor.off('selectionUpdate', updateSelection);
    };
  }, [editor]);

  const openLinkModal = () => {
    if (!editor) return;
    // Use the last tracked selection (captured before toolbar click could clear it)
    const selection = lastSelectionRef.current || editor.state.selection;
    const { from, to } = selection;

    setSavedSelection({ from, to });

    const previousUrl = editor.getAttributes('link').href;
    setCurrentLinkUrl(previousUrl || '');

    // If on a link, show the link menu instead
    if (editor.isActive('link') && previousUrl) {
      const { view } = editor;
      const coords = view.coordsAtPos(from);
      setLinkMenuPosition({ top: coords.bottom + 8, left: coords.left });
      setIsLinkMenuOpen(true);
    } else {
      setIsLinkModalOpen(true);
    }
  };

  // Expose openLinkModal to parent via ref
  useImperativeHandle(ref, () => ({
    openLinkModal
  }), [editor]);

  if (!editor) {
    return null;
  }

  const handleShare = async () => {
    if (!noteId) return;

    const shareToken = await createShareLink(noteId);
    if (shareToken) {
      const url = `${window.location.origin}/shared/${shareToken}`;
      setShareUrl(url);
      setIsShareModalOpen(true);
    }
  };

  const closeLinkModal = () => {
    setIsLinkModalOpen(false);
    if (savedSelection) {
      editor.commands.setTextSelection(savedSelection);
      editor.commands.focus();
    }
    setSavedSelection(null);
  };

  const handleLinkSave = (url: string) => {
    if (savedSelection) {
      editor.commands.setTextSelection(savedSelection);
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      let finalUrl = url;
      if (finalUrl !== '' && !/^https?:\/\//i.test(finalUrl) && !/^mailto:/i.test(finalUrl) && !finalUrl.startsWith('/')) {
         finalUrl = 'https://' + finalUrl;
      }

      if (editor.isActive('link')) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
      } else {
        editor.chain().focus().setLink({ href: finalUrl }).run();
      }
    }
    setIsLinkModalOpen(false);
    setSavedSelection(null);
  };

  const handleLinkMenuEdit = () => {
    setIsLinkMenuOpen(false);
    setIsLinkModalOpen(true);
  };

  const handleLinkMenuRemove = () => {
    setIsLinkMenuOpen(false);
    if (savedSelection) {
      editor.commands.setTextSelection(savedSelection);
    }
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setSavedSelection(null);
  };

  const handleLinkMenuOpen = () => {
    setIsLinkMenuOpen(false);
    if (currentLinkUrl) {
      window.open(currentLinkUrl, '_blank', 'noopener,noreferrer');
    }
    if (savedSelection) {
      editor.commands.setTextSelection(savedSelection);
      editor.commands.focus();
    }
    setSavedSelection(null);
  };

  const closeLinkMenu = () => {
    setIsLinkMenuOpen(false);
    if (savedSelection) {
      editor.commands.setTextSelection(savedSelection);
      editor.commands.focus();
    }
    setSavedSelection(null);
  };

  const downloadMarkdown = () => {
    const html = editor.getHTML();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const convertNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }

      const children = Array.from(node.childNodes).map(convertNode).join('');

      switch ((node as HTMLElement).tagName) {
        case 'H1': return `\n# ${children}\n`;
        case 'H2': return `\n## ${children}\n`;
        case 'P': return `\n${children}\n`;
        case 'STRONG':
        case 'B': return `**${children}**`;
        case 'EM':
        case 'I': return `*${children}*`;
        case 'U': return `<u>${children}</u>`;
        case 'UL': {
          const element = node as HTMLElement;
          const isTaskList = element.getAttribute('data-type') === 'taskList';
          return `\n${children}\n`;
        }
        case 'OL': return `\n${children}\n`;
        case 'LI': {
          const parent = node.parentNode as HTMLElement;
          const element = node as HTMLElement;
          const isTaskList = parent && parent.getAttribute('data-type') === 'taskList';
          const isOrdered = parent && parent.tagName === 'OL';

          if (isTaskList) {
            const isChecked = element.getAttribute('data-checked') === 'true';
            return `- [${isChecked ? 'x' : ' '}] ${children}\n`;
          }
          if (isOrdered) {
             const index = Array.from(parent.children).indexOf(node as Element) + 1;
             return `${index}. ${children}\n`;
          }
          return `* ${children}\n`;
        }
        case 'A': return `[${children}](${(node as HTMLAnchorElement).getAttribute('href')})`;
        case 'BR': return '\n';
        default: return children;
      }
    };

    let markdown = convertNode(doc.body).trim();
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    const firstHeading = doc.querySelector('h1, h2')?.textContent;
    const fileName = (firstHeading || 'elsendo-note')
      .slice(0, 30)
      .trim()
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase();

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const ToolbarButton = ({
    onClick,
    isActive,
    icon: Icon,
    label
  }: {
    onClick: () => void;
    isActive?: boolean;
    icon: React.ElementType;
    label: string;
  }) => (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center active:scale-95",
        isActive
          ? "bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200"
          : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700"
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={2} />
    </button>
  );

  const Divider = () => (
    <div className="w-px h-6 bg-stone-200 dark:bg-stone-700 mx-0.5" />
  );

  return (
    <>
      <div className="flex items-center gap-0 sm:gap-0.5 p-1.5 sm:p-2 bg-white/95 dark:bg-stone-800/95 backdrop-blur-md border border-stone-200/80 dark:border-stone-700/80 shadow-lg rounded-xl sm:rounded-2xl transition-colors duration-200">

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          icon={Heading1}
          label="Heading 1"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          icon={Heading2}
          label="Heading 2"
        />

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          icon={Bold}
          label="Bold"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          icon={Italic}
          label="Italic"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          icon={Underline}
          label="Underline"
        />

        <Divider />

        <ToolbarButton
          onClick={() => {
            if (editor.isActive('taskList')) {
              // Convert just this task item to a bullet
              convertSingleItem(editor, 'taskList', 'bulletList');
              editor.commands.focus();
            } else {
              editor.chain().focus().toggleBulletList().run();
            }
          }}
          isActive={editor.isActive('bulletList')}
          icon={List}
          label="Bullet List"
        />

        <ToolbarButton
          onClick={() => {
            if (editor.isActive('bulletList')) {
              // Convert just this bullet to a task item
              convertSingleItem(editor, 'bulletList', 'taskList');
              editor.commands.focus();
            } else {
              editor.chain().focus().toggleTaskList().run();
            }
          }}
          isActive={editor.isActive('taskList')}
          icon={ListTodo}
          label="Task List"
        />

        <ToolbarButton
          onClick={openLinkModal}
          isActive={editor.isActive('link')}
          icon={LinkIcon}
          label={editor.isActive('link') ? "Edit Link" : "Add Link"}
        />

        <Divider />

        {noteId && (
          <ToolbarButton
            onClick={handleShare}
            icon={Share2}
            label="Share Note"
          />
        )}

        <ToolbarButton
          onClick={downloadMarkdown}
          icon={Download}
          label="Download as Markdown"
        />
      </div>

      <LinkModal
        isOpen={isLinkModalOpen}
        onClose={closeLinkModal}
        onSave={handleLinkSave}
        initialUrl={currentLinkUrl}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareUrl={shareUrl}
      />

      <LinkMenu
        isOpen={isLinkMenuOpen}
        onClose={closeLinkMenu}
        onEdit={handleLinkMenuEdit}
        onRemove={handleLinkMenuRemove}
        onOpen={handleLinkMenuOpen}
        url={currentLinkUrl}
        position={linkMenuPosition}
      />
    </>
  );
});
