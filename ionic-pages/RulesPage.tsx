'use client'

import { useMemo } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { ArrowDown, ArrowUp, Plus, Wand2 } from 'lucide-react'
import { EmptyState } from '@/components/peacock-mascot'
import { ManageHeader } from '@/components/page/manage-header'
import { useRuleSheet } from '@/components/page/rules/rule-sheet'
import { Switch } from '@/components/ui/switch'
import { useListCategories } from '@/queries/user/category/categories'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useListRules, useReorderRules, useUpdateRule } from '@/queries/user/rule/rules'
import { orderRules, RULE_OPS, type Rule } from '@/utils/rules'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.wallets) ? data.wallets : [])
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Manage > Rules: "description contains X -> category Y", run in order wherever a transaction is filled in. */
export default function RulesPage() {
  const { data, isLoading } = useListRules()
  const rules = useMemo(() => orderRules(data ?? []), [data])
  const openSheet = useRuleSheet((s) => s.open)
  const update = useUpdateRule()
  const reorder = useReorderRules()

  const { data: categoriesResponse } = useListCategories()
  const { data: walletsResponse } = useListWallets()
  const names = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of asList(categoriesResponse?.data)) map.set(String(c._id ?? c.id), c.name)
    for (const w of asList(walletsResponse?.data)) map.set(String(w._id ?? w.id), w.name)
    return map
  }, [categoriesResponse, walletsResponse])

  const move = (index: number, by: -1 | 1) => {
    const ids = rules.map((r) => r.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + by, 0, id)
    reorder.mutate(ids)
  }

  const on = rules.filter((r) => r.enabled).length
  const openNew = () => openSheet({})
  const openEdit = (rule: Rule) => openSheet(rule)

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-3xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <ManageHeader
            eyebrow="Sort automatically"
            title="Rules"
            loading={isLoading}
            summary={rules.length > 0 ? `${rules.length} rule${rules.length === 1 ? '' : 's'} · ${on} on · first match wins` : undefined}
            statsHref=""
            onAdd={openNew}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Rules fill in the category when you add a transaction, paste a bank message, scan a receipt, import a file or sort your inbox. They run top to bottom.
          </p>

          <div className="mt-5">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-3xl bg-secondary" />
                ))}
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-3xl border border-border bg-card p-10 shadow-ios">
                <EmptyState pose="advisor" title="No rules yet" description='Try "description contains jollibee → Food". You can also make one right after you fix a category.'>
                  <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                    <Plus className="h-4 w-4" />
                    Add a rule
                  </button>
                </EmptyState>
              </div>
            ) : (
              <ol className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card shadow-ios">
                {rules.map((rule, i) => {
                  const op = RULE_OPS.find((o) => o.value === rule.matchOp)?.label ?? rule.matchOp
                  const sets = [
                    rule.setCategoryId && (names.get(rule.setCategoryId) ?? 'a removed category'),
                    rule.setWalletId && (names.get(rule.setWalletId) ?? 'a removed wallet'),
                    ...rule.setTags.map((t) => `#${t}`),
                  ].filter(Boolean)
                  return (
                    <li key={rule.id} className={cn('flex items-center gap-3 px-4 py-3', !rule.enabled && 'opacity-60')}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold tabular-nums text-primary">{i + 1}</span>
                      <button type="button" onClick={() => openEdit(rule)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[15px] font-medium text-foreground">
                          {rule.matchField === 'notes' ? 'Notes' : 'Description'} {op} “{rule.matchValue}”
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Wand2 className="h-3 w-3 shrink-0" />
                          {sets.join(' · ') || 'Sets nothing'}
                          {rule.matchType ? ` · ${rule.matchType === 'income' ? 'income only' : 'expenses only'}` : ''}
                        </span>
                      </button>
                      <div className="flex shrink-0 flex-col">
                        <button type="button" aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label="Move down" disabled={i === rules.length - 1 || reorder.isPending} onClick={() => move(i, 1)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30">
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                      <Switch checked={rule.enabled} onCheckedChange={(enabled) => update.mutate({ id: rule.id, enabled })} aria-label={rule.enabled ? 'Turn rule off' : 'Turn rule on'} />
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </main>
      </IonContent>
    </IonPage>
  )
}
