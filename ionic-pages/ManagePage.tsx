'use client'

import { IonPage, IonContent } from '@ionic/react'
import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, CreditCard, HandCoins, PieChart, Settings as SettingsIcon, Tag, TrendingUp, type LucideIcon } from 'lucide-react'
import { PeacockMascot } from '@/components/peacock-mascot'
import { UserAvatar } from '@/components/ui/user-avatar'
import { useBillSummary } from '@/queries/user/bill/bills'
import { useUser } from '@/store/auth-store'

interface ManageItem {
  label: string
  href: string
  icon: LucideIcon
  description: string
  /** Tile colors for the icon. */
  tone: string
}

interface ManageGroup {
  title: string
  items: ManageItem[]
}

const MANAGE_GROUPS: ManageGroup[] = [
  {
    title: 'Plan',
    items: [
      { label: 'Budgets', href: '/budgets', icon: PieChart, description: 'Spending limits', tone: 'bg-primary/10 text-primary' },
      { label: 'Bills', href: '/bills', icon: CreditCard, description: 'What is due and when', tone: 'bg-warning/15 text-warning' },
      { label: 'Debts & loans', href: '/debts', icon: HandCoins, description: 'Borrowed and lent', tone: 'bg-destructive/10 text-destructive' },
      { label: 'Investments', href: '/investments', icon: TrendingUp, description: 'How your money grows', tone: 'bg-success/15 text-success' },
    ],
  },
  {
    title: 'Understand',
    items: [
      { label: 'Statistics', href: '/statistics', icon: BarChart3, description: 'Charts and trends', tone: 'bg-accent/15 text-accent' },
      { label: 'Categories', href: '/categories', icon: Tag, description: 'Organize your spending', tone: 'bg-secondary text-foreground' },
    ],
  },
  {
    title: 'App',
    items: [{ label: 'Settings', href: '/settings', icon: SettingsIcon, description: 'Currency, privacy and look', tone: 'bg-secondary text-foreground' }],
  },
]

export default function ManagePage() {
  const user = useUser()
  const { data: billSummary } = useBillSummary()
  const overdue = Number((billSummary?.data as any)?.overdueBills ?? 0)
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

  const badge = (href: string) => (href === '/bills' && overdue > 0 ? `${overdue} overdue` : null)

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-3xl space-y-7 px-4 pb-10 pt-5 sm:px-6">
          {/* Profile */}
          <Link
            to="/profile"
            className="group relative block overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#004C99] p-5 text-white shadow-ios-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <svg viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-12 -right-10 h-60 w-60 opacity-20" aria-hidden="true">
              <g transform="translate(120 110)">
                <circle r="70" fill="#00D9CC" />
                <circle r="48" fill="#0066CC" />
                <circle r="28" fill="#00D9CC" />
                <circle r="11" fill="#2ECC71" />
              </g>
            </svg>

            <div className="relative flex items-center gap-4">
              <UserAvatar user={user} className="size-16 text-2xl ring-2 ring-white/40" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-xl font-semibold">{fullName || user?.username || 'Your profile'}</p>
                <p className="truncate text-sm text-white/75">{user?.email}</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold transition-colors group-hover:bg-white/25">
                  Edit profile and photo
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <PeacockMascot pose="advisor" className="hidden h-24 w-24 shrink-0 sm:block" label="" />
            </div>
          </Link>

          {MANAGE_GROUPS.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h2 className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group.title}</h2>
              <div className="grid grid-cols-2 gap-3">
                {group.items.map(({ label, href, icon: Icon, description, tone }) => {
                  const chip = badge(href)
                  return (
                    <Link
                      key={href}
                      to={href}
                      className="group relative flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-ios transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-ios-lg focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span className="flex items-start justify-between">
                        <span className={`flex size-11 items-center justify-center rounded-2xl ${tone}`}>
                          <Icon className="h-6 w-6" />
                        </span>
                        {chip ? (
                          <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">{chip}</span>
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        )}
                      </span>
                      <span>
                        <span className="block font-semibold text-foreground">{label}</span>
                        <span className="block text-sm text-muted-foreground">{description}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </main>
      </IonContent>
    </IonPage>
  )
}
