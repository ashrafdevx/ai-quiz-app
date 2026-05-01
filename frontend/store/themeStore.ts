import { create } from 'zustand';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type AppColors } from '../constants/colors';

type ThemeMode = 'system' | 'dark' | 'light';

interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>(set => ({
  mode: 'system',
  setMode: (mode) => set({ mode }),
}));

/** Returns the resolved color set based on mode + system scheme. */
export function useTheme(): { colors: AppColors; isDark: boolean; mode: ThemeMode; toggle: () => void } {
  const systemScheme = useColorScheme();
  const { mode, setMode } = useThemeStore();

  const effective = mode === 'system' ? (systemScheme ?? 'dark') : mode;
  const isDark = effective === 'dark';

  const toggle = () => setMode(isDark ? 'light' : 'dark');

  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
    mode,
    toggle,
  };
}
