'use client'

import { useMemo, useState } from 'react'
import { IonPage, IonContent } from '@ionic/react'
import { Link, Redirect } from 'react-router-dom'
import { Activity, ChevronLeft, Search, ShieldCheck, Users } from 'lucide-react'
import { UserAvatar } from '@/components/ui/user-avatar'
import { isAdminEmail } from '@/lib/admin'
import { useAdminTraffic, useAdminUsers } from '@/queries/user/admin'
import { useUser } from '@/store/auth-store'

const RANGES = [7, 30, 90] as const

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'

const formatAgo = (value: string | null) => {
  if (!value) return 'never'
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`
  return `${Math.round(minutes / 60 / 24)}d ago`
}

function Stat({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: number; note?: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-ios">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-heading text-2xl font-semibold text-foreground">{value.toLocaleString()}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {note && <p className="text-xs text-muted-foreground/80">{note}</p>}
    </div>
  )
}

export default function AdminPage() {
  const user = useUser()
  const isAdmin = isAdminEmail(user?.email)
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const [search, setSearch] = useState('')

  const traffic = useAdminTraffic(isAdmin, days)
  const users = useAdminUsers(isAdmin)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const list = users.data ?? []
    if (!needle) return list
    return list.filter((u) =>
      [u.email, u.username, u.firstName, u.lastName].some((field) => field?.toLowerCase().includes(needle)),
    )
  }, [users.data, search])

  if (!isAdmin) return <IonPage><Redirect to="/manage" /></IonPage>

  const t = traffic.data
  const peak = Math.max(1, ...(t?.daily ?? []).map((d) => d.sessions))

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-3xl space-y-6 px-4 pb-10 pt-5 sm:px-6">
          <header className="flex items-center gap-3">
            <Link to="/manage" aria-label="Back to Manage" className="flex size-10 items-center justify-center rounded-full border border-border bg-card">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-heading text-xl font-semibold">Admin</h1>
              <p className="text-sm text-muted-foreground">Users and app traffic</p>
            </div>
          </header>

          {(traffic.isError || users.isError) && (
            <p role="alert" className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              Could not load admin data. Make sure migration 0048 is applied and you are online.
            </p>
          )}

          <section aria-label="Traffic" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Traffic</h2>
              <div className="flex gap-1 rounded-full bg-secondary p-1">
                {RANGES.map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setDays(range)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${days === range ? 'bg-card text-foreground shadow-ios' : 'text-muted-foreground'}`}
                  >
                    {range}d
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat icon={Users} label="Total users" value={t?.totalUsers ?? 0} note={`${t?.newUsers7d ?? 0} new this week`} />
              <Stat icon={Activity} label="Active today" value={t?.activeToday ?? 0} note={`${t?.sessionsToday ?? 0} sessions`} />
              <Stat icon={Activity} label="Active 7 days" value={t?.active7d ?? 0} />
              <Stat icon={Activity} label="Active 30 days" value={t?.active30d ?? 0} />
            </div>

            <div className="rounded-3xl border border-border bg-card p-4 shadow-ios">
              <p className="text-sm font-semibold">Sessions per day</p>
              <p className="mb-3 text-xs text-muted-foreground">{(t?.sessionsInRange ?? 0).toLocaleString()} in the last {days} days</p>
              <div className="flex h-32 items-end gap-px" role="img" aria-label={`Sessions per day for the last ${days} days`}>
                {(t?.daily ?? []).map((d) => (
                  <div
                    key={d.day}
                    title={`${formatDate(d.day)}: ${d.sessions} sessions, ${d.activeUsers} users, ${d.signups} signups`}
                    className="flex-1 rounded-t bg-primary/70"
                    style={{ height: `${Math.max(d.sessions ? 4 : 1, (d.sessions / peak) * 100)}%`, opacity: d.sessions ? 1 : 0.25 }}
                  />
                ))}
              </div>
            </div>

            {!!t?.platforms.length && (
              <div className="rounded-3xl border border-border bg-card p-4 shadow-ios">
                <p className="mb-2 text-sm font-semibold">Platforms</p>
                <ul className="space-y-1.5">
                  {t.platforms.map((p) => (
                    <li key={p.platform} className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{p.platform}</span>
                      <span className="text-muted-foreground">{p.users} users · {p.sessions} sessions</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="px-1 text-xs text-muted-foreground">Traffic counts start from when this feature was released.</p>
          </section>

          <section aria-label="Users" className="space-y-3">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Users {users.data ? `(${users.data.length})` : ''}
            </h2>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email or username"
                aria-label="Search users"
                className="h-11 w-full rounded-2xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus-visible:border-primary"
              />
            </label>

            <ul className="space-y-2">
              {filtered.map((u) => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
                return (
                  <li key={u.id} className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3.5 shadow-ios">
                    <UserAvatar
                      user={{ firstName: u.firstName ?? undefined, lastName: u.lastName ?? undefined, username: u.username ?? '', email: u.email ?? '' } as any}
                      className="size-11 text-base"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        {name || u.username || u.email}
                        {isAdminEmail(u.email) && <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Admin" />}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                      <p className="text-xs text-muted-foreground/80">
                        Joined {formatDate(u.createdAt)} · seen {formatAgo(u.lastSeen ?? u.lastSignInAt)} · {u.transactionCount} transactions
                      </p>
                    </div>
                    <span className="flex flex-col items-end gap-1 text-xs">
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold capitalize">{u.provider}</span>
                      {u.status && u.status !== 'active' && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold capitalize text-destructive">{u.status}</span>
                      )}
                    </span>
                  </li>
                )
              })}
              {users.isLoading && <li className="py-6 text-center text-sm text-muted-foreground">Loading users…</li>}
              {users.data && !filtered.length && <li className="py-6 text-center text-sm text-muted-foreground">No users match.</li>}
            </ul>
          </section>
        </main>
      </IonContent>
    </IonPage>
  )
}
