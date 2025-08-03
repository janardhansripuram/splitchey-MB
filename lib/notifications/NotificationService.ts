import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationSettings {
  expenseReminders: boolean;
  budgetAlerts: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  reminderTime: string; // "09:00" format
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  data?: any;
  trigger: any;
  type: 'expense_reminder' | 'budget_alert' | 'weekly_report' | 'monthly_report';
}

class NotificationService {
  private static instance: NotificationService;
  private isInitialized = false;
  private pushToken: string | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        // Still mark as initialized for local notifications
        this.isInitialized = true;
        return;
      }

      // Get push token for remote notifications (only if device and Firebase is configured)
      if (Device.isDevice) {
        try {
          // Check if we have a valid project ID
          const projectId = await this.getProjectId();
          
          if (projectId) {
            const token = await Notifications.getExpoPushTokenAsync({
              projectId: projectId,
            });
            console.log('Push token:', token.data);
            this.pushToken = token.data;
            await this.savePushToken(token.data);
          } else {
            console.log('No valid project ID found, skipping push token generation');
          }
        } catch (error) {
          console.log('Failed to get push token (this is normal if Firebase is not configured):', (error as Error).message);
          // Don't fail initialization for push token issues
        }
      }

      // Set notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      this.isInitialized = true;
      console.log('Notification service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize notification service:', (error as Error).message);
      // Mark as initialized even if there are errors, so local notifications still work
      this.isInitialized = true;
    }
  }

  private async getProjectId(): Promise<string | null> {
    try {
      // Read from Firebase config file
      const config = require('../config/firebase.json');
      return config.projectId;
    } catch (error) {
      console.log('No Firebase config found:', (error as Error).message);
      return null;
    }
  }

  private async savePushToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('push_token', token);
    } catch (error) {
      console.error('Failed to save push token:', error);
    }
  }

  async getPushToken(): Promise<string | null> {
    try {
      if (this.pushToken) {
        return this.pushToken;
      }
      return await AsyncStorage.getItem('push_token');
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  // Schedule daily expense reminder
  async scheduleExpenseReminder(time: string = '20:00'): Promise<string | null> {
    try {
      const [hour, minute] = time.split(':').map(Number);
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📝 Daily Expense Reminder',
          body: 'Don\'t forget to log your expenses for today!',
          data: { type: 'expense_reminder' },
          sound: true,
        },
        trigger: {
          hour,
          minute,
          repeats: true,
        },
      });

      console.log('Scheduled expense reminder:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule expense reminder:', error);
      return null;
    }
  }

  // Schedule budget alert
  async scheduleBudgetAlert(category: string, currentAmount: number, budgetAmount: number): Promise<string | null> {
    try {
      const percentage = (currentAmount / budgetAmount) * 100;
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Budget Alert',
          body: `You've spent ${percentage.toFixed(1)}% of your ${category} budget (${currentAmount}/${budgetAmount})`,
          data: { 
            type: 'budget_alert',
            category,
            currentAmount,
            budgetAmount,
            percentage,
          },
          sound: true,
        },
        trigger: {
          seconds: 1, // Show immediately
        },
      });

      console.log('Scheduled budget alert:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule budget alert:', error);
      return null;
    }
  }

  // Schedule weekly spending report
  async scheduleWeeklyReport(): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📊 Weekly Spending Report',
          body: 'Check out your spending summary for last week!',
          data: { type: 'weekly_report' },
          sound: true,
        },
        trigger: {
          weekday: 1, // Monday
          hour: 9,
          minute: 0,
          repeats: true,
        },
      });

      console.log('Scheduled weekly report:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule weekly report:', error);
      return null;
    }
  }

  // Schedule monthly spending report
  async scheduleMonthlyReport(): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📈 Monthly Spending Report',
          body: 'Your monthly spending summary is ready!',
          data: { type: 'monthly_report' },
          sound: true,
        },
        trigger: {
          day: 1, // First day of month
          hour: 9,
          minute: 0,
          repeats: true,
        },
      });

      console.log('Scheduled monthly report:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule monthly report:', error);
      return null;
    }
  }

  // Cancel specific notification
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('Cancelled notification:', notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('Cancelled all notifications');
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  // Get all scheduled notifications
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to get scheduled notifications:', error);
      return [];
    }
  }

  // Send immediate notification (for testing)
  async sendImmediateNotification(title: string, body: string, data?: any): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: { seconds: 1 },
      });
    } catch (error) {
      console.error('Failed to send immediate notification:', error);
    }
  }

  // Update notification settings
  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      const currentSettings = await this.getNotificationSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem('notification_settings', JSON.stringify(updatedSettings));
      
      // Apply settings
      if (settings.expenseReminders !== undefined) {
        if (settings.expenseReminders) {
          await this.scheduleExpenseReminder(updatedSettings.reminderTime);
        } else {
          // Cancel expense reminders
          const notifications = await this.getScheduledNotifications();
          notifications.forEach(notification => {
            if (notification.content.data?.type === 'expense_reminder') {
              this.cancelNotification(notification.identifier);
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  }

  // Get notification settings
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const settings = await AsyncStorage.getItem('notification_settings');
      if (settings) {
        return JSON.parse(settings);
      }
    } catch (error) {
      console.error('Failed to get notification settings:', error);
    }

    // Default settings
    return {
      expenseReminders: true,
      budgetAlerts: true,
      weeklyReports: false,
      monthlyReports: false,
      reminderTime: '20:00',
      soundEnabled: true,
      vibrationEnabled: true,
    };
  }

  // Check if push notifications are available
  async isPushNotificationsAvailable(): Promise<boolean> {
    return this.pushToken !== null;
  }
}

export const notificationService = NotificationService.getInstance();
export default notificationService; 