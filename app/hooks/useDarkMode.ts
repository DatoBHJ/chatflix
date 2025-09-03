import { useState, useEffect } from 'react';

/**
 * Hook to detect and track the current dark mode state
 * Monitors both manual theme settings and system preferences
 * @returns boolean indicating if dark mode is currently active
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const updateTheme = () => {
      const root = document.documentElement
      const theme = root.getAttribute('data-theme')
      
      setIsDark(
        theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
        (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
      )
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['data-theme'] 
    })

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', updateTheme)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', updateTheme)
    }
  }, [])

  return isDark
}
