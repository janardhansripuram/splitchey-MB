import { useEffect, useState } from 'react';
import { offlineManager } from '../lib/offline/OfflineManager';

export interface OfflineState {
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncTime: number | null;
}

export const useOffline = () => {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: true,
    pendingSyncCount: 0,
    isSyncing: false,
    lastSyncTime: null,
  });

  useEffect(() => {
    // Initial network status check
    const checkInitialStatus = async () => {
      const isOnline = offlineManager.getNetworkStatus();
      const pendingCount = await offlineManager.getPendingSyncCount();
      
      setOfflineState(prev => ({
        ...prev,
        isOnline,
        pendingSyncCount: pendingCount,
      }));
    };

    checkInitialStatus();

    // Listen for network changes
    const unsubscribe = offlineManager.addNetworkListener((isOnline) => {
      setOfflineState(prev => ({
        ...prev,
        isOnline,
      }));

      // If coming back online, trigger sync
      if (isOnline) {
        triggerSync();
      }
    });

    return unsubscribe;
  }, []);

  const triggerSync = async () => {
    if (offlineState.isSyncing) return;

    setOfflineState(prev => ({ ...prev, isSyncing: true }));
    
    try {
      await offlineManager.syncPendingData();
      const pendingCount = await offlineManager.getPendingSyncCount();
      
      setOfflineState(prev => ({
        ...prev,
        isSyncing: false,
        pendingSyncCount: pendingCount,
        lastSyncTime: Date.now(),
      }));
    } catch (error) {
      console.error('Sync failed:', error);
      setOfflineState(prev => ({ ...prev, isSyncing: false }));
    }
  };

  const refreshPendingCount = async () => {
    const count = await offlineManager.getPendingSyncCount();
    setOfflineState(prev => ({ ...prev, pendingSyncCount: count }));
  };

  return {
    ...offlineState,
    triggerSync,
    refreshPendingCount,
    offlineManager,
  };
}; 