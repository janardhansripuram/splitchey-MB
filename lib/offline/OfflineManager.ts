import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export interface OfflineExpense {
  id: string;
  userId: string;
  paidById: string;
  paidByName: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  notes?: string;
  receiptUrl?: string;
  createdAt: string;
  groupId?: string;
  groupName?: string;
  isRecurring?: boolean;
  recurrence?: string;
  recurrenceEndDate?: string;
  tags?: string[];
  isSplitShare?: boolean;
  lastInstanceCreated?: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  lastModified: number;
}

export interface OfflineIncome {
  id: string;
  userId: string;
  source: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  isRecurring?: boolean;
  recurrence?: string;
  recurrenceEndDate?: string;
  lastInstanceCreated?: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  lastModified: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'expense' | 'income' | 'group' | 'friend';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
}

class OfflineManager {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private listeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    this.setupNetworkListener();
  }

  private setupNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (wasOnline !== this.isOnline) {
        this.notifyListeners(this.isOnline);
        
        if (this.isOnline && !this.syncInProgress) {
          this.syncPendingData();
        }
      }
    });
  }

  public addNetworkListener(listener: (isOnline: boolean) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach(listener => listener(isOnline));
  }

  public getNetworkStatus(): boolean {
    return this.isOnline;
  }

  // Expense Operations
  public async saveExpenseOffline(expense: Omit<OfflineExpense, 'id' | 'syncStatus' | 'lastModified'>): Promise<string> {
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const offlineExpense: OfflineExpense = {
      ...expense,
      id,
      syncStatus: 'pending',
      lastModified: Date.now(),
    };

    const expenses = await this.getOfflineExpenses(expense.userId);
    expenses.push(offlineExpense);
    await AsyncStorage.setItem(`offline_expenses_${expense.userId}`, JSON.stringify(expenses));
    
    return id;
  }

  public async getOfflineExpenses(userId: string): Promise<OfflineExpense[]> {
    try {
      const data = await AsyncStorage.getItem(`offline_expenses_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting offline expenses:', error);
      return [];
    }
  }

  public async updateExpenseSyncStatus(id: string, status: 'synced' | 'failed') {
    // This would update the sync status in AsyncStorage
    // For simplicity, we'll just remove synced items
    if (status === 'synced') {
      // Remove from offline storage when synced
      // Implementation would depend on how you want to handle this
    }
  }

  public async deleteOfflineExpense(id: string) {
    // Implementation to remove expense from AsyncStorage
    // This would need to iterate through all users' offline expenses
  }

  // Income Operations
  public async saveIncomeOffline(income: Omit<OfflineIncome, 'id' | 'syncStatus' | 'lastModified'>): Promise<string> {
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const offlineIncome: OfflineIncome = {
      ...income,
      id,
      syncStatus: 'pending',
      lastModified: Date.now(),
    };

    const incomes = await this.getOfflineIncome(income.userId);
    incomes.push(offlineIncome);
    await AsyncStorage.setItem(`offline_income_${income.userId}`, JSON.stringify(incomes));
    
    return id;
  }

  public async getOfflineIncome(userId: string): Promise<OfflineIncome[]> {
    try {
      const data = await AsyncStorage.getItem(`offline_income_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting offline income:', error);
      return [];
    }
  }

  // Cache Operations
  public async cacheUserData(key: string, data: any): Promise<void> {
    const cacheData = {
      data: JSON.stringify(data),
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
  }

  public async getCachedUserData(key: string): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(`cache_${key}`);
      if (!cached) return null;
      
      const cacheData = JSON.parse(cached);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (Date.now() - cacheData.timestamp > maxAge) {
        await AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }
      
      return JSON.parse(cacheData.data);
    } catch (error) {
      console.error('Error reading cached data:', error);
      return null;
    }
  }

  public async clearCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith('cache_'));
    await AsyncStorage.multiRemove(cacheKeys);
  }

  // Sync Queue Operations
  public async addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const syncItem: SyncQueueItem = { ...item, id };

    const queue = await this.getSyncQueue();
    queue.push(syncItem);
    await AsyncStorage.setItem('sync_queue', JSON.stringify(queue));
  }

  public async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const data = await AsyncStorage.getItem('sync_queue');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting sync queue:', error);
      return [];
    }
  }

  public async removeFromSyncQueue(id: string): Promise<void> {
    const queue = await this.getSyncQueue();
    const filteredQueue = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem('sync_queue', JSON.stringify(filteredQueue));
  }

  public async updateSyncQueueRetryCount(id: string, retryCount: number): Promise<void> {
    const queue = await this.getSyncQueue();
    const updatedQueue = queue.map(item => 
      item.id === id ? { ...item, retryCount } : item
    );
    await AsyncStorage.setItem('sync_queue', JSON.stringify(updatedQueue));
  }

  // Sync Operations
  public async syncPendingData(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    try {
      const syncQueue = await this.getSyncQueue();
      
      for (const item of syncQueue) {
        try {
          await this.processSyncItem(item);
          await this.removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Sync error for item:', item.id, error);
          
          const newRetryCount = item.retryCount + 1;
          if (newRetryCount < 3) {
            await this.updateSyncQueueRetryCount(item.id, newRetryCount);
          } else {
            await this.removeFromSyncQueue(item.id);
          }
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    // This would integrate with your Firebase functions
    // For now, we'll just mark offline items as synced
    switch (item.type) {
      case 'expense':
        if (item.action === 'create') {
          await this.updateExpenseSyncStatus(item.data.id, 'synced');
        }
        break;
      case 'income':
        if (item.action === 'create') {
          // Handle income sync
        }
        break;
      // Add other types as needed
    }
  }

  // Utility Methods
  public async getPendingSyncCount(): Promise<number> {
    const syncQueue = await this.getSyncQueue();
    return syncQueue.length;
  }

  public async clearAllOfflineData(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const offlineKeys = keys.filter(key => 
      key.startsWith('offline_') || 
      key.startsWith('sync_') || 
      key.startsWith('cache_')
    );
    await AsyncStorage.multiRemove(offlineKeys);
  }

  // Cache existing expenses for offline viewing
  public async cacheExpensesForOffline(userId: string, expenses: any[]): Promise<void> {
    try {
      const cacheKey = `cached_expenses_${userId}`;
      const cacheData = {
        expenses: expenses,
        timestamp: Date.now(),
        count: expenses.length,
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('[OfflineManager] Cached', expenses.length, 'expenses for offline viewing');
    } catch (error) {
      console.error('[OfflineManager] Failed to cache expenses:', error);
      throw error;
    }
  }

  // Get cached expenses for offline viewing
  public async getCachedExpenses(userId: string): Promise<any[]> {
    try {
      const cacheKey = `cached_expenses_${userId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return [];
      
      const cacheData = JSON.parse(cached);
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (Date.now() - cacheData.timestamp > maxAge) {
        await AsyncStorage.removeItem(cacheKey);
        return [];
      }
      
      return cacheData.expenses || [];
    } catch (error) {
      console.error('[OfflineManager] Failed to get cached expenses:', error);
      return [];
    }
  }
}

export const offlineManager = new OfflineManager();
export default offlineManager; 