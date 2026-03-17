const QUEUE_KEY = 'elsendo-offline-queue';

export interface OfflineEntry {
  content: string;
  title: string | null;
  updatedAt: string;       // ISO timestamp of the local edit
  serverUpdatedAt: string;  // server's updated_at when we last loaded the note
}

export type OfflineQueue = Record<string, OfflineEntry>;

export function getOfflineQueue(): OfflineQueue {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveToOfflineQueue(
  noteId: string,
  entry: OfflineEntry,
): void {
  try {
    const queue = getOfflineQueue();
    queue[noteId] = entry;
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    // QuotaExceededError — caller should handle
    console.error('Failed to save to offline queue:', e);
    throw e;
  }
}

export function removeFromOfflineQueue(noteId: string): void {
  const queue = getOfflineQueue();
  delete queue[noteId];
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function hasOfflineChanges(): boolean {
  return Object.keys(getOfflineQueue()).length > 0;
}
