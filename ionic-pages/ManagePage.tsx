'use client'

import { IonPage, IonContent } from '@ionic/react'
import { Link } from 'react-router-dom'
import { PieChart, CreditCard, Tag, BarChart3, User, Settings as SettingsIcon, ChevronRight, type LucideIcon } from 'lucide-react'
import { PeacockMascot } from '@/components/peacock-mascot'

interface ManageItem {
  label: string
  href: string
  icon: LucideIcon
  description: string
}

interface ManageGroup {
  title: string
  items: ManageItem[]
}

const MANAGE_GROUPS: ManageGroup[] = [
  {
    title: 'Your money',
    items: [
      { label: 'Budgets', href: '/budgets', icon: PieChart, description: 'Set spending limits and see how you are doing.' },
      { label: 'Bills', href: '/bills', icon: CreditCard, description: 'Keep track of what is due and when.' },
      { label: 'Categories', href: '/categories', icon: Tag, description: 'Organize where your money goes.' },
      { label: 'Statistics', href: '/statistics', icon: BarChart3, description: 'Charts and trends for your spending.' },
    ],
  },
  {
    title: 'You',
    items: [
      { label: 'Profile', href: '/profile', icon: User, description: 'Your name, email and account details.' },
      { label: 'Settings', href: '/settings', icon: SettingsIcon, description: 'Currency, privacy and how the app looks.' },
    ],
  },
]

export default function ManagePage() {
  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
          <div className="flex items-end gap-3">
            <PeacockMascot pose="advisor" className="w-24 h-24 shrink-0" label="Fico, your financial advisor" />
            <div className="min-w-0 flex-1 rounded-2xl rounded-bl-md border border-border bg-card p-3 shadow-ios">
              <p className="text-xs font-semibold text-primary mb-1">Fico</p>
              <p className="text-sm text-foreground leading-relaxed">
                Set up your budgets and bills here, or update your profile and settings.
              </p>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Manage</h1>
            <p className="text-sm text-muted-foreground">Budgets, bills, your profile and settings in one place.</p>
          </div>

          {MANAGE_GROUPS.map((group) => (
            <section key={group.title} aria-label={group.title} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group.title}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map(({ label, href, icon: Icon, description }) => (
                  <Link
                    key={href}
                    to={href}
                    className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-ios transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground">{label}</span>
                      <span className="block text-sm text-muted-foreground">{description}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </IonContent>
    </IonPage>
  )
}
