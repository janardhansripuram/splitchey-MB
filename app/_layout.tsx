import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useThemeMode } from '../hooks/useThemeMode';
import { AuthProvider } from '../firebase/AuthProvider';
import PreAuthOnboarding from '../components/PreAuthOnboarding';
import { OfflineBanner } from '../components/ui/OfflineBanner';
import { useEffect } from 'react';
import notificationService from '../lib/notifications/NotificationService';
import biometricAuth from '../lib/auth/BiometricAuth';
import cameraService from '../lib/camera/CameraService';
import locationService from '../lib/location/LocationService';
import paymentService from '../lib/payments/PaymentService';

function Main() {
  const { paperTheme } = useThemeMode();

  useEffect(() => {
    // Initialize all native mobile services
    const initializeServices = async () => {
      try {
        console.log('Initializing native mobile services...');
        
        // Initialize notification service
        await notificationService.initialize();
        
        // Initialize biometric authentication
        await biometricAuth.initialize();
        
        // Initialize camera service
        await cameraService.initialize();
        
        // Initialize location service
        await locationService.initialize();
        
        // Initialize payment service
        await paymentService.initialize();
        
        console.log('All native mobile services initialized successfully');
      } catch (error) {
        console.error('Failed to initialize native mobile services:', error);
      }
    };

    initializeServices();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PaperProvider theme={paperTheme}>
          <BottomSheetModalProvider>
            <PreAuthOnboarding>
              <Stack screenOptions={{
                headerShown: false, // 👈 Hide for all screens
              }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="verify-email" options={{ headerShown: false }} />
                <Stack.Screen name="groups-detail" options={{ headerShown: false }} />
                <Stack.Screen name="expenses-edit" options={{ headerShown: false }} />
                <Stack.Screen name="expenses-add" options={{ headerShown: false }} />
                <Stack.Screen name="groups-split" options={{ headerShown: false }} />
                <Stack.Screen name="groups-split-detail" options={{ headerShown: false }} />
                <Stack.Screen name="groups-create" options={{ headerShown: false }} />
                <Stack.Screen name="friends-add" options={{ headerShown: false }} />
                <Stack.Screen name="ai-insights" options={{ headerShown: false }} />
                <Stack.Screen name="debts" options={{ headerShown: false }} />
                <Stack.Screen name="income" options={{ headerShown: false }} />
                <Stack.Screen name="wallet" options={{ headerShown: false }} />
                <Stack.Screen name="budgets" options={{ headerShown: false }} />
                            <Stack.Screen name="friend-detail" options={{ headerShown: false }} />
            <Stack.Screen name="settings-native" options={{ headerShown: false }} />
            <Stack.Screen name="camera-screen" options={{ headerShown: false }} />
            <Stack.Screen name="subscription" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
              <OfflineBanner />
            </PreAuthOnboarding>
          </BottomSheetModalProvider>
        </PaperProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default Main;
