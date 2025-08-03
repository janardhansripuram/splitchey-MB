import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface BiometricSettings {
  enabled: boolean;
  type: 'fingerprint' | 'face' | 'both';
  requireOnAppOpen: boolean;
  requireOnSensitiveActions: boolean;
}

export interface BiometricResult {
  success: boolean;
  error?: string;
  type?: 'fingerprint' | 'face';
}

class BiometricAuth {
  private static instance: BiometricAuth;
  private isInitialized = false;

  static getInstance(): BiometricAuth {
    if (!BiometricAuth.instance) {
      BiometricAuth.instance = new BiometricAuth();
    }
    return BiometricAuth.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Check if device supports biometric authentication
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        console.log('Device does not support biometric authentication');
        return false;
      }

      // Check if biometric authentication is available
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        console.log('No biometric authentication is enrolled');
        return false;
      }

      this.isInitialized = true;
      console.log('Biometric authentication initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize biometric authentication:', error);
      return false;
    }
  }

  async isSupported(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric support:', error);
      return false;
    }
  }

  async getSupportedTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch (error) {
      console.error('Error getting supported authentication types:', error);
      return [];
    }
  }

  async authenticate(reason: string = 'Please authenticate to continue'): Promise<BiometricResult> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return {
          success: true,
          type: this.getBiometricType(result.authenticationType),
        };
      } else {
        return {
          success: false,
          error: this.getErrorMessage(result.error),
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  private getBiometricType(authenticationType: LocalAuthentication.AuthenticationType): 'fingerprint' | 'face' {
    switch (authenticationType) {
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        return 'fingerprint';
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        return 'face';
      default:
        return 'fingerprint';
    }
  }

  private getErrorMessage(error: LocalAuthentication.AuthenticationError): string {
    switch (error) {
      case LocalAuthentication.AuthenticationError.USER_CANCEL:
        return 'Authentication cancelled';
      case LocalAuthentication.AuthenticationError.USER_FALLBACK:
        return 'User chose fallback';
      case LocalAuthentication.AuthenticationError.SYSTEM_CANCEL:
        return 'System cancelled authentication';
      case LocalAuthentication.AuthenticationError.INVALID_CONTEXT:
        return 'Invalid context';
      case LocalAuthentication.AuthenticationError.NOT_AVAILABLE:
        return 'Biometric authentication not available';
      case LocalAuthentication.AuthenticationError.NOT_INTERACTIVE:
        return 'Authentication not interactive';
      case LocalAuthentication.AuthenticationError.PASSCODE_NOT_SET:
        return 'Passcode not set';
      case LocalAuthentication.AuthenticationError.NOT_ENROLLED:
        return 'No biometric authentication enrolled';
      case LocalAuthentication.AuthenticationError.LOCKOUT:
        return 'Too many failed attempts';
      case LocalAuthentication.AuthenticationError.LOCKOUT_PERMANENT:
        return 'Biometric authentication permanently locked';
      default:
        return 'Authentication failed';
    }
  }

  async getSettings(): Promise<BiometricSettings> {
    try {
      const settings = await AsyncStorage.getItem('biometric_settings');
      if (settings) {
        return JSON.parse(settings);
      }
    } catch (error) {
      console.error('Failed to get biometric settings:', error);
    }

    // Default settings
    return {
      enabled: false,
      type: 'both',
      requireOnAppOpen: false,
      requireOnSensitiveActions: true,
    };
  }

  async updateSettings(settings: Partial<BiometricSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem('biometric_settings', JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Failed to update biometric settings:', error);
    }
  }

  async isEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.enabled;
  }

  async requireOnAppOpen(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.requireOnAppOpen;
  }

  async requireOnSensitiveActions(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.requireOnSensitiveActions;
  }

  // Authenticate for app opening
  async authenticateOnAppOpen(): Promise<BiometricResult> {
    const isEnabled = await this.isEnabled();
    const requireOnOpen = await this.requireOnAppOpen();

    if (!isEnabled || !requireOnOpen) {
      return { success: true };
    }

    return this.authenticate('Unlock ExpenseFlow');
  }

  // Authenticate for sensitive actions (delete, edit, etc.)
  async authenticateForSensitiveAction(action: string): Promise<BiometricResult> {
    const isEnabled = await this.isEnabled();
    const requireOnActions = await this.requireOnSensitiveActions();

    if (!isEnabled || !requireOnActions) {
      return { success: true };
    }

    return this.authenticate(`Authenticate to ${action}`);
  }

  // Get biometric type for current device
  async getDeviceBiometricType(): Promise<'fingerprint' | 'face' | 'both'> {
    try {
      const supportedTypes = await this.getSupportedTypes();
      
      const hasFingerprint = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
      const hasFace = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);

      if (hasFingerprint && hasFace) {
        return 'both';
      } else if (hasFace) {
        return 'face';
      } else if (hasFingerprint) {
        return 'fingerprint';
      } else {
        return 'fingerprint'; // Default fallback
      }
    } catch (error) {
      console.error('Error getting device biometric type:', error);
      return 'fingerprint';
    }
  }

  // Check if biometric is available and enrolled
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }
}

export const biometricAuth = BiometricAuth.getInstance();
export default biometricAuth; 