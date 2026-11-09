import { useEffect, useState } from 'react'
import type { HourFormat } from '../../lib/time'

export type Theme = 'dark' | 'light'
const THEME_STORAGE_KEY = 'tomohu.theme'
const HOUR_FORMAT_STORAGE_KEY = 'tomohu.hour-format'

function getSavedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light'
      ? 'light'
      : 'dark'
  } catch {
    return 'dark'
  }
}

function getSavedHourFormat(): HourFormat {
  try {
    return localStorage.getItem(HOUR_FORMAT_STORAGE_KEY) === '12h'
      ? '12h'
      : '24h'
  } catch {
    return '24h'
  }
}

export function usePreferences() {
  const [theme, setTheme] = useState<Theme>(getSavedTheme)
  const [hourFormat, setHourFormat] = useState<HourFormat>(getSavedHourFormat)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Theme preference is optional when browser storage is unavailable.
    }
  }, [theme])
  useEffect(() => {
    try {
      localStorage.setItem(HOUR_FORMAT_STORAGE_KEY, hourFormat)
    } catch {
      // Hour format preference is optional when browser storage is unavailable.
    }
  }, [hourFormat])

  return { theme, setTheme, hourFormat, setHourFormat }
}
