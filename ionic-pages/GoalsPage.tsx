'use client'

import { useMemo, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState } from '@/components/peacock-mascot'
import { GoalCard } from '@/components/page/goals/goal-card'
import { GoalSheet } from '@/components/page/goals/goal-sheet'
import { asGoalWallets, goalProgress } from '@/components/page/goals/goal-progress'
import { useListGoals, useUpdateGoal } from '@/queries/user/goal/goals'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useSettingsStore } from '@/store/settings-store'
import { ManageHeader } from '@/components/page/manage-header'
import { formatMoney } from '@/utils/formatter'
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
  const money = (value: number) => formatMoney(value, currency, !showAmounts)

  const handleArchive = (goal: Goal) =>
    update({ id: goal.id, status: 'archived' }, { onSuccess: () => toast.success('Archived') })

  const card = ({ goal, progress }: (typeof goals)[number]) => (
    <GoalCard key={goal.id} goal={goal} progress={progress} hideAmounts={!showAmounts} onEdit={(x) => setSheet({ open: true, goal: x })} onArchive={handleArchive} />
  )

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <ManageHeader
            statsHref="/statistics#goals-total"
            eyebrow="Save toward a target"
            title="Goals"
            loading={loading}
            summary={goals.length > 0 ? `${money(remaining)} left to save · ${active.length} open${reached.length ? `, ${reached.length} reached` : ''}` : undefined}
            showAmounts={showAmounts}
            onToggleAmounts={() => setShowAmounts((v) => !v)}
            onAdd={() => setSheet({ open: true, goal: null })}
          />

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
