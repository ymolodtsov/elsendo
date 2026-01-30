import { useEffect, useRef, useState } from 'react';

interface UseAutoSaveOptions {
  onSave: (content: string) => Promise<void>;
  delay?: number; // debounce delay in milliseconds
}

export const useAutoSave = ({ onSave, delay = 1000 }: UseAutoSaveOptions) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveQueueRef = useRef<string | null>(null);

  const save = async (content: string) => {
    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Mark as not saved
    setIsSaved(false);

    // Store the content to save
    saveQueueRef.current = content;

    // Debounce the save
    timeoutRef.current = setTimeout(async () => {
      if (saveQueueRef.current !== null) {
        setIsSaving(true);
        try {
          await onSave(saveQueueRef.current);
          setIsSaved(true);
          saveQueueRef.current = null;
        } catch (error) {
          console.error('Auto-save error:', error);
          setIsSaved(false);
        } finally {
          setIsSaving(false);
        }
      }
    }, delay);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    save,
    isSaving,
    isSaved,
  };
};
