import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme } from '@react-navigation/native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  paperTheme: typeof MD3DarkTheme;
  navTheme: typeof NavDarkTheme;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  paperTheme: MD3LightTheme,
  navTheme: NavLightTheme,
});

const THEME_KEY = 'user_theme_preference';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  // Load theme from storage or system
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
      } else {
        setThemeState('system');
      }
      setSystemTheme(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
    })();
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => listener.remove();
  }, []);

  // Save user preference
  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    if (mode === 'system') {
      AsyncStorage.removeItem(THEME_KEY);
    } else {
      AsyncStorage.setItem(THEME_KEY, mode);
    }
  };

  const effectiveTheme = theme === 'system' ? systemTheme : theme;
  const paperTheme = effectiveTheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const navTheme = effectiveTheme === 'dark' ? NavDarkTheme : NavLightTheme;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, paperTheme, navTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => useContext(ThemeContext); 