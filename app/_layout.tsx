import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';

import { ThemeProvider, useThemeMode } from '../contexts/ThemeContext';
import { AuthProvider } from '../firebase/AuthProvider';
import PreAuthOnboarding from '../components/PreAuthOnboarding';

function Main() {
  const { paperTheme } = useThemeMode();
  return (
    <AuthProvider>
      <PaperProvider theme={paperTheme}>
        <PreAuthOnboarding>
          <Stack screenOptions={{
          headerShown: false, // 👈 Hide for all screens
        }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </PreAuthOnboarding>
      </PaperProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemeProvider>
          <Main />
        </ThemeProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
