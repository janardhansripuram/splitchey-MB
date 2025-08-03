import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CameraSettings {
  enabled: boolean;
  autoSaveToGallery: boolean;
  imageQuality: 'low' | 'medium' | 'high';
  flashMode: 'off' | 'on' | 'auto';
  cameraType: 'front' | 'back';
}

export interface ReceiptData {
  id: string;
  imageUri: string;
  amount?: number;
  merchant?: string;
  date?: Date;
  category?: string;
  items?: string[];
  confidence: number;
  createdAt: Date;
}

class CameraService {
  private settings: CameraSettings = {
    enabled: false,
    autoSaveToGallery: true,
    imageQuality: 'medium',
    flashMode: 'auto',
    cameraType: 'back'
  };

  async initialize(): Promise<void> {
    try {
      // Request media library permissions
      const mediaStatus = await MediaLibrary.requestPermissionsAsync();
      if (mediaStatus.status !== 'granted') {
        console.warn('Media library permission not granted');
      }

      // Load settings
      await this.loadSettings();
      console.log('Camera service initialized');
    } catch (error) {
      console.error('Failed to initialize camera service:', error);
      throw error;
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const mediaStatus = await MediaLibrary.requestPermissionsAsync();
      return mediaStatus.status === 'granted';
    } catch (error) {
      console.error('Failed to request permissions:', error);
      return false;
    }
  }

  async hasPermissions(): Promise<boolean> {
    try {
      const mediaStatus = await MediaLibrary.getPermissionsAsync();
      return mediaStatus.status === 'granted';
    } catch (error) {
      console.error('Failed to check permissions:', error);
      return false;
    }
  }

  async takePhoto(): Promise<string | null> {
    try {
      if (!this.settings.enabled) {
        throw new Error('Camera is disabled');
      }

      // This would be called from a camera component
      // For now, we'll simulate taking a photo
      console.log('Camera photo taken');
      return null;
    } catch (error) {
      console.error('Failed to take photo:', error);
      return null;
    }
  }

  async processReceipt(imageUri: string): Promise<ReceiptData> {
    try {
      // Simulate image optimization
      const optimizedImage = {
        uri: imageUri,
        width: 1024,
        height: 768,
      };

      // Simulate OCR processing
      const receiptData: ReceiptData = {
        id: Date.now().toString(),
        imageUri: optimizedImage.uri,
        amount: Math.random() * 100 + 10, // Simulated amount
        merchant: 'Sample Store',
        date: new Date(),
        category: 'Food & Dining',
        items: ['Item 1', 'Item 2'],
        confidence: 0.85,
        createdAt: new Date()
      };

      // Save receipt data
      await this.saveReceiptData(receiptData);

      return receiptData;
    } catch (error) {
      console.error('Failed to process receipt:', error);
      throw error;
    }
  }

  async saveReceiptData(receipt: ReceiptData): Promise<void> {
    try {
      const receipts = await this.getReceiptHistory();
      receipts.unshift(receipt);
      
      // Keep only last 50 receipts
      if (receipts.length > 50) {
        receipts.splice(50);
      }

      await AsyncStorage.setItem('receipt_history', JSON.stringify(receipts));
    } catch (error) {
      console.error('Failed to save receipt data:', error);
    }
  }

  async getReceiptHistory(): Promise<ReceiptData[]> {
    try {
      const data = await AsyncStorage.getItem('receipt_history');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get receipt history:', error);
      return [];
    }
  }

  async getSettings(): Promise<CameraSettings> {
    return this.settings;
  }

  async updateSettings(updates: Partial<CameraSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  async clearReceiptHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem('receipt_history');
    } catch (error) {
      console.error('Failed to clear receipt history:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('camera_settings');
      if (data) {
        this.settings = { ...this.settings, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load camera settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('camera_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save camera settings:', error);
    }
  }
}

export default new CameraService(); 