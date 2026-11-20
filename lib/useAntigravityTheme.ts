'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'zcode_theme';

function applyThemeToDom(target: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', target);
  if (target === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Antigravity theme switcher hook synced with Stitch Terracotta Studio tokens.
 */
export function useAntigravityTheme() {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: ThemeMode =
      saved === 'dark' || saved === 'light' ? saved : systemDark ? 'dark' : 'light';
    setTheme(initial);
    applyThemeToDom(initial);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyThemeToDom(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      applyThemeToDom(next);
      return next;
    });
  }, []);

  return { theme, setMode, toggleTheme, isDark: theme === 'dark' };
}
