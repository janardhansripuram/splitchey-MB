import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext';
import { AuthProvider } from './firebase/AuthProvider';

function Main() {
  const { theme } = useThemeMode();
  const paperTheme = theme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  return (
    <PaperProvider theme={paperTheme}>
      <AuthProvider>
        <Stack />
      </AuthProvider>
    </PaperProvider>
  );
}

export default function App() {
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