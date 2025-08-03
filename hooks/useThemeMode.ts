import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export function useThemeMode() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const paperTheme = isDark ? MD3DarkTheme : MD3LightTheme;

  return {
    isDark,
    paperTheme,
    colorScheme,
  };
} 