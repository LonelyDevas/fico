'use client'

import { useState } from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import { Home, TrendingUp, Wallet, CreditCard, Menu, PieChart, Tag, Settings as SettingsIcon, Moon, Sun, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/theme-store'
import { useAuthStore } from '@/store/auth-store'
import { useLogout } from '@/queries/auth/auth'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'

const TABS = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Transactions', href: '/transactions', icon: TrendingUp },
  { label: 'Wallets', href: '/wallets', icon: Wallet },
  { label: 'Bills', href: '/bills', icon: CreditCard },
]

const MORE_ITEMS = [
  { label: 'Budgets', href: '/budgets', icon: PieChart },
  { label: 'Categories', href: '/categories', icon: Tag },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Settings', href: '/settings', icon: SettingsIcon },
]

/** Fixed bottom tab bar for <lg viewports. Desktop keeps the horizontal top nav in navbar.tsx. */
export function BottomTabBar() {
  const history = useHistory()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const { isDarkMode, toggleDarkMode } = useThemeStore()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { mutate: logout } = useLogout()

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/')
  const isMoreActive = MORE_ITEMS.some((item) => isActive(item.href))

  const go = (href: string) => {
    setMoreOpen(false)
    history.push(href)
  }

  const handleSignOut = () => {
    logout(undefined, {
      onSettled: () => {
        clearAuth()
        setMoreOpen(false)
        history.push('/signin')
      },
    })
  }

  return (
    <>
      <nav
        className="ios-blur fixed inset-x-0 bottom-0 z-40 border-t border-border lg:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {TABS.map((tab) => {
            const active = isActive(tab.href)
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                to={tab.href}
                aria-current={active ? 'page' : undefined}
                className="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium"
              >
                <Icon
                  className={cn('h-6 w-6 transition-transform', active ? 'scale-105 text-primary' : 'text-muted-foreground')}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className={active ? 'text-primary' : 'text-muted-foreground'}>{tab.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium"
          >
            <Menu className={cn('h-6 w-6', isMoreActive ? 'text-primary' : 'text-muted-foreground')} strokeWidth={isMoreActive ? 2.4 : 2} />
            <span className={isMoreActive ? 'text-primary' : 'text-muted-foreground'}>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent className="sm:max-w-sm" showCloseButton={false}>
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Budgets, categories, and account settings.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-1 px-3">
            {MORE_ITEMS.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  onClick={() => go(item.href)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors',
                    active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              )
            })}
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
    </>
  )
}
