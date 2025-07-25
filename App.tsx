import { AuthProvider } from './firebase/AuthProvider';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { Stack } from 'expo-router';
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
      <ThemeProvider>
        <Main />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
} 