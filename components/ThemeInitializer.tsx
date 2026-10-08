"use client"

import { useEffect } from "react"
import { useThemeStore } from "@/store/theme-store"
import { applyThemeToDom } from "@/utils/theme-transition"

/**
 * Keeps the page in step with the stored theme (on first load, and if storage rehydrates after).
 * Switching from the UI goes through `runThemeSwitch` in the store, which animates it as one step;
 * this only makes sure the classes are right, with no animation of its own.
 */
export default function ThemeInitializer() {
  const isDarkMode = useThemeStore((s) => s.isDarkMode)

  useEffect(() => {
    applyThemeToDom(isDarkMode)
  }, [isDarkMode])

  return null
}
