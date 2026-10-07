type TxLike = {
  type?: string
  amount?: number | string
  description?: string | null
  wallet?: { name?: string } | null
  toWallet?: { name?: string } | null
}

export type TransactionSuggestion = {
  /** What gets dropped into the chat box. */
  text: string
  /** Short name shown on the chip. */
  label: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
}

const FALLBACK: TransactionSuggestion[] = [
  { text: 'Spent 150 on lunch', label: 'Lunch', type: 'expense', amount: 150 },
  { text: 'Received 5000 freelance', label: 'Freelance', type: 'income', amount: 5000 },
  { text: 'Transfer 1000 from BPI to GCash', label: 'BPI to GCash', type: 'transfer', amount: 1000 },
]

const positive = (value: number | string | undefined) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Bank statement descriptions are long and shouty: keep the part before " · " and tidy the case. */
const tidy = (description: string) => {
  const first = description.split('·')[0].replace(/\s+/g, ' ').trim()
  if (first && first === first.toUpperCase()) {
    return first.toLowerCase().replace(/(^|[\s/-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
  }
  return first
}

/**
 * Chat starter suggestions built from what the user logs most often. Transactions are grouped by
 * type + description (transfers by wallet pair); the newest amount in each group is used.
 * `items` should be newest first. Falls back to generic examples to fill up to `limit`.
 */
export function frequentTransactionSuggestions(items: TxLike[] | undefined, limit = 3): TransactionSuggestion[] {
  const groups = new Map<string, { count: number; first: number; suggestion: TransactionSuggestion }>()

  ;(items ?? []).forEach((tx, index) => {
    const amount = positive(tx.amount)
    if (!amount) return
    const description = tx.description ? tidy(tx.description) : ''
    let key: string
    let suggestion: TransactionSuggestion

    if (tx.type === 'transfer') {
      const from = tx.wallet?.name?.trim()
      const to = tx.toWallet?.name?.trim()
      if (!from || !to) return
      key = `transfer|${from.toLowerCase()}|${to.toLowerCase()}`
      suggestion = { text: `Transfer ${amount} from ${from} to ${to}`, label: `${from} to ${to}`, type: 'transfer', amount }
    } else if (tx.type === 'expense' && description) {
      key = `expense|${description.toLowerCase()}`
      suggestion = { text: `Spent ${amount} on ${description}`, label: description, type: 'expense', amount }
    } else if (tx.type === 'income' && description) {
      key = `income|${description.toLowerCase()}`
      suggestion = { text: `Received ${amount} ${description}`, label: description, type: 'income', amount }
    } else {
      return
    }

    const group = groups.get(key)
    if (group) group.count += 1
    else groups.set(key, { count: 1, first: index, suggestion })
  })

  const result = [...groups.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .map((g) => g.suggestion)
    .slice(0, limit)

  for (const fallback of FALLBACK) {
    if (result.length >= limit) break
    if (!result.some((r) => r.text === fallback.text)) result.push(fallback)
  }
  return result
}
