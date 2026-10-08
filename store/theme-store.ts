import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { runThemeSwitch } from '@/utils/theme-transition'

interface ThemeState {
    isDarkMode: boolean
    toggleDarkMode: () => void
    setDarkMode: (isDark: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            isDarkMode: false,
            toggleDarkMode: () => get().setDarkMode(!get().isDarkMode),
            // Every switch goes through one animated step (see utils/theme-transition.ts).
            setDarkMode: (isDark: boolean) => {
                if (isDark === get().isDarkMode) return
                runThemeSwitch(isDark, () => set({ isDarkMode: isDark }))
            },
        }),
        {
            name: 'theme-storage',
        }
    )
)
