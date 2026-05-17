import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { AppColors, AppThemeMode, darkColors, lightColors } from '@/constants/colors';

const THEME_STORAGE_KEY = 'app-theme-mode';

/** Provides the selected visual theme and persists it between app launches. */
export const [AppThemeProvider, useAppTheme] = createContextHook(() => {
  const [themeMode, setThemeModeState] = useState<AppThemeMode>('dark');

  useEffect(() => {
    let isMounted = true;

    const loadTheme = async (): Promise<void> => {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (isMounted && (storedTheme === 'dark' || storedTheme === 'light')) {
          setThemeModeState(storedTheme);
        }
      } catch (error) {
        console.warn('Failed to load theme preference');
      }
    };

    void loadTheme();

    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = useCallback((mode: AppThemeMode): void => {
    setThemeModeState(mode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {
      console.warn('Failed to save theme preference');
    });
  }, []);

  const colors = useMemo<AppColors>(() => (themeMode === 'light' ? lightColors : darkColors), [themeMode]);

  return { colors, themeMode, setThemeMode };
});
