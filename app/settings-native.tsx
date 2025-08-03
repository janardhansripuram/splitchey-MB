import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { useTheme, Card, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import notificationService, { NotificationSettings } from '../lib/notifications/NotificationService';
import biometricAuth, { BiometricSettings } from '../lib/auth/BiometricAuth';
import cameraService, { CameraSettings } from '../lib/camera/CameraService';
import locationService, { LocationSettings } from '../lib/location/LocationService';
import shareService, { ShareSettings } from '../lib/share/ShareService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NativeSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { authUser } = useAuth();
  
  // State for settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [biometricSettings, setBiometricSettings] = useState<BiometricSettings | null>(null);
  const [cameraSettings, setCameraSettings] = useState<CameraSettings | null>(null);
  const [locationSettings, setLocationSettings] = useState<LocationSettings | null>(null);
  const [shareSettings, setShareSettings] = useState<ShareSettings | null>(null);
  
  // State for service availability
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isCameraSupported, setIsCameraSupported] = useState(false);
  const [isLocationSupported, setIsLocationSupported] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load all settings
      const [
        notifSettings,
        bioSettings,
        camSettings,
        locSettings,
        shrSettings,
        bioSupported,
        camSupported,
        locSupported,
      ] = await Promise.all([
        notificationService.getNotificationSettings(),
        biometricAuth.getSettings(),
        cameraService.getSettings(),
        locationService.getSettings(),
        shareService.getSettings(),
        biometricAuth.isSupported(),
        cameraService.hasPermissions(),
        locationService.initialize(),
      ]);

      setNotificationSettings(notifSettings);
      setBiometricSettings(bioSettings);
      setCameraSettings(camSettings);
      setLocationSettings(locSettings);
      setShareSettings(shrSettings);
      setIsBiometricSupported(bioSupported);
      setIsCameraSupported(camSupported);
      setIsLocationSupported(locSupported);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateNotificationSettings = async (key: keyof NotificationSettings, value: any) => {
    if (!notificationSettings) return;
    
    const updated = { ...notificationSettings, [key]: value };
    setNotificationSettings(updated);
    await notificationService.updateNotificationSettings({ [key]: value });
  };

  const updateBiometricSettings = async (key: keyof BiometricSettings, value: any) => {
    if (!biometricSettings) return;
    
    const updated = { ...biometricSettings, [key]: value };
    setBiometricSettings(updated);
    await biometricAuth.updateSettings({ [key]: value });
    
    // Clear stored credentials if biometric is disabled
    if (key === 'enabled' && !value) {
      try {
        await AsyncStorage.removeItem('biometric_credentials');
        console.log('Stored credentials cleared - biometric disabled');
      } catch (error) {
        console.error('Failed to clear stored credentials:', error);
      }
    }
  };

  const updateCameraSettings = async (key: keyof CameraSettings, value: any) => {
    if (!cameraSettings) return;
    
    const updated = { ...cameraSettings, [key]: value };
    setCameraSettings(updated);
    await cameraService.updateSettings({ [key]: value });
  };

  const updateLocationSettings = async (key: keyof LocationSettings, value: any) => {
    if (!locationSettings) return;
    
    const updated = { ...locationSettings, [key]: value };
    setLocationSettings(updated);
    await locationService.updateSettings({ [key]: value });
  };

  const updateShareSettings = async (key: keyof ShareSettings, value: any) => {
    if (!shareSettings) return;
    
    const updated = { ...shareSettings, [key]: value };
    setShareSettings(updated);
    await shareService.updateSettings({ [key]: value });
  };

  const testNotification = async () => {
    try {
      await notificationService.sendImmediateNotification(
        'Test Notification',
        'This is a test notification from ExpenseFlow!'
      );
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const testBiometric = async () => {
    try {
      const result = await biometricAuth.authenticate('Test biometric authentication');
      if (result.success) {
        Alert.alert('Success', 'Biometric authentication successful!');
      } else {
        Alert.alert('Failed', result.error || 'Authentication failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to test biometric authentication');
    }
  };

  const testCamera = async () => {
    try {
      const hasPermissions = await cameraService.hasPermissions();
      if (hasPermissions) {
        Alert.alert('Success', 'Camera permissions granted!');
      } else {
        Alert.alert('Failed', 'Camera permissions not granted');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to test camera permissions');
    }
  };

  const testLocation = async () => {
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        Alert.alert('Success', `Location: ${location.latitude}, ${location.longitude}`);
      } else {
        Alert.alert('Failed', 'Could not get current location');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get location');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.onBackground }]}>
          Loading settings...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.onBackground }]}>
          Native Features
        </Text>
      </View>

      {/* Push Notifications */}
      <Card style={[styles.card, { backgroundColor: colors.surface }]}>
        <Card.Title
          title="Push Notifications"
          subtitle="Manage expense reminders and alerts"
          left={(props) => <MaterialCommunityIcons {...props} name="bell" size={24} color={colors.primary} />}
        />
        <Card.Content>
          {notificationSettings && (
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                Expense Reminders
              </Text>
              <Switch
                value={notificationSettings.expenseReminders}
                onValueChange={(value) => updateNotificationSettings('expenseReminders', value)}
              />
            </View>
          )}
          {notificationSettings && (
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                Budget Alerts
              </Text>
              <Switch
                value={notificationSettings.budgetAlerts}
                onValueChange={(value) => updateNotificationSettings('budgetAlerts', value)}
              />
            </View>
          )}
          <Button mode="outlined" onPress={testNotification} style={styles.testButton}>
            Test Notification
          </Button>
        </Card.Content>
      </Card>

      {/* Biometric Authentication */}
      <Card style={[styles.card, { backgroundColor: colors.surface }]}>
        <Card.Title
          title="Biometric Authentication"
          subtitle={isBiometricSupported ? "Fingerprint/Face ID login" : "Not supported on this device"}
          left={(props) => <MaterialCommunityIcons {...props} name="fingerprint" size={24} color={colors.primary} />}
        />
        <Card.Content>
          {biometricSettings && isBiometricSupported && (
            <>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Enable Biometric Auth
                </Text>
                <Switch
                  value={biometricSettings.enabled}
                  onValueChange={(value) => updateBiometricSettings('enabled', value)}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Require on App Open
                </Text>
                <Switch
                  value={biometricSettings.requireOnAppOpen}
                  onValueChange={(value) => updateBiometricSettings('requireOnAppOpen', value)}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Require for Sensitive Actions
                </Text>
                <Switch
                  value={biometricSettings.requireOnSensitiveActions}
                  onValueChange={(value) => updateBiometricSettings('requireOnSensitiveActions', value)}
                />
              </View>
              <Button mode="outlined" onPress={testBiometric} style={styles.testButton}>
                Test Biometric
              </Button>
            </>
          )}
          {!isBiometricSupported && (
            <Text style={[styles.notSupportedText, { color: colors.onSurfaceVariant }]}>
              Biometric authentication is not available on this device
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Camera & Receipt Scanning */}
      <Card style={[styles.card, { backgroundColor: colors.surface }]}>
        <Card.Title
          title="Camera & Receipt Scanning"
          subtitle="Scan receipts for automatic expense entry"
          left={(props) => <MaterialCommunityIcons {...props} name="camera" size={24} color={colors.primary} />}
        />
        <Card.Content>
          {cameraSettings && (
            <>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Enable Flash
                </Text>
                <Switch
                  value={cameraSettings.enableFlash}
                  onValueChange={(value) => updateCameraSettings('enableFlash', value)}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Show Grid
                </Text>
                <Switch
                  value={cameraSettings.enableGrid}
                  onValueChange={(value) => updateCameraSettings('enableGrid', value)}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Auto Process Receipts
                </Text>
                <Switch
                  value={cameraSettings.autoProcess}
                  onValueChange={(value) => updateCameraSettings('autoProcess', value)}
                />
              </View>
              <Button mode="outlined" onPress={testCamera} style={styles.testButton}>
                Test Camera Permissions
              </Button>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Location Services */}
      <Card style={[styles.card, { backgroundColor: colors.surface }]}>
        <Card.Title
          title="Location Services"
          subtitle="Auto-tag expenses with location"
          left={(props) => <MaterialCommunityIcons {...props} name="map-marker" size={24} color={colors.primary} />}
        />
        <Card.Content>
          {locationSettings && (
            <>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Enable Location Tracking
                </Text>
                <Switch
                  value={locationSettings.enabled}
                  onValueChange={(value) => updateLocationSettings('enabled', value)}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Auto-tag Expenses
                </Text>
                <Switch
                  value={locationSettings.autoTagExpenses}
                  onValueChange={(value) => updateLocationSettings('autoTagExpenses', value)}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Save Location History
                </Text>
                <Switch
                  value={locationSettings.saveLocationHistory}
                  onValueChange={(value) => updateLocationSettings('saveLocationHistory', value)}
                />
              </View>
              <Button mode="outlined" onPress={testLocation} style={styles.testButton}>
                Test Location
              </Button>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Share Settings */}
      <Card style={[styles.card, { backgroundColor: colors.surface }]}>
        <Card.Title
          title="Share Settings"
          subtitle="Configure how expenses are shared"
          left={(props) => <MaterialCommunityIcons {...props} name="share" size={24} color={colors.primary} />}
        />
        <Card.Content>
          {shareSettings && (
            <>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Include Receipt
                </Text>
                <Switch
                  value={shareSettings.includeReceipt}
                  onValueChange={(value) => updateShareSettings('includeReceipt', value)}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Include Location
                </Text>
                <Switch
                  value={shareSettings.includeLocation}
                  onValueChange={(value) => updateShareSettings('includeLocation', value)}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.onSurface }]}>
                  Include Notes
                </Text>
                <Switch
                  value={shareSettings.includeNotes}
                  onValueChange={(value) => updateShareSettings('includeNotes', value)}
                />
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  card: {
    margin: 16,
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
    flex: 1,
  },
  testButton: {
    marginTop: 16,
  },
  notSupportedText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  footer: {
    height: 100,
  },
}); 