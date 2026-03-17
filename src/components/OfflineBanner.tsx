import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useConnectivity } from '../contexts/ConnectivityContext';

export const OfflineBanner: React.FC = () => {
  const { isOnline, isSyncing } = useConnectivity();

  if (isOnline && !isSyncing) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[70] flex justify-center pointer-events-none animate-fade-in">
      <div className="mt-3 px-4 py-2 rounded-full bg-amber-50/95 dark:bg-amber-900/40 backdrop-blur-md border border-amber-200/60 dark:border-amber-700/40 shadow-sm pointer-events-auto">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          {isSyncing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
              <span>Back online — syncing changes...</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" strokeWidth={2} />
              <span>You're offline — edits are saved locally</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
