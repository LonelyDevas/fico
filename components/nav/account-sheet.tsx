'use client'

import { useHistory } from 'react-router-dom'
import { User, Settings as SettingsIcon, Moon, Sun, LogOut } from 'lucide-react'
import { useThemeStore } from '@/store/theme-store'
import { useAuthStore } from '@/store/auth-store'
import { useLogout } from '@/queries/auth/auth'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'

const ACCOUNT_ITEMS = [
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Settings', href: '/settings', icon: SettingsIcon },
]

interface AccountSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Account menu for small screens: profile, settings, theme and sign out. */
export function AccountSheet({ open, onOpenChange }: AccountSheetProps) {
  const history = useHistory()
  const { isDarkMode, toggleDarkMode } = useThemeStore()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { mutate: logout } = useLogout()

  const go = (href: string) => {
    onOpenChange(false)
    history.push(href)
  }

  const handleSignOut = () => {
    logout(undefined, {
      onSettled: () => {
        clearAuth()
        onOpenChange(false)
        history.push('/signin')
      },
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-sm" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Account</SheetTitle>
          <SheetDescription>Your profile, settings and appearance.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-1 px-3">
          {ACCOUNT_ITEMS.map(({ label, href, icon: Icon }) => (
            <button
              key={href}
              onClick={() => go(href)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        <SheetFooter className="border-t-0 pt-2">
          <Button variant="outline" className="w-full gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
