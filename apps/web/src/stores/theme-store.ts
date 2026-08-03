import { create } from 'zustand';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('antech-theme', theme);
}

function initialTheme(): Theme {
  const stored = localStorage.getItem('antech-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const theme = initialTheme();
  applyTheme(theme);
  return {
    theme,
    toggle: () => {
      const next: Theme = get().theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      set({ theme: next });
    },
  };
});
