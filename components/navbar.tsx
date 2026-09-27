"use client"

import { useState } from 'react'
import { useHistory, useLocation, Link } from 'react-router-dom'
import {
  Moon,
  Sun,
  User,
  LogOut,
  Settings as SettingsIcon,
  Wallet,
  CreditCard,
  TrendingUp,
  PieChart,
  Tag,
  Home,
} from 'lucide-react'
import { useThemeStore } from '@/store/theme-store'
import { useAuthStore, useUser } from '@/store/auth-store'
import { useLogout } from '@/queries/auth/auth'
import { BottomTabBar } from '@/components/nav/bottom-tab-bar'

const getInitial = (value?: string) => (value ? value.trim().charAt(0).toUpperCase() : 'U')

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: <Home className="w-4 h-4" /> },
  { label: 'Wallets', href: '/wallets', icon: <Wallet className="w-4 h-4" /> },
  { label: 'Transactions', href: '/transactions', icon: <TrendingUp className="w-4 h-4" /> },
  { label: 'Bills', href: '/bills', icon: <CreditCard className="w-4 h-4" /> },
  { label: 'Budgets', href: '/budgets', icon: <PieChart className="w-4 h-4" /> },
  { label: 'Categories', href: '/categories', icon: <Tag className="w-4 h-4" /> },
  { label: 'Settings', href: '/settings', icon: <SettingsIcon className="w-4 h-4" /> },
]

export default function DNavbar() {
  const history = useHistory()
  const location = useLocation()
  const { isDarkMode, toggleDarkMode } = useThemeStore()
  const user = useUser()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { mutate: logout } = useLogout()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/')
  const pageTitle = navItems.find((item) => isActive(item.href))?.label ?? 'Fico'

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
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-card flex items-center justify-center shrink-0">
              <img src="/FicoLogoTrans1.png" alt="Fico logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-base font-bold text-foreground truncate">{pageTitle}</span>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>
      <BottomTabBar />

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
              {navItems.map((item) => {
                const active = isActive(item.href)
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
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
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
    </>
  )
}
