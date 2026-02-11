import React, { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListTodo,
  Link as LinkIcon,
  Unlink,
  X,
  Check,
  Download,
  Share2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ShareModal } from '../src/components/ShareModal';
import { useNotes } from '../src/hooks/useNotes';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

export const Toolbar: React.FC<ToolbarProps> = ({ editor, noteId }) => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [currentLinkUrl, setCurrentLinkUrl] = useState('');
  const [savedSelection, setSavedSelection] = useState<{ from: number; to: number } | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const { createShareLink } = useNotes();

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

  const openLinkModal = () => {
    const { from, to } = editor.state.selection;
    setSavedSelection({ from, to });

    const previousUrl = editor.getAttributes('link').href;
    setCurrentLinkUrl(previousUrl || '');
    setIsLinkModalOpen(true);
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

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
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
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          icon={List}
          label="Bullet List"
        />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          icon={ListTodo}
          label="Task List"
        />

        {editor.isActive('link') ? (
          <ToolbarButton
            onClick={removeLink}
            isActive={true}
            icon={Unlink}
            label="Remove Link"
          />
        ) : (
          <ToolbarButton
            onClick={openLinkModal}
            isActive={false}
            icon={LinkIcon}
            label="Add Link"
          />
        )}

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
    </>
  );
};
