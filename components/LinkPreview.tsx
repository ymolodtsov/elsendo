import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../src/contexts/AuthContext';

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  author?: string;
  siteName?: string;
}

// Cache for link previews (bounded to prevent memory leaks)
const MAX_CACHE_SIZE = 100;
const previewCache = new Map<string, LinkPreviewData | null>();
const pendingRequests = new Map<string, Promise<LinkPreviewData | null>>();

async function fetchLinkPreview(url: string, accessToken?: string): Promise<LinkPreviewData | null> {
  if (previewCache.has(url)) {
    return previewCache.get(url) || null;
  }

  if (pendingRequests.has(url)) {
    return pendingRequests.get(url)!;
  }

  const promise = (async () => {
    try {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { headers });
      if (!response.ok) {
        previewCache.set(url, null);
        return null;
      }
      const data = await response.json();
      if (previewCache.size >= MAX_CACHE_SIZE) {
        // Evict oldest entry
        const firstKey = previewCache.keys().next().value;
        if (firstKey) previewCache.delete(firstKey);
      }
      previewCache.set(url, data);
      return data;
    } catch {
      previewCache.set(url, null);
      return null;
    } finally {
      pendingRequests.delete(url);
    }
  })();

  pendingRequests.set(url, promise);
  return promise;
}

interface LinkPreviewOverlayProps {
  containerRef: React.RefObject<HTMLElement>;
}

export const LinkPreviewOverlay: React.FC<LinkPreviewOverlayProps> = ({ containerRef }) => {
  const { session } = useAuth();
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number>();
  const currentHrefRef = useRef<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const hidePreview = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    currentHrefRef.current = null;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseOver = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement | null;

      if (!link) {
        // Check if we're hovering over the tooltip itself
        if (tooltipRef.current?.contains(target)) {
          return;
        }
        hidePreview();
        return;
      }

      const href = link.href;
      if (!href || !href.startsWith('http')) return;

      // Same link, don't refetch
      if (currentHrefRef.current === href) return;

      currentHrefRef.current = href;

      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Delay before showing preview
      timeoutRef.current = window.setTimeout(async () => {
        const data = await fetchLinkPreview(href, session?.access_token);

        // Check if we're still hovering the same link
        if (currentHrefRef.current !== href) return;

        if (data && (data.title || data.image)) {
          const rect = link.getBoundingClientRect();
          setPosition({
            top: rect.top,
            left: rect.right + 8,
          });
          setPreview(data);
          setIsVisible(true);
        }
      }, 400);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement | null;

      // Don't hide if moving to tooltip
      if (relatedTarget && tooltipRef.current?.contains(relatedTarget)) {
        return;
      }

      // Don't hide if moving to another link
      if (relatedTarget?.closest?.('a[href]')) {
        return;
      }

      hidePreview();
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [containerRef, hidePreview]);

  if (!isVisible || !preview) return null;

  // Adjust position to stay within viewport
  const adjustedLeft = Math.min(position.left, window.innerWidth - 280);
  const adjustedTop = Math.min(position.top, window.innerHeight - 200);

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed z-[9999] animate-fade-in pointer-events-auto"
      style={{
        top: adjustedTop,
        left: adjustedLeft,
      }}
      onMouseLeave={hidePreview}
    >
      <div className="w-64 bg-white dark:bg-stone-800 rounded-xl shadow-xl border border-stone-200/50 dark:border-stone-700/50 overflow-hidden">
        {preview.image && (
          <div className="w-full h-32 bg-stone-100 dark:bg-stone-700 overflow-hidden">
            <img
              src={preview.image}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="p-3">
          {preview.siteName && (
            <p className="text-xs text-stone-400 dark:text-stone-500 mb-1 truncate">
              {preview.siteName}
            </p>
          )}
          {preview.title && (
            <h4 className="text-sm font-medium text-stone-800 dark:text-stone-100 line-clamp-2 leading-snug">
              {preview.title}
            </h4>
          )}
          {preview.author && (
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              by {preview.author}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
