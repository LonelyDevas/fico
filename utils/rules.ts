// Categorization rules: "description contains 'jollibee' -> category Food".
//
// Rules run in the order the user set (position). Each field (category, wallet) is set by the first
// enabled rule that matches and sets it; later matching rules only fill what is still empty, and
// tags from every matching rule are added. A disabled rule is skipped. Matching ignores case and
// extra spaces. Pure functions, so they run the same everywhere a transaction is filled in.

export type RuleField = 'description' | 'notes'
export type RuleOp = 'contains' | 'equals' | 'starts_with' | 'ends_with'

export interface Rule {
  id: string
  position: number
  matchField: RuleField
  matchOp: RuleOp
  matchValue: string
  /** Only expenses or only income; null matches both. */
  matchType: 'expense' | 'income' | null
  setCategoryId: string | null
  setTags: string[]
  setWalletId: string | null
  enabled: boolean
}

export interface RuleInput {
  description?: string | null
  notes?: string | null
  type?: string | null
}

export interface RuleResult {
  categoryId: string | null
  walletId: string | null
  tags: string[]
  /** Rules that matched, in order (for "set by rule …" hints). */
  matched: Rule[]
  /** The rule that set the category, if any. */
  categoryRule: Rule | null
}

export const RULE_OPS: { value: RuleOp; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'equals', label: 'is exactly' },
]

export const normalize = (text?: string | null) => (text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

export function ruleMatches(rule: Rule, input: RuleInput): boolean {
  if (!rule.enabled) return false
  const needle = normalize(rule.matchValue)
  if (!needle) return false
  // Rules are for spending and income; transfers are left alone.
  if (input.type === 'transfer') return false
  if (rule.matchType && input.type && rule.matchType !== input.type) return false
  const hay = normalize(rule.matchField === 'notes' ? input.notes : input.description)
  if (!hay) return false
  switch (rule.matchOp) {
    case 'equals':
      return hay === needle
    case 'starts_with':
      return hay.startsWith(needle)
    case 'ends_with':
      return hay.endsWith(needle)
    default:
      return hay.includes(needle)
  }
}

/** Rules in the order they run. Ties keep the order given. */
export const orderRules = (rules: Rule[]) => rules.map((r, i) => ({ r, i })).sort((a, b) => a.r.position - b.r.position || a.i - b.i).map(({ r }) => r)

export function applyRules(rules: Rule[], input: RuleInput): RuleResult {
  const result: RuleResult = { categoryId: null, walletId: null, tags: [], matched: [], categoryRule: null }
  for (const rule of orderRules(rules)) {
    if (!ruleMatches(rule, input)) continue
    result.matched.push(rule)
    if (!result.categoryId && rule.setCategoryId) {
      result.categoryId = rule.setCategoryId
      result.categoryRule = rule
    }
    if (!result.walletId && rule.setWalletId) result.walletId = rule.setWalletId
    for (const tag of rule.setTags ?? []) if (tag && !result.tags.includes(tag)) result.tags.push(tag)
  }
  return result
}

/**
 * A rule worth offering after the user fixes a category: the payee part of the note, without
 * reference numbers, amounts or dates. Null when the note has nothing distinctive to match on.
 */
export function suggestRuleValue(description?: string | null): string | null {
  const cleaned = normalize(description)
    .replace(/\b(ref(erence)?|txn|trx|no|#)\s*[:.]?\s*[a-z0-9-]*\d[a-z0-9-]*/g, ' ')
    .replace(/(php|₱|p)\s?[\d,]+(\.\d+)?/g, ' ')
    .replace(/[\d/:.,-]{3,}/g, ' ')
    .replace(/\d{4,}/g, ' ')
    .replace(/[^\p{L}\p{N}&' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length < 3) return null
  // Long notes: the first few words name the payee ("jollibee sm north edsa" -> "jollibee sm north").
  return cleaned.split(' ').slice(0, 3).join(' ')
}

/** True when an existing rule already gives this note this category (no need to offer a new one). */
export function ruleAlreadyCovers(rules: Rule[], input: RuleInput, categoryId: string): boolean {
  return applyRules(rules, input).categoryId === categoryId
}
