'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    // Get initial theme from localStorage or default to system
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && savedTheme !== 'system') {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      // Default to system theme
      localStorage.removeItem('theme');
      document.documentElement.setAttribute('data-theme', 'system');
    }
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    if (newTheme === theme) {
      // If clicking the active theme, reset to system
      setTheme('system');
      localStorage.removeItem('theme');
      document.documentElement.setAttribute('data-theme', 'system');
    } else {
      setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  };

  return (
    <>
      {(['light', 'dark'] as Theme[]).map((themeOption) => (
        <button
          key={themeOption}
          onClick={() => handleThemeChange(themeOption)}
          className={`w-full px-4 py-3 text-sm text-left hover:bg-[var(--accent)] transition-colors uppercase tracking-wider ${
            theme === themeOption ? 'bg-[var(--accent)]' : ''
          }`}
        >
          {themeOption} Mode
        </button>
      ))}
    </>
  );
} 