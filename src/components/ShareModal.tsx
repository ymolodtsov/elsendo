import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Link2, Link2Off, Share2 } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: () => Promise<string | null>;
  onRevoke: () => void;
  shareUrl: string | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, onShare, onRevoke, shareUrl }) => {
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCopied(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleShare = async () => {
    setIsCreating(true);
    await onShare();
    setIsCreating(false);
  };

  const isShared = !!shareUrl;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/20 dark:bg-stone-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl w-full max-w-md border border-stone-200 dark:border-stone-700 overflow-hidden animate-scale-in">
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-stone-200 dark:bg-stone-700 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-stone-600 dark:text-stone-300" strokeWidth={2} />
            </div>
            <span className="text-lg font-medium text-stone-800 dark:text-stone-100">
              Share Note
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5">
          {isShared ? (
            <>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
                Anyone with this link can view this note (read-only)
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-4 py-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-700 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400/50"
                />
                <button
                  onClick={handleCopy}
                  className={`px-4 py-3 rounded-xl transition-all shadow flex items-center gap-2 text-sm font-medium active:scale-[0.98] ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-stone-800 hover:bg-stone-700 text-white hover:shadow-md'
                  }`}
                  aria-label="Copy link"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" strokeWidth={2} />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" strokeWidth={2} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {copied && (
                <p className="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                  Link copied to clipboard!
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-700">
                <button
                  onClick={onRevoke}
                  className="w-full px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Link2Off className="w-4 h-4" strokeWidth={2} />
                  Stop sharing
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
                Create a public link so anyone can view this note (read-only). You can revoke the link at any time.
              </p>

              <button
                onClick={handleShare}
                disabled={isCreating}
                className="w-full px-4 py-3 text-sm font-medium bg-stone-800 hover:bg-stone-700 text-white rounded-xl transition-all shadow hover:shadow-md flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
              >
                <Share2 className="w-4 h-4" strokeWidth={2} />
                {isCreating ? 'Creating link...' : 'Create share link'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
