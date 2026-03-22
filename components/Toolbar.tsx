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
  Copy,
  Share2,
  Pencil,
  ExternalLink,
  Trash2,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ShareModal } from '../src/components/ShareModal';
import { useNotes } from '../src/contexts/NotesContext';
import { useConnectivity } from '../src/contexts/ConnectivityContext';
import { htmlToMarkdown } from '../src/lib/htmlToMarkdown';
import { uploadImage } from '../src/lib/imageUpload';

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
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { getShareLink, createShareLink, revokeShareLink } = useNotes();
  const { isOnline } = useConnectivity();

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

    try {
      // Check for existing share link — open modal with or without URL
      const existingToken = await getShareLink(noteId);
      if (existingToken) {
        setShareUrl(`${window.location.origin}/shared/${existingToken}`);
      } else {
        setShareUrl('');
      }
      setIsShareModalOpen(true);
    } catch (err) {
      console.error('Failed to check share link:', err);
    }
  };

  const handleCreateShareLink = async (): Promise<string | null> => {
    if (!noteId) return null;
    const shareToken = await createShareLink(noteId);
    if (shareToken) {
      const url = `${window.location.origin}/shared/${shareToken}`;
      setShareUrl(url);
      return url;
    }
    return null;
  };

  const handleRevokeShare = async () => {
    if (!noteId) return;
    const success = await revokeShareLink(noteId);
    if (success) {
      setIsShareModalOpen(false);
      setShareUrl('');
    }
  };

  const closeLinkModal = () => {
    const scrollY = window.scrollY;
    setIsLinkModalOpen(false);
    if (savedSelection) {
      editor.commands.setTextSelection(savedSelection);
      editor.view.dom.focus({ preventScroll: true });
    }
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
    setSavedSelection(null);
  };

  const handleLinkSave = (url: string) => {
    const scrollY = window.scrollY;

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

    requestAnimationFrame(() => window.scrollTo(0, scrollY));
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

  const copyAsMarkdown = async () => {
    const html = editor.getHTML();
    const markdown = htmlToMarkdown(html);
    try {
      await navigator.clipboard.writeText(markdown);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 1500);
    } catch {
      // Clipboard permission denied — no toast
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    // Reset input so the same file can be selected again
    e.target.value = '';

    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const ToolbarButton = ({
    onClick,
    isActive,
    icon: Icon,
    label,
    disabled,
  }: {
    onClick: () => void;
    isActive?: boolean;
    icon: React.ElementType;
    label: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      className={cn(
        "p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center",
        disabled
          ? "text-stone-300 dark:text-stone-600 cursor-not-allowed"
          : isActive
            ? "bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200"
            : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 active:scale-95"
      )}
      title={label}
      aria-label={label}
    >
      <Icon className={cn("w-4 h-4 sm:w-[18px] sm:h-[18px]", disabled && label === 'Uploading...' && "animate-spin")} strokeWidth={2} />
    </button>
  );

  const Divider = () => (
    <div className="w-px h-6 bg-stone-200 dark:bg-stone-700 mx-0.5" />
  );

  return (
    <>
      <div className="flex items-center gap-0 sm:gap-0.5 p-1.5 sm:p-2 bg-white/95 dark:bg-stone-800/95 backdrop-blur-md border border-stone-200/80 dark:border-stone-700/80 shadow-lg rounded-xl sm:rounded-2xl transition-colors duration-200">

        {/* Formatting buttons — hidden on mobile (Markdown covers these) */}
        <div className="hidden sm:contents">
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


        </div>

        {/* Always-visible buttons (mobile + desktop) */}
        <ToolbarButton
          onClick={() => {
            if (editor.isActive('bulletList')) {
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
          onClick={() => isOnline && !isUploading && imageInputRef.current?.click()}
          icon={isUploading ? Loader2 : ImagePlus}
          label={!isOnline ? 'Connect to upload images' : isUploading ? 'Uploading...' : 'Add Image'}
          isActive={false}
          disabled={!isOnline || isUploading}
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
          onClick={copyAsMarkdown}
          icon={Copy}
          label="Copy as Markdown"
        />

        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageUpload}
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
        onShare={handleCreateShareLink}
        onRevoke={handleRevokeShare}
        shareUrl={shareUrl || null}
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

      {showCopiedToast && (
        <div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
          <div className="px-4 py-2 rounded-xl bg-stone-800 dark:bg-stone-700 text-white text-sm font-medium shadow-lg flex items-center gap-2">
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            Copied as Markdown
          </div>
        </div>
      )}
    </>
  );
});
