import { parseTransactionText, matchWallet, type ParserCategory } from '@/utils/transaction-parser'

/**
 * Short answers to the questions people ask the Fico chat ("magkano nagastos ko this week?",
 * "balance ko sa gcash") from the wallets and recent transactions the app already has loaded.
 */

export interface AnswerWallet {
  id?: string
  _id?: string
  name?: string
  type?: string
  status?: string
  balance?: number | string
}

export interface AnswerTransaction {
  type?: string
  amount?: number | string
  date?: string
  description?: string | null
  category?: { name?: string | null } | null
}

export interface AnswerData {
  wallets: AnswerWallet[]
  /** Newest first. */
  transactions: AnswerTransaction[]
  /** True when `transactions` holds every transaction, not just the latest page. */
  complete: boolean
  categories?: ParserCategory[]
  format: (amount: number) => string
  now?: Date
}

type Period = { label: string; start: Date; end: Date }

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

function readPeriod(lower: string, now: Date): Period {
  const today = day(now)
  const monday = addDays(today, -((today.getDay() + 6) % 7))
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  if (/\b(today|ngayon(?!g\s+(linggo|buwan|week|month))|ngayong araw|kanina)\b/.test(lower)) return { label: 'today', start: today, end: today }
  if (/\b(yesterday|kahapon)\b/.test(lower)) return { label: 'yesterday', start: addDays(today, -1), end: addDays(today, -1) }
  if (/\b(last week|noong isang linggo|nakaraang linggo)\b/.test(lower)) return { label: 'last week', start: addDays(monday, -7), end: addDays(monday, -1) }
  if (/\b(this week|ngayong linggo|week)\b/.test(lower)) return { label: 'this week', start: monday, end: today }
  if (/\b(last month|noong nakaraang buwan|nakaraang buwan)\b/.test(lower)) {
    return { label: 'last month', start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: addDays(monthStart, -1) }
  }
  if (/\b(this year|ngayong taon|year)\b/.test(lower)) return { label: 'this year', start: new Date(today.getFullYear(), 0, 1), end: today }
  return { label: 'this month', start: monthStart, end: today }
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function answerBalance(text: string, data: AnswerData): string {
  const wallets = data.wallets.filter((w) => w.status !== 'archived' && w.name)
  if (wallets.length === 0) return "You don't have any wallets yet. Add one in **Money** and I'll keep track of it."
  const parsed = parseTransactionText(text, { wallets: wallets.map((w) => ({ name: w.name!, type: w.type })) })
  const named = matchWallet(parsed.fromWalletName, wallets)
  if (named) {
    const balance = num(named.balance)
    return named.type === 'credit_card'
      ? `You owe **${data.format(balance)}** on **${named.name}**.`
      : `**${named.name}** has **${data.format(balance)}**.`
  }
  const cards = wallets.filter((w) => w.type === 'credit_card')
  const money = wallets.filter((w) => w.type !== 'credit_card')
  const total = money.reduce((sum, w) => sum + num(w.balance), 0)
  const lines = [...money]
    .sort((a, b) => num(b.balance) - num(a.balance))
    .map((w) => `• ${w.name}: ${data.format(num(w.balance))}`)
  const owed = cards.reduce((sum, w) => sum + num(w.balance), 0)
  return [
    `You have **${data.format(total)}** across your wallets.`,
    lines.join('\n'),
    owed > 0 ? `Credit cards owed: **${data.format(owed)}**.` : '',
  ].filter(Boolean).join('\n\n')
}

function answerFlow(text: string, lower: string, data: AnswerData, type: 'expense' | 'income'): string {
  const now = data.now ?? new Date()
  const period = readPeriod(lower, now)
  const startIso = isoDay(period.start)
  const endIso = isoDay(period.end)
  const parsed = parseTransactionText(text, { categories: data.categories, now })
  // Only filter by category when the question names one ("spent on food"), not from the money words.
  const category = /\b(on|sa|for|para sa|ng)\s+\w/.test(lower) ? parsed.inferredCategoryName : undefined

  const rows = data.transactions.filter((t) => {
    if (t.type !== type) return false
    const d = String(t.date ?? '').slice(0, 10)
    if (!d || d < startIso || d > endIso) return false
    if (category && (t.category?.name ?? '').toLowerCase() !== category.toLowerCase()) return false
    return true
  })
  const total = rows.reduce((sum, t) => sum + num(t.amount), 0)
  const oldest = data.transactions[data.transactions.length - 1]?.date
  const partial = !data.complete && !!oldest && String(oldest).slice(0, 10) > startIso
  const what = type === 'expense' ? 'spent' : 'received'
  const scope = category ? ` on **${category}**` : ''
  if (rows.length === 0) {
    return partial
      ? `I can only see your latest transactions, and none of them are ${type === 'expense' ? 'expenses' : 'income'}${scope} ${period.label}. Open **Activity** for the full history.`
      : `You haven't ${what} anything${scope} ${period.label}.`
  }
  const top =
    type === 'expense' && !category
      ? topCategories(rows)
          .slice(0, 3)
          .map(([name, amount]) => `• ${name}: ${data.format(amount)}`)
          .join('\n')
      : ''
  return [
    `You ${what} ${partial ? 'at least ' : ''}**${data.format(total)}**${scope} ${period.label} (${rows.length} transaction${rows.length === 1 ? '' : 's'}).`,
    top ? `Biggest categories:\n${top}` : '',
    partial ? 'That only counts your latest transactions; **Activity** has the full total.' : '',
  ].filter(Boolean).join('\n\n')
}

function topCategories(rows: AnswerTransaction[]): [string, number][] {
  const totals = new Map<string, number>()
  for (const t of rows) {
    const name = t.category?.name || 'Uncategorized'
    totals.set(name, (totals.get(name) ?? 0) + num(t.amount))
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function answerQuestion(text: string, data: AnswerData): string {
  const lower = text.toLowerCase()
  if (/\b(balance|balances|natitira|pera ko|laman|how much (money )?(do i have|is left|left)|magkano (pa )?(ang )?(pera|laman))\b/.test(lower)) {
    return answerBalance(text, data)
  }
  if (/\b(income|earn(ed)?|kinita|kita ko|sahod|sweldo|received|natanggap|pumasok)\b/.test(lower)) return answerFlow(text, lower, data, 'income')
  if (/\b(spen[dt]|spending|gastos|nagastos|ginastos|gumastos|expenses?|binayad|labas)\b/.test(lower)) return answerFlow(text, lower, data, 'expense')
  return (
    "I can't answer that one yet. I can log transactions and tell you your **balance** or how much you **spent** or **received** in a period. " +
    'Try "how much did I spend this week?" or "balance ko sa gcash".'
  )
}

export const HELP_TEXT = [
  'Tell me what you spent or received in your own words and I\'ll fill in the form:',
  '• "80 lunch cash"',
  '• "Spent ₱1.2k sa groceries kahapon via GCash"',
  '• "sahod 25k bdo"',
  '• "transfer 2k gotyme to maya"',
  '• "withdraw 3000 from bdo"',
  'You can also ask "balance ko?" or "how much did I spend this week?", or send a receipt photo 📷',
].join('\n')
