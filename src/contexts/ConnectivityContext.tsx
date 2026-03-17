import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface ConnectivityContextType {
  isOnline: boolean;
  isSyncing: boolean;
  setIsSyncing: (v: boolean) => void;
}

const ConnectivityContext = createContext<ConnectivityContextType>({
  isOnline: true,
  isSyncing: false,
  setIsSyncing: () => {},
});

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      const { error } = await supabase.from('notes').select('id').limit(1);
      if (error) throw error;
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    const goOnline = () => {
      // Don't trust the browser event alone — verify with a real request
      checkConnection();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Periodic health check every 30s when browser says we're online
    pingIntervalRef.current = setInterval(() => {
      if (navigator.onLine) checkConnection();
    }, 30_000);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [checkConnection]);

  return (
    <ConnectivityContext.Provider value={{ isOnline, isSyncing, setIsSyncing }}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = () => useContext(ConnectivityContext);
