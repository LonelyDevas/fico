"use client"

import { useState } from 'react'
import { useHistory, useLocation, Link } from 'react-router-dom'
import {
  Moon,
  Sun,
  User,
  LogOut,
  Settings as SettingsIcon,
  ArrowLeft,
  Plus,
} from 'lucide-react'
import { useThemeStore } from '@/store/theme-store'
import { useAuthStore, useUser } from '@/store/auth-store'
import { useLogout } from '@/queries/auth/auth'
import { BottomTabBar } from '@/components/nav/bottom-tab-bar'
import { AccountSheet } from '@/components/nav/account-sheet'
import { NAV_ITEMS, getPageTitle, isNavItemActive, isManageSubRoute } from '@/components/nav/nav-items'
import { QuickAddSheet } from '@/components/page/transaction/quick-add-sheet'

const getInitial = (value?: string) => (value ? value.trim().charAt(0).toUpperCase() : 'U')

export default function DNavbar() {
  const history = useHistory()
  const location = useLocation()
  const { isDarkMode, toggleDarkMode } = useThemeStore()
  const user = useUser()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { mutate: logout } = useLogout()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const pageTitle = getPageTitle(location.pathname)
  const showBack = isManageSubRoute(location.pathname)

  const go = (href: string) => {
    history.push(href)
    setShowUserMenu(false)
  }

  const handleSignOut = () => {
    logout(undefined, {
      onSettled: () => {
        clearAuth()
        go('/signin')
      },
    })
  }

  return (
    <>
      {/* Mobile: minimal title bar (nav lives in the bottom tab bar) */}
      <header className="ios-blur safe-top sticky top-0 z-40 border-b border-border/70 lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {showBack ? (
              <button
                onClick={() => history.push('/manage')}
                className="p-2 -ml-2 rounded-full hover:bg-secondary text-foreground shrink-0"
                aria-label="Back to Manage"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-card flex items-center justify-center shrink-0">
                <img src="/FicoLogoTrans1.png" alt="Fico logo" className="w-full h-full object-contain" />
              </div>
            )}
            <span className="text-base font-bold text-foreground truncate">{pageTitle}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setAccountOpen(true)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
              aria-label="Account"
            >
              {getInitial(user?.username || user?.email)}
            </button>
          </div>
        </div>
      </header>
      <BottomTabBar onAdd={() => setAddOpen(true)} />
      <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} />

      {/* Desktop: full horizontal nav */}
      <header className="ios-blur sticky top-0 z-40 border-b border-border/70 hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Logo / brand */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-card flex items-center justify-center">
                <img src="/FicoLogoTrans1.png" alt="Fico logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-bold text-foreground">Fico</span>
            </div>

            <div className="h-8 w-px bg-border/70" aria-hidden="true" />

            {/* Nav links */}
            <nav className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
              {NAV_ITEMS.map((item) => {
                const active = isNavItemActive(item, location.pathname)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={item.label}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold uppercase tracking-wide transition-all duration-200 ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition-shadow hover:shadow-md"
                title="Add transaction"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                title="Toggle theme"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground font-semibold hover:shadow-md transition-all text-sm"
                  title="User menu"
                >
                  {getInitial(user?.username || user?.email)}
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-ios-lg py-2 z-50 divide-y divide-border">
                    <div className="px-4 py-3">
                      <p className="truncate text-sm font-semibold text-foreground">{user?.username || 'Account'}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <div className="py-2">
                      <button onClick={() => go('/profile')} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors flex items-center gap-3">
                        <User className="w-4 h-4" />
                        Profile
                      </button>
                      <button onClick={() => go('/settings')} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors flex items-center gap-3">
                        <SettingsIcon className="w-4 h-4" />
                        Settings
                      </button>
                    </div>
                    <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-secondary transition-colors flex items-center gap-3">
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <QuickAddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
