'use client'

import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, isNavItemActive, type NavItem } from '@/components/nav/nav-items'

interface BottomTabBarProps {
  onAdd: () => void
}

function Tab({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavItemActive(item, pathname)
  const Icon = item.icon
  return (
    <Link
      to={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1 text-[11px] font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity',
          active ? 'opacity-100' : 'opacity-0'
        )}
      />
      <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
      <span>{item.label}</span>
    </Link>
  )
}

/**
 * Bottom navigation for <lg viewports: two tabs, a raised centre button for adding a
 * transaction, then two more tabs. Desktop keeps the top nav in navbar.tsx.
 */
export function BottomTabBar({ onAdd }: BottomTabBarProps) {
  const { pathname } = useLocation()
  const [first, second, third, fourth] = NAV_ITEMS

  // Rendered in <body>, outside Ionic's app container. iOS makes that container shorter than
  // the visible screen, which left the bar floating about 60pt above the bottom.
  if (typeof document === 'undefined') return null

  return createPortal(
    <nav
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-border bg-card pb-2 shadow-ios-lg lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
        <Tab item={first} pathname={pathname} />
        <Tab item={second} pathname={pathname} />
        <div className="relative flex w-20 shrink-0 justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add transaction"
            className="absolute -top-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-ios-lg ring-4 ring-background transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>
        </div>
        <Tab item={third} pathname={pathname} />
        <Tab item={fourth} pathname={pathname} />
      </div>
    </nav>,
    document.body
  )
}
