import { useState } from 'react'
import { pl } from '../i18n/pl'
import { applyTheme, getStoredTheme, toggleTheme, type Theme } from '../theme/theme'
import './ThemeToggle.css'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-toggle__icon">
      <circle cx="12" cy="12" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-toggle__icon">
      <path
        d="M19.5 13.35A7.75 7.75 0 0 1 10.65 4.5 7.75 7.75 0 1 0 19.5 13.35Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = getStoredTheme()
    applyTheme(initial)
    return initial
  })

  const isDark = theme === 'dark'
  const label = isDark ? pl.theme.toLight : pl.theme.toDark

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme((current) => toggleTheme(current))}
      aria-label={label}
      title={label}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
