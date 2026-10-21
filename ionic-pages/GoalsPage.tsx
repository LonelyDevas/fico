'use client'

import { useMemo, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { format, parseISO } from 'date-fns'
import { Eye, EyeOff, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState, PeacockMascot } from '@/components/peacock-mascot'
import { GoalCard } from '@/components/page/goals/goal-card'
import { GoalSheet } from '@/components/page/goals/goal-sheet'
import { asGoalWallets, goalProgress } from '@/components/page/goals/goal-progress'
import { useListGoals, useUpdateGoal } from '@/queries/user/goal/goals'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { Skeleton } from '@/components/ui/skeleton'
import type { Goal } from '@/types/goal'

export default function GoalsPage() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const [sheet, setSheet] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null })

  const { data: goalsResponse, isLoading } = useListGoals()
  const { data: walletsResponse, isLoading: walletsLoading } = useListWallets({ limit: '100' })
  const { mutate: update } = useUpdateGoal()

  const wallets = useMemo(() => asGoalWallets(walletsResponse?.data), [walletsResponse])
  const goals = useMemo(
    () => (goalsResponse?.data ?? []).map((goal) => ({ goal, progress: goalProgress(goal, wallets) })),
    [goalsResponse, wallets]
  )

  const loading = isLoading || walletsLoading
  const active = goals.filter((g) => !g.progress.reached)
  const reached = goals.filter((g) => g.progress.reached)
  const remaining = active.reduce((sum, g) => sum + g.progress.remaining, 0)
  const perMonth = active.reduce((sum, g) => sum + (g.progress.monthlyNeeded ?? 0), 0)
  const money = (value: number) => formatMoney(value, currency, !showAmounts)

  const note = useMemo(() => {
    if (goals.length === 0) return 'Pick something to save for and a date, and I will tell you how much to set aside each month.'
    const next = active
      .filter((g) => g.goal.deadline)
      .sort((a, b) => (a.goal.deadline as string).localeCompare(b.goal.deadline as string))[0]
    if (next) {
      const { goal, progress } = next
      if ((progress.daysLeft ?? 0) < 0) return `${goal.name} is past its deadline with ${formatMoney(progress.remaining, currency, false)} to go. Move the date or keep going.`
      return `${goal.name}: save about ${formatMoney(progress.monthlyNeeded ?? 0, currency, false)} a month to reach it by ${format(parseISO(goal.deadline as string), 'MMM d')}.`
    }
    if (active.length === 0) return 'Every goal is reached. Nice work! Add a new one when you are ready.'
    return `${formatMoney(remaining, currency, false)} left to save across your goals.`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, currency])

  const handleArchive = (goal: Goal) =>
    update({ id: goal.id, status: 'archived' }, { onSuccess: () => toast.success('Archived') })

  const tiles = [
    { label: 'Needed per month', value: perMonth },
    { label: 'Goals', value: null, text: `${active.length} open${reached.length ? ` · ${reached.length} reached` : ''}` },
  ]

  const card = ({ goal, progress }: (typeof goals)[number]) => (
    <GoalCard key={goal.id} goal={goal} progress={progress} hideAmounts={!showAmounts} onEdit={(x) => setSheet({ open: true, goal: x })} onArchive={handleArchive} />
  )

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Save toward a target</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Goals</h1>
          </div>

          <section className="mt-5">
            <div className="relative z-10 mb-3 flex items-end">
              <div className="relative min-w-0 max-w-2xl flex-1 rounded-[1.75rem] border border-border bg-card px-4 py-3.5 shadow-ios">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Fico&apos;s take
                </p>
                {loading ? (
                  <div className="mt-2 space-y-2" aria-label="Loading">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                ) : (
                  <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">{note}</p>
                )}
                <span aria-hidden="true" className="absolute -right-3.5 bottom-6 h-3.5 w-3.5 rounded-full border border-border bg-card shadow-sm sm:bottom-8" />
                <span aria-hidden="true" className="absolute -right-[1.65rem] bottom-4 h-2 w-2 rounded-full border border-border bg-card shadow-sm sm:bottom-6" />
              </div>
              <PeacockMascot pose="advisor" className="-mb-10 ml-7 h-24 w-24 shrink-0 sm:h-28 sm:w-28" label="Fico, your financial advisor" />
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#004C99] px-5 pb-5 pt-9 text-white shadow-ios-lg">
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white/75">Left to save</p>
                    <button
                      type="button"
                      onClick={() => setShowAmounts((v) => !v)}
                      aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
                      className="rounded-full p-1 text-white/75 hover:bg-white/15 hover:text-white"
                    >
                      {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheet({ open: true, goal: null })}
                    className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                {loading ? (
                  <Skeleton className="mt-2 h-10 w-52 bg-white/20 sm:h-12" />
                ) : (
                  <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{money(remaining)}</p>
                )}
                <p className="mt-1 text-xs text-white/75">Across the goals you have not reached yet</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {tiles.map((tile) => (
                    <div key={tile.label} className="rounded-2xl bg-white/12 p-3">
                      <p className="text-xs font-medium text-white/75">{tile.label}</p>
                      <div className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">
                        {loading ? <Skeleton className="h-6 w-20 bg-white/20" /> : tile.value === null ? tile.text : money(tile.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-5">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-52 animate-pulse rounded-3xl bg-secondary" />
                ))}
              </div>
            ) : goals.length === 0 ? (
              <div className="rounded-3xl border border-border bg-card p-10 shadow-ios">
                <EmptyState pose="advisor" title="No goals yet" description="Add something you are saving for, like an emergency fund or a move, and see how much to set aside each month.">
                  <button
                    type="button"
                    onClick={() => setSheet({ open: true, goal: null })}
                    className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Add one
                  </button>
                </EmptyState>
              </div>
            ) : (
              <div className="space-y-6">
                {active.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{active.map(card)}</div>}
                {reached.length > 0 && (
                  <section aria-label="Reached">
                    <h2 className="mb-2.5 px-1 font-heading text-sm font-semibold text-muted-foreground">Reached</h2>
                    <div className="grid gap-3 sm:grid-cols-2">{reached.map(card)}</div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </IonContent>

      <GoalSheet open={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} goal={sheet.goal} />
    </IonPage>
  )
}
