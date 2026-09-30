import { Home, Wallet, SlidersHorizontal, Receipt, type LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Extra route prefixes that keep this item highlighted. */
  alsoActiveFor?: string[]
}

/** Pages that live under Manage. They get a back arrow to /manage on small screens. */
export const MANAGE_ROUTES = ['/budgets', '/bills', '/categories', '/statistics', '/profile', '/settings']

/** The four main destinations, shared by the bottom tab bar and the desktop top nav. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Today', href: '/dashboard', icon: Home },
  { label: 'Money', href: '/wallets', icon: Wallet },
  { label: 'Activity', href: '/transactions', icon: Receipt },
  { label: 'Manage', href: '/manage', icon: SlidersHorizontal, alsoActiveFor: MANAGE_ROUTES },
]

export const PAGE_TITLES: Record<string, string> = {
  '/budgets': 'Budgets',
  '/bills': 'Bills',
  '/categories': 'Categories',
  '/statistics': 'Statistics',
  '/settings': 'Settings',
  '/profile': 'Profile',
}

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/')

export const isNavItemActive = (item: NavItem, pathname: string) =>
  matches(pathname, item.href) || (item.alsoActiveFor ?? []).some((href) => matches(pathname, href))

export const isManageSubRoute = (pathname: string) => MANAGE_ROUTES.some((href) => matches(pathname, href))

export const getPageTitle = (pathname: string) => {
  const nav = NAV_ITEMS.find((item) => matches(pathname, item.href))
  if (nav) return nav.label
  const sub = Object.keys(PAGE_TITLES).find((href) => matches(pathname, href))
  return sub ? PAGE_TITLES[sub] : 'Fico'
}
