'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  currentTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export function ThemeToggle({ currentTheme, onThemeChange }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('system');

  // Use currentTheme from props if available, otherwise use local state
  const activeTheme = currentTheme !== undefined ? currentTheme : theme;

  useEffect(() => {
    // If no props are provided, manage theme locally
    if (currentTheme === undefined) {
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        // Default to system theme
        localStorage.removeItem('theme');
        document.documentElement.setAttribute('data-theme', 'system');
        
        // Apply system theme immediately
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
        }
      }
    }
  }, [currentTheme]);

  const handleThemeChange = () => {
    // Cycle through: light -> dark -> system -> light
    let nextTheme: Theme;
    if (activeTheme === 'light') {
      nextTheme = 'dark';
    } else if (activeTheme === 'dark') {
      nextTheme = 'system';
    } else {
      nextTheme = 'light';
    }

    if (onThemeChange) {
      onThemeChange(nextTheme);
    } else {
      setTheme(nextTheme);
      localStorage.setItem('theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      
      // Apply system theme immediately if system is selected
      if (nextTheme === 'system') {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
        }
      }
    }
  };

  return (
    <button
      onClick={handleThemeChange}
      className="text-[var(--foreground)] transition-colors cursor-pointer pb-0.5"
      title={`Switch to ${activeTheme === 'light' ? 'dark' : activeTheme === 'dark' ? 'system' : 'light'} mode`}
      data-theme-toggle
    >
      {activeTheme === 'light' ? (
        <svg className="w-4 h-4 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : activeTheme === 'dark' ? (
        <svg className="w-4 h-4 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )}
    </button>
  );
} 