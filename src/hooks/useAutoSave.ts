import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutoSaveOptions {
  onSave: (content: string) => Promise<void>;
  delay?: number; // debounce delay in milliseconds
}

export const useAutoSave = ({ onSave, delay = 1000 }: UseAutoSaveOptions) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [showStatus, setShowStatus] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveQueueRef = useRef<string | null>(null);

  const save = useCallback(async (content: string) => {
    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Mark as not saved (but don't show the chip yet)
    setIsSaved(false);

    // Store the content to save
    saveQueueRef.current = content;

    // Debounce the save
    timeoutRef.current = setTimeout(async () => {
      if (saveQueueRef.current !== null) {
        setIsSaving(true);
        setShowStatus(true);
        // Clear any pending hide
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        try {
          await onSave(saveQueueRef.current);
          setIsSaved(true);
          saveQueueRef.current = null;
          // Hide the chip after a brief moment
          hideTimeoutRef.current = setTimeout(() => {
            setShowStatus(false);
          }, 1500);
        } catch (error) {
          console.error('Auto-save error:', error);
          setIsSaved(false);
        } finally {
          setIsSaving(false);
        }
      }
    }, delay);
  }, [onSave, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return {
    save,
    isSaving,
    isSaved,
    showStatus,
  };
};
