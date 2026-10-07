'use client'

import { useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useRootNavigate } from '@/utils/use-root-navigate'
import { Moon, Sun, Search, Bell, User, MoreVertical, Home, TrendingUp, BarChart3 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/store/auth-store'
import { useLogout } from '@/queries/auth/auth'

export function DashboardHeader() {
  const { theme, setTheme } = useTheme()
  const history = useHistory()
  const rootNavigate = useRootNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { mutate: logout } = useLogout()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleSignOut = () => {
    logout(undefined, {
      onSettled: () => {
        clearAuth()
        rootNavigate('/signin', { clearCache: true })
      },
    })
  }

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border transition-colors duration-300">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold">F</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-foreground">Fico</h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink icon={<Home className="w-4 h-4" />} label="Dashboard" active />
            <NavLink icon={<TrendingUp className="w-4 h-4" />} label="Transactions" />
            <NavLink icon={<BarChart3 className="w-4 h-4" />} label="Analytics" />
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Search */}
            <div className="hidden sm:flex items-center bg-secondary rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-0 outline-none px-2 py-0 text-sm text-foreground placeholder:text-muted-foreground w-32"
              />
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                U
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                  <button className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Profile
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
                    Settings
                  </button>
                  <hr className="my-1 border-border" />
                  <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-secondary transition-colors">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function NavLink({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
      active 
        ? 'bg-primary text-primary-foreground' 
        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
    }`}>
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
