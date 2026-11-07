import { matchCategory, parseTransactionText } from '@/utils/transaction-parser'
import { applyRules, type Rule } from '@/utils/rules'

/**
 * Picks a category to suggest for an uncategorized transaction: a rule you set, else the category
 * you used most for the same note before, otherwise what the chat parser reads from the note. Runs offline on loaded data.
 */
export type TriageCategory = { id: string; name: string; type?: string }
export type TriageHistory = { description?: string | null; categoryId?: string | null; type?: string }

/** "GRAB PHILIPPINES  " and "Grab Philippines" are the same payee. Long digit runs (refs) are dropped. */
export const noteKey = (note?: string | null) =>
  (note ?? '')
    .toLowerCase()
    .replace(/\d{4,}/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function suggestCategory(
  txn: { description?: string | null; type?: string },
  history: TriageHistory[],
  categories: TriageCategory[],
  rules: Rule[] = []
): { category: TriageCategory; reason: 'rule' | 'history' | 'note' } | null {
  const usable = categories.filter((c) => !c.type || !txn.type || c.type === txn.type)
  const ruled = applyRules(rules, { description: txn.description, type: txn.type })
  const fromRule = ruled.categoryId && usable.find((c) => c.id === ruled.categoryId)
  if (fromRule) return { category: fromRule, reason: 'rule' }
  const key = noteKey(txn.description)
  if (key) {
    const counts = new Map<string, number>()
    for (const h of history) {
      if (!h.categoryId || (txn.type && h.type && h.type !== txn.type)) continue
      if (noteKey(h.description) === key) counts.set(h.categoryId, (counts.get(h.categoryId) ?? 0) + 1)
    }
    const best = [...counts].sort((a, b) => b[1] - a[1])[0]
    const fromHistory = best && usable.find((c) => c.id === best[0])
    if (fromHistory) return { category: fromHistory, reason: 'history' }
  }
  if (!txn.description) return null
  const parsed = parseTransactionText(`${txn.type === 'income' ? 'received' : 'spent'} 1 ${txn.description}`, {
    categories: usable.map((c) => ({ name: c.name, type: (c.type as any) ?? undefined })),
  })
  const match = matchCategory(parsed.inferredCategoryName, (txn.type as any) ?? 'expense', usable)
  return match ? { category: match, reason: 'note' } : null
}
