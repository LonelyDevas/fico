import type { TransactionType } from '@/types/transaction'
import { PH_INSTITUTIONS, matchInstitution } from '@/lib/ph-institutions'

/**
 * Reads a chat message like "80 lunch cash", "Spent ₱1.5k sa groceries kahapon via GCash" or
 * "transfer 2k bdo to gotyme" into the fields of a transaction.
 *
 * It runs fully offline. Each extractor blanks out the part of the message it used (the amount,
 * the date, the wallet, a service fee) so that what is left over becomes the note, and so that a
 * number or word is never read twice.
 *
 * Pass the user's wallets, categories and recent transactions as `context` so it can recognise
 * their own wallet and category names and reuse what they picked the last time they logged the
 * same thing.
 */

export interface ParsedTransaction {
  amount?: number
  description?: string
  type?: TransactionType
  date?: string // ISO date string YYYY-MM-DD
  inferredCategoryName?: string
  fromWalletName?: string  // the wallet; for a transfer, the source
  toWalletName?: string    // transfer: destination wallet
  serviceFee?: number      // extracted service charge/fee
  /** True when the category, wallet or amount came from a past transaction with the same note. */
  matchedHistory?: boolean
  /** True when no amount was typed and the last amount for this note was reused. */
  amountFromHistory?: boolean
  confidence: {
    amount: number   // 0-1
    type: number     // 0-1
    date: number     // 0-1
    category: number // 0-1
  }
}

export interface ParserWallet {
  name: string
  type?: string
}

export interface ParserCategory {
  name: string
  type?: string
}

/** A past transaction, newest first. Shaped like the rows useListTransactions returns. */
export interface ParserHistoryItem {
  description?: string | null
  type?: string
  amount?: number | string
  categoryName?: string | null
  walletName?: string | null
  toWalletName?: string | null
}

export interface ParseContext {
  wallets?: (string | ParserWallet)[]
  categories?: ParserCategory[]
  history?: ParserHistoryItem[]
  /** Defaults to the current time. Tests pin it. */
  now?: Date
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A phrase where spaces and hyphens are optional, so "g cash", "g-cash" and "gcash" all match. */
const phraseSource = (phrase: string) =>
  phrase.trim().toLowerCase().split(/[\s-]+/).map(escapeRegex).join('[\\s-]*')

/** Whole-word match of any phrase. Group 1 is the character before the phrase, group 2 the phrase. */
const phraseRegex = (phrases: string[], plural = false) =>
  new RegExp(
    `(^|[^a-z0-9])((?:${[...phrases].sort((a, b) => b.length - a.length).map(phraseSource).join('|')})${plural ? '(?:e?s)?' : ''})(?=$|[^a-z0-9])`,
    'gi'
  )

interface Span {
  start: number
  end: number
  text: string
}

function findAll(text: string, re: RegExp): Span[] {
  const spans: Span[] = []
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const start = m.index + m[1].length
    spans.push({ start, end: start + m[2].length, text: m[2] })
    if (m[0].length === 0) re.lastIndex++
  }
  return spans
}

const findFirst = (text: string, re: RegExp): Span | undefined => findAll(text, re)[0]

/** The message with the parts already used blanked out. Blanking keeps every position stable. */
class Work {
  constructor(public text: string) {}
  blank(start: number, end: number) {
    this.text = this.text.slice(0, start) + ' '.repeat(Math.max(0, end - start)) + this.text.slice(end)
  }
  get lower() {
    return this.text.toLowerCase()
  }
}

function normalize(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    // "7-11" and "7/11" are the store, not a date or an amount.
    .replace(/(^|[^0-9/])7\s*[-/]?\s*(?:11|eleven)(?![0-9])/gi, '$17-Eleven')
    .trim()
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, enero: 0,
  feb: 1, february: 1, pebrero: 1, febrero: 1,
  mar: 2, march: 2, marso: 2,
  apr: 3, april: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, june: 5, hunyo: 5,
  jul: 6, july: 6, hulyo: 6,
  aug: 7, august: 7, agosto: 7,
  sep: 8, sept: 8, september: 8, setyembre: 8, septiyembre: 8,
  oct: 9, october: 9, oktubre: 9,
  nov: 10, november: 10, nobyembre: 10,
  dec: 11, december: 11, disyembre: 11,
}
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  lunes: 1, martes: 2, miyerkules: 3, miyerkoles: 3, myerkules: 3, huwebes: 4, biyernes: 5, byernes: 5, sabado: 6,
}
const WEEKDAY_SHORT: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6, linggo: 0 }

const SMALL_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, isang: 1, two: 2, dalawang: 2, three: 3, tatlong: 3, four: 4, five: 5, limang: 5,
  six: 6, seven: 7, couple: 2, few: 3,
}

interface DateResult {
  date?: string
  confidence: number
}

/** A month/day with no year that lands in the future means last year (you log what already happened). */
function pastDate(now: Date, year: number | undefined, month: number, day: number): Date | undefined {
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined
  let d = new Date(year ?? now.getFullYear(), month, day)
  if (d.getMonth() !== month) return undefined
  if (year === undefined && d > addDays(startOfDay(now), 1)) d = new Date(now.getFullYear() - 1, month, day)
  return d
}

const fullYear = (raw?: string) => (raw ? (raw.length <= 2 ? 2000 + parseInt(raw) : parseInt(raw)) : undefined)

type DateRule = { re: RegExp; read: (m: RegExpExecArray, now: Date) => Date | undefined; confidence: number }

const B = '(^|[^a-z0-9])'
const E = '(?=$|[^a-z0-9])'

const DATE_RULES: DateRule[] = [
  {
    re: new RegExp(`${B}(day before yesterday|kamakalawa|noong isang araw|nung isang araw)${E}`, 'i'),
    read: (_m, now) => addDays(now, -2),
    confidence: 0.9,
  },
  {
    re: new RegExp(`${B}((\\d{1,2}|${Object.keys(SMALL_NUMBERS).join('|')})\\s+(days?|araw|weeks?|linggo)\\s+(?:na\\s+)?(?:ang\\s+)?(?:ago|nakalipas|nakaraan))${E}`, 'i'),
    read: (m, now) => {
      const n = /^\d+$/.test(m[3]) ? parseInt(m[3]) : SMALL_NUMBERS[m[3].toLowerCase()] ?? 1
      const unit = /^(weeks?|linggo)$/i.test(m[4]) ? 7 : 1
      return addDays(now, -n * unit)
    },
    confidence: 0.9,
  },
  {
    re: new RegExp(`${B}(last week|last wk|noong isang linggo|nung isang linggo|nakaraang linggo)${E}`, 'i'),
    read: (_m, now) => addDays(now, -7),
    confidence: 0.7,
  },
  {
    re: new RegExp(`${B}(yesterday|yday|ystd|kahapon|last night|kagabi)${E}`, 'i'),
    read: (_m, now) => addDays(now, -1),
    confidence: 1,
  },
  {
    re: new RegExp(`${B}(today|tdy|ngayong araw|ngayon|kanina|kaninang umaga|this morning|this afternoon|this evening|tonight|just now)${E}`, 'i'),
    read: (_m, now) => startOfDay(now),
    confidence: 1,
  },
  // "last monday", "noong lunes", "on fri", "monday"
  {
    re: new RegExp(
      `${B}((?:(last|this past|noong|nung|nitong|on)\\s+)(${[...Object.keys(WEEKDAYS), ...Object.keys(WEEKDAY_SHORT)].join('|')})|(${Object.keys(WEEKDAYS).join('|')}))${E}`,
      'i'
    ),
    read: (m, now) => {
      const name = (m[4] ?? m[5]).toLowerCase()
      const target = WEEKDAYS[name] ?? WEEKDAY_SHORT[name]
      let diff = now.getDay() - target
      if (diff < 0) diff += 7
      if (diff === 0 && m[3] && /last|past/i.test(m[3])) diff = 7
      return addDays(now, -diff)
    },
    confidence: 0.85,
  },
  // "March 5", "Mar 5, 2026", "Oct. 3rd"
  {
    re: new RegExp(`${B}((${MONTH_ALT})\\.?\\s+(\\d{1,2})(?![,.]\\d)(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?)(?=$|[^a-z0-9])`, 'i'),
    read: (m, now) => {
      const monthWord = m[3].toLowerCase()
      // Filipino "may" ("there is") is common: only read it as the month when it clearly is one.
      if (monthWord === 'may' && !m[5] && !/^\s*([,.!?;]|$)/.test(m.input.slice(m.index + m[0].length)) && !/(on|last|noong|nung|this)\s*$/i.test(m.input.slice(0, m.index + m[1].length))) {
        return undefined
      }
      return pastDate(now, fullYear(m[5]), MONTHS[monthWord], parseInt(m[4]))
    },
    confidence: 0.9,
  },
  // "5 March", "5th of Oct 2026"
  {
    re: new RegExp(`${B}((\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_ALT})\\.?(?:,?\\s+(\\d{4}))?)${E}`, 'i'),
    read: (m, now) => (m[4].toLowerCase() === 'may' ? undefined : pastDate(now, fullYear(m[5]), MONTHS[m[4].toLowerCase()], parseInt(m[3]))),
    confidence: 0.9,
  },
  // 2026-03-05, 2026/03/05
  {
    re: new RegExp(`${B}((\\d{4})[-/](\\d{1,2})[-/](\\d{1,2}))${E}`, 'i'),
    read: (m) => pastDate(new Date(9999, 0), parseInt(m[3]), parseInt(m[4]) - 1, parseInt(m[5])),
    confidence: 0.95,
  },
  // 03/05/2026, 3/5/26, 03-05-2026, 3/5
  {
    re: new RegExp(`${B}((\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?|(\\d{1,2})-(\\d{1,2})-(\\d{4}))${E}`, 'i'),
    read: (m, now) => {
      const month = parseInt(m[3] ?? m[6]) - 1
      const day = parseInt(m[4] ?? m[7])
      return pastDate(now, fullYear(m[5] ?? m[8]), month, day)
    },
    confidence: 0.85,
  },
  // "on the 5th", "noong ika-5", "nung 5th"
  {
    re: new RegExp(`${B}((?:on the|noong|nung)\\s+(?:ika-?\\s*)?(\\d{1,2})(?:st|nd|rd|th)|(?:noong|nung)?\\s*ika-?\\s*(\\d{1,2}))${E}`, 'i'),
    read: (m, now) => {
      const day = parseInt(m[3] ?? m[4])
      const d = pastDate(now, now.getFullYear(), now.getMonth(), day)
      return d && d > now ? pastDate(now, undefined, now.getMonth() - 1 < 0 ? 11 : now.getMonth() - 1, day) : d
    },
    confidence: 0.8,
  },
]

function extractDate(work: Work, now: Date): DateResult {
  for (const rule of DATE_RULES) {
    const re = new RegExp(rule.re.source, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(work.text))) {
      const d = rule.read(m, now)
      if (d && !isNaN(d.getTime())) {
        const start = m.index + m[1].length
        work.blank(start, start + m[2].length)
        // Drop a leading "on"/"noong" left in front of the date.
        const before = work.text.slice(0, start).match(/(?:^|\s)(on|noong|nung|last|this|nitong)\s*$/i)
        if (before) work.blank(start - before[0].length + (before[0].startsWith(' ') ? 1 : 0), start)
        return { date: isoDate(d), confidence: rule.confidence }
      }
      if (m[0].length === 0) re.lastIndex++
    }
  }
  return { date: undefined, confidence: 0 }
}

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

// Optional currency in front, the number, an optional "k"/"thousand", an optional currency after.
const AMOUNT_RE =
  /(₱|php|\$|usd|(?:^|[^a-z0-9])p)?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)(\s?(?:k|thousand|libo|mil|million|milyon|m)(?![a-z]))?(\s?(?:pesos?|piso|php|dollars?|usd|bucks|p)(?![a-z]))?/gi

// What follows a number that makes it a count, a time or a size instead of money.
const NOT_MONEY_AFTER =
  /^\s?(?:%|am\b|pm\b|:\d|x\b|pcs?\b|pieces?\b|piraso\b|kg\b|kilos?\b|g\b|grams?\b|ml\b|l\b|liters?\b|litro\b|days?\b|araw\b|hours?\b|hrs?\b|mins?\b|minutes?\b|people\b|pax\b|persons?\b|tao\b|gb\b|mb\b|items?\b|cups?\b|bottles?\b|boxes?\b|packs?\b|times\b|beses\b|months?\b|buwan\b|years?\b|yrs?\b|taon\b|st\b|nd\b|rd\b|th\b|-[a-z])/i
const MONEY_CUE_BEFORE = /(?:for|worth|@|=|:|total|amount|amt|price|cost|halagang|halaga|nagkakahalaga|presyo)\s*$/i

interface AmountCandidate {
  value: number
  start: number
  end: number
  score: number
}

function amountCandidates(text: string): AmountCandidate[] {
  const out: AmountCandidate[] = []
  AMOUNT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = AMOUNT_RE.exec(text))) {
    const [full, prefixRaw, numRaw, multRaw, suffixRaw] = m
    const leading = prefixRaw && /^[^a-z0-9₱$]/i.test(prefixRaw) ? 1 : 0
    const start = m.index + leading
    const end = m.index + full.length
    const numStart = m.index + full.indexOf(numRaw)
    const before = text.slice(0, numStart)
    const after = text.slice(end)
    const hasCurrency = !!(prefixRaw || suffixRaw)
    const mult = (multRaw ?? '').trim().toLowerCase()

    // Glued to a word ("iphone15", "13th", "x2"): not money.
    if (!prefixRaw && /[a-z]$/i.test(before)) continue
    if (/^[a-z0-9]/i.test(after) && !suffixRaw && !multRaw) continue
    if (!hasCurrency && !mult && NOT_MONEY_AFTER.test(after)) continue
    if (/(?:^|\s)x\s?$/i.test(before) && !hasCurrency) continue // "x2"
    if (/\d:$/.test(before)) continue // the minutes of "3:30"
    if (/(?:#|no\.?|ref(?:erence)?\.?|acct\.?|tin)\s*$/i.test(before)) continue

    const digits = numRaw.replace(/,/g, '')
    if (/^0\d{3,}/.test(digits)) continue // phone numbers, account numbers
    if (digits.split('.')[0].length > 9) continue
    let value = parseFloat(digits)
    if (!isFinite(value) || value <= 0) continue
    if (mult === 'k' || mult === 'thousand' || mult === 'libo') value *= 1_000
    else if (mult === 'm' || mult === 'mil' || mult === 'million' || mult === 'milyon') {
      if (mult === 'm' && !hasCurrency) continue // "5m" is more likely metres or minutes
      value *= 1_000_000
    }
    value = Math.round(value * 100) / 100

    let score = 1
    if (hasCurrency || mult) score = 3
    else if (MONEY_CUE_BEFORE.test(before)) score = 2
    // A bare year is rarely the amount.
    if (score === 1 && /^(19|20)\d{2}$/.test(digits)) score = 0
    out.push({ value, start, end, score })
  }
  return out
}

const ITEM_JOINER = /^[\s,]*(?:,|\+|&|and|tapos|at|plus|then|saka|tsaka|pati)[\s,]/i

function pickAmount(text: string): { candidate?: AmountCandidate; parts?: AmountCandidate[]; confidence: number } {
  const list = amountCandidates(text)
  if (list.length === 0) return { confidence: 0 }
  // "samgyup 250 tapos milktea 100", "lunch 150 and coffee 120": items joined by "and" add up.
  if (list.length >= 2 && list.every((c) => c.score === list[0].score && c.score >= 1)) {
    const joined = list.slice(1).every((c, i) => {
      const between = text.slice(list[i].end, c.start)
      return ITEM_JOINER.test(between) || /(?:^|\s)(?:,|\+|&|and|tapos|at|plus|then|saka|tsaka|pati)(?:\s|$)/i.test(between)
    })
    if (joined) {
      const total = Math.round(list.reduce((sum, c) => sum + c.value, 0) * 100) / 100
      return { candidate: { value: total, start: list[0].start, end: list[0].end, score: list[0].score }, parts: list, confidence: 0.75 }
    }
  }
  const best = [...list].sort((a, b) => b.score - a.score || b.value - a.value)[0]
  const confidence = best.score === 3 ? 0.95 : best.score === 2 ? 0.85 : list.length === 1 ? 0.8 : 0.65
  return { candidate: best, confidence }
}

// ---------------------------------------------------------------------------
// Service fee
// ---------------------------------------------------------------------------

const AMOUNT_PART = '(?:₱|php|p)?\\s?(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)(?:\\s?(?:pesos?|php|p))?(?![a-z0-9])'
const FEE_WORD = '(?:(?:service|transaction|convenience|transfer|processing|cash[\\s-]?in|cash[\\s-]?out|bank|instapay|pesonet|delivery|shipping)\\s+)?(?:fee|charge|charges|singil)'
const FEE_RULES = [
  new RegExp(`${B}((?:\\+|plus|with|w/|and)?\\s*(?:a\\s+)?${FEE_WORD}\\s*(?:of|is|na|:|=)?\\s*${AMOUNT_PART})`, 'i'),
  new RegExp(`${B}((?:\\+|plus|with|w/|and)?\\s*${AMOUNT_PART}\\s*${FEE_WORD})${E}`, 'i'),
]

function extractServiceFee(work: Work): number | undefined {
  for (const re of FEE_RULES) {
    const m = re.exec(work.text)
    if (!m) continue
    const value = parseFloat(m[3].replace(/,/g, ''))
    if (!(value > 0)) continue
    const start = m.index + m[1].length
    const end = start + m[2].length
    // The fee only counts when the message still has a main amount ("exam fee 500" is the amount).
    const trial = new Work(work.text)
    trial.blank(start, end)
    if (!pickAmount(trial.text).candidate) return undefined
    work.blank(start, end)
    return value
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------

const GENERIC_WALLET_WORDS = new Set(['my', 'main', 'wallet', 'account', 'acct', 'acc', 'personal', 'primary', 'the', 'ko'])
// Words that don't single out a wallet on their own.
const WEAK_WALLET_WORDS = new Set(['card', 'bank', 'credit', 'debit', 'fund', 'funds', 'online', 'digital', 'unibank', 'pay', 'cash', 'money'])
const EXTRA_WALLET_ALIASES: Record<string, string[]> = {
  gcash: ['g cash', 'gcsh'],
  maya: ['paymaya', 'pay maya'],
  unionbank: ['union bank', 'ub'],
  landbank: ['land bank', 'lbp'],
  securitybank: ['secbank', 'security bank'],
  seabank: ['sea bank'],
  gotyme: ['go tyme', 'gotime'],
  metrobank: ['metro bank'],
  chinabank: ['china bank'],
  grabpay: ['grab pay'],
  shopeepay: ['shopee pay', 'spay'],
  pagibig: ['pag ibig', 'pagibig'],
}
// Institution short names that are also everyday words or stores. Only used when the user has no wallets loaded.
const FALLBACK_SKIP = new Set(['ing', 'uno', 'robinsons', 'sterling', 'banko', 'citi', 'tonik', 'mp2'])

interface WalletMatcher {
  alias: string
  wallet: ParserWallet
  priority: number
}

function walletMatchers(wallets: ParserWallet[] | undefined): WalletMatcher[] {
  const all: WalletMatcher[] = []
  const add = (alias: string, wallet: ParserWallet, priority: number) => {
    const a = alias.trim().toLowerCase()
    if (a.length >= 2) all.push({ alias: a, wallet, priority })
  }

  if (!wallets) {
    // No wallet list (tests, receipts): fall back to well-known names so "via gcash" still reads.
    for (const inst of PH_INSTITUTIONS) {
      if (FALLBACK_SKIP.has(inst.short.toLowerCase())) continue
      const wallet = { name: inst.short }
      add(inst.short, wallet, 1)
      for (const extra of EXTRA_WALLET_ALIASES[inst.id] ?? []) add(extra, wallet, 1)
    }
    add('cash', { name: 'Cash', type: 'cash' }, 1)
  } else {
    for (const wallet of wallets) {
      const name = wallet.name.trim()
      if (!name) continue
      const words = name.toLowerCase().replace(/[^a-z0-9&+ ]+/g, ' ').split(/\s+/).filter(Boolean)
      add(name, wallet, 4)
      add(words.join(' '), wallet, 4)
      const core = words.filter((w) => !GENERIC_WALLET_WORDS.has(w))
      if (core.length && core.length < words.length) add(core.join(' '), wallet, 3)
      const inst = matchInstitution(name)
      if (inst) {
        add(inst.short, wallet, 2)
        for (const extra of [...(inst.aliases ?? []), ...(EXTRA_WALLET_ALIASES[inst.id] ?? [])]) add(extra, wallet, 2)
      }
      if (core.length > 1 && (core[0].length >= 3 || name.split(/\s+/)[0] === name.split(/\s+/)[0].toUpperCase())) add(core[0], wallet, 1)
      // A distinctive word of the name on its own: "emergency" for "GoTyme Emergency".
      for (const word of core.slice(1)) {
        const shared = wallets.filter((w) => w.name.toLowerCase().split(/[^a-z0-9]+/).includes(word)).length
        if (word.length >= 4 && shared === 1 && !WEAK_WALLET_WORDS.has(word)) add(word, wallet, 1)
      }
      if (wallet.type === 'credit_card' && inst) {
        add(`${inst.short} cc`, wallet, 3)
        add(`${inst.short} card`, wallet, 3)
      }
      if (wallet.type === 'cash' || /\bcash\b/i.test(name)) {
        add('cash', wallet, 2)
        add('cash on hand', wallet, 2)
      }
    }
  }

  // One wallet per alias: the stronger match wins, then the shortest name ("GoTyme" over "GoTyme Emergency").
  const byAlias = new Map<string, WalletMatcher>()
  for (const m of all) {
    const key = m.alias.replace(/[\s-]+/g, ' ')
    const prev = byAlias.get(key)
    if (!prev || m.priority > prev.priority || (m.priority === prev.priority && m.wallet.name.length < prev.wallet.name.length)) byAlias.set(key, m)
  }
  return [...byAlias.values()].sort((a, b) => b.alias.length - a.alias.length || b.priority - a.priority)
}

type WalletRole = 'from' | 'to' | 'via' | 'none'

interface WalletMention {
  wallet: ParserWallet
  start: number
  role: WalletRole
  cashIn: boolean
  /** "paid my BPI card": paying off a credit card is a transfer into it. */
  cardPayment: boolean
}

const ROLE_BEFORE: [WalletRole, RegExp][] = [
  ['from', /(?:^|\s)(from|frm|galing\s+(?:sa|kay)|galing|mula\s+sa|mula|out\s+of|kinuha\s+sa)\s*$/i],
  ['to', /(?:^|\s)(to|into|in\s+to|papunta\s+sa|papunta|pa-?punta|onto)\s*$/i],
  ['via', /(?:^|\s)(using|via|thru|through|gamit\s+ang|gamit|with|w\/|on|by|in|sa|pay\s+with|paid\s+with|charged\s+to|on\s+my|sa\s+aking|sa\s+my)\s*$/i],
]
const CASH_IN_ANY = /(^|[^a-z0-9])((?:nag-?\s?)?cash[\s-]?in|(?:nag-?\s?)?top[\s-]?up)(?=$|[^a-z0-9])/gi
const PAY_BEFORE = /(?:^|\s)(paid|pay|payment\s+(?:to|for|sa)|bayad\s+(?:sa|ng)|bayad|binayaran|nagbayad\s+(?:sa|ng))\s*(?:my\s+|the\s+|ang\s+)?$/i
const CASH_IN_BEFORE = /(?:^|\s)((?:nag-?)?cash[\s-]?in|top[\s-]?up|topup|nag-?top[\s-]?up|load(?:ed)?|reload(?:ed)?)\s+(?:sa\s+|to\s+|my\s+|into\s+)?$/i

function extractWallets(work: Work, matchers: WalletMatcher[]): WalletMention[] {
  const mentions: WalletMention[] = []
  for (const matcher of matchers) {
    for (const span of findAll(work.text, phraseRegex([matcher.alias]))) {
      // Tag the preposition in front, then blank both.
      const before = work.text.slice(0, span.start)
      let role: WalletRole = 'none'
      let blankFrom = span.start
      let cashIn = false
      let cardPayment = false
      const ci = before.match(CASH_IN_BEFORE)
      const pay = matcher.wallet.type === 'credit_card' ? before.match(PAY_BEFORE) : null
      if (pay) {
        role = 'to'
        cardPayment = true
        blankFrom = span.start - pay[0].length + (pay[0].match(/^\s/) ? 1 : 0)
      } else if (ci) {
        role = 'to'
        cashIn = true
        blankFrom = span.start - ci[0].length + (ci[0].match(/^\s/) ? 1 : 0)
      } else {
        for (const [r, re] of ROLE_BEFORE) {
          const pm = before.match(re)
          if (pm) {
            role = r
            blankFrom = span.start - pm[0].length + (pm[0].match(/^\s/) ? 1 : 0)
            break
          }
        }
      }
      // "cash in"/"cash out" are actions, not the Cash wallet.
      if (/^cash$/i.test(span.text) && /^\s*-?\s*(in|out)\b/i.test(work.text.slice(span.end))) continue
      mentions.push({ wallet: matcher.wallet, start: span.start, role, cashIn, cardPayment })
      // Swallow a generic word right after it: "emergency fund", "bdo account".
      const tail = work.text.slice(span.end).match(/^\s+(fund|funds|account|acct|wallet|card|savings)(?![a-z0-9])/i)
      work.blank(blankFrom, span.end + (tail ? tail[0].length : 0))
    }
  }
  return mentions.sort((a, b) => a.start - b.start)
}

/** Old behaviour kept for unknown wallet names: "Piggy spent 100 on…" (a name, then the verb). */
function extractLeadingWallet(work: Work): string | undefined {
  const m = work.text.match(/^\s*([A-Za-z][\w]*(?:\s+[A-Za-z][\w]*){0,2}?)\s+(?=(?:spent|paid|bought|purchased|received|earned|transferred?|sent|deposited|charged|ordered)\b)/i)
  if (!m) return undefined
  const token = m[1].trim()
  if (/^(i|ako|we|just|today|yesterday|kahapon|ngayon|kanina|have|had|already|also)$/i.test(token)) return undefined
  if (/\b(i|ako|we|just|have|had|already)\b/i.test(token)) return undefined
  work.blank(m.index ?? 0, (m.index ?? 0) + m[0].length)
  return token
}

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

const TRANSFER_PHRASES = [
  'transfer', 'transferred', 'transfered', 'xfer', 'trf', 'moved', 'move', 'lipat', 'nilipat', 'inilipat', 'naglipat',
  'nagdeposit', 'ipon', 'inipon', 'nag ipon', 'save to', 'saved to',
]
// Transfer words where the one wallet named is where the money went.
const INTO_WALLET = /\b(ipon|inipon|nag-?ipon|save[ds]?|deposit(?:ed)?|nagdeposit|cash[\s-]?in|top[\s-]?up)\b/
const WITHDRAW_PHRASES = ['withdraw', 'withdrew', 'withdrawal', 'withdrawn', 'nag withdraw', 'nagwithdraw', 'atm', 'cash out', 'cashout', 'nag cash out']

const INCOME_STRONG = [
  'received', 'receive', 'recieved', 'got paid', 'earned', 'earn', 'income', 'salary', 'sahod', 'sweldo', 'suweldo', 'payroll',
  'payday', 'pay day', 'paycheck', 'bonus', '13th month', 'refund', 'refunded', 'cashback', 'cash back', 'reimbursement',
  'reimbursed', 'rebate', 'dividend', 'dividends', 'interest earned', 'sold', 'benta', 'nabenta', 'binenta', 'natanggap',
  'tinanggap', 'nakuha ko', 'kinita', 'revenue', 'profit', 'gift from', 'regalo galing', 'regalo mula', 'napanalunan', 'won',
  'prize', 'payment from', 'paid by', 'bayad ni', 'bayad galing', 'binayaran ako', 'nagbayad si', 'padala ni', 'padala galing',
  'padala from', 'sent me', 'pinadalhan ako', 'borrowed', 'umutang ako', 'inutang ko', 'loan from', 'collected', 'nasingil',
  'commission', 'aguinaldo', 'pamasko', 'allowance from', 'baon from', 'tips', 'tip from',
]
const EXPENSE_STRONG = [
  'spent', 'spend', 'paid', 'pay', 'payed', 'paying', 'bought', 'buy', 'purchased', 'purchase', 'ordered', 'order', 'charged',
  'bayad', 'binayad', 'nagbayad', 'pinambayad', 'pambayad', 'bumili', 'binili', 'bili', 'gastos', 'ginastos', 'nagastos',
  'gumastos', 'nag order', 'nagorder', 'umorder', 'kumain', 'lent', 'pinautang', 'nagpautang', 'donated', 'donate', 'gave',
  'binigay', 'nagbigay', 'padala kay', 'padala sa', 'nagpadala', 'pinadala', 'treat', 'nilibre', 'libre ko', 'subscribed',
  'renewed', 'tuition',
]

const WITHDRAW_RE = phraseRegex(WITHDRAW_PHRASES)
const TRANSFER_RE = phraseRegex(TRANSFER_PHRASES)
const INCOME_RE = phraseRegex(INCOME_STRONG)
const EXPENSE_RE = phraseRegex(EXPENSE_STRONG)

interface TypeSignal {
  type: TransactionType
  confidence: number
  withdraw: boolean
  explicitTransfer: boolean
}

function detectType(lower: string): TypeSignal {
  const withdraw = findAll(lower, WITHDRAW_RE).length > 0
  if (withdraw) return { type: 'transfer', confidence: 0.85, withdraw, explicitTransfer: false }
  // The first money word decides ("paid salary to the helper" is an expense, "salary paid" income,
  // "spent 500 on transfer fee" an expense). On the same spot the longer phrase wins, so "got paid",
  // "paid by" and "bayad ni" read as income.
  const first = [
    ...findAll(lower, TRANSFER_RE).map((s) => ({ ...s, type: 'transfer' as const })),
    ...findAll(lower, INCOME_RE).map((s) => ({ ...s, type: 'income' as const })),
    ...findAll(lower, EXPENSE_RE).map((s) => ({ ...s, type: 'expense' as const })),
  ].sort((a, b) => a.start - b.start || b.end - a.end)[0]
  if (first?.type === 'transfer') return { type: 'expense', confidence: 0.5, withdraw, explicitTransfer: true }
  if (first) return { type: first.type, confidence: first.type === 'income' ? 0.9 : 0.85, withdraw, explicitTransfer: false }
  return { type: 'expense', confidence: 0.5, withdraw, explicitTransfer: false }
}

// ---------------------------------------------------------------------------
// Categories (names match the app's default categories)
// ---------------------------------------------------------------------------

const INCOME_CATEGORIES = new Set(['Salary', 'Freelance', 'Business', 'Investment', 'Remittance', 'Gift', 'Other Income'])
// Income categories whose words alone mean money came in ("sahod 25k"). "Padala" or "gift" can go either way.
const TYPE_DECIDING_CATEGORIES = new Set(['Salary', 'Freelance', 'Investment'])

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': [
    'food', 'meal', 'meals', 'lunch', 'dinner', 'breakfast', 'brunch', 'merienda', 'meryenda', 'snack', 'snacks', 'coffee', 'kape',
    'cafe', 'starbucks', 'sbux', 'jollibee', 'jolibee', 'jabee', 'mcdo', 'mcdonalds', "mcdonald's", 'mcdonald', 'kfc', 'chowking',
    'mang inasal', 'greenwich', "max's", 'shakeys', "shakey's", 'yellow cab', 'pizza', 'burger', 'fries', 'milk tea', 'milktea',
    'boba', 'samgyup', 'samgyupsal', 'kain', 'kumain', 'ulam', 'foodpanda', 'food panda', 'grabfood', 'grab food', 'restaurant',
    'resto', 'eat', 'ate', 'drinks', 'beer', 'inuman', 'dessert', 'bakery', 'bread', 'tinapay', 'pandesal', 'lugaw', 'tapsilog',
    'silog', 'carinderia', 'karinderya', 'fast food', 'fastfood', 'takeout', 'take out', 'buffet', 'dunkin', 'krispy kreme',
    'tim hortons', 'coffee project', 'uber eats', 'pickaroo', 'tea', 'juice', 'shawarma', 'siomai', 'kwek kwek', 'fishball', 'isaw', 'bbq', 'barbecue',
    'pancit', 'chicken', 'manok', 'mang inasal', 'bonchon', 'army navy', 'potato corner', 'ramen', 'sushi', 'pares', 'goto',
    '7-eleven', 'ministop', 'familymart', 'family mart', 'lawson', 'alfamart', 'tusok tusok', 'cake', 'ice cream', 'halo halo',
  ],
  Groceries: [
    'grocery', 'groceries', 'supermarket', 'palengke', 'wet market', 'market', 'puregold', 'savemore', 'sm supermarket',
    'sm hypermarket', 'robinsons supermarket', 'landers', 's&r', 'snr', 'waltermart', 'rice', 'bigas', 'sari sari', 'sari-sari',
    'tindahan', 'gulay', 'vegetables', 'veggies', 'fruits', 'prutas', 'meat', 'karne', 'isda', 'fish', 'eggs', 'itlog', 'gatas',
    'milk', 'canned goods', 'de lata', 'grabmart', 'pandamart', 'metro mart', 'shopwise', 'rustans', "rustan's", 'merkado',
  ],
  Transportation: [
    'grab', 'grab car', 'grabcar', 'angkas', 'joyride', 'move it', 'moveit', 'taxi', 'cab', 'jeep', 'jeepney', 'dyip',
    'tricycle', 'trike', 'pedicab', 'bus', 'p2p', 'mrt', 'lrt', 'pnr', 'train', 'beep', 'beep card', 'fare', 'pamasahe',
    'pasahe', 'commute', 'gas', 'gasolina', 'gasoline', 'diesel', 'fuel', 'petron', 'shell', 'caltex', 'seaoil', 'cleanfuel',
    'parking', 'toll', 'autosweep', 'easytrip', 'rfid', 'uber', 'lyft', 'indrive', 'indriver', 'ride', 'car wash', 'carwash',
    'oil change', 'uv express', 'van', 'habal', 'habal habal', 'lalamove', 'transport', 'transpo',
  ],
  'Bills & Utilities': [
    'electric', 'electricity', 'kuryente', 'meralco', 'veco', 'water bill', 'tubig', 'maynilad', 'manila water', 'internet',
    'wifi', 'wi fi', 'pldt', 'converge', 'globe at home', 'sky cable', 'skycable', 'cignal', 'phone bill', 'postpaid', 'load',
    'eload', 'e-load', 'prepaid load', 'globe', 'smart', 'tnt', 'dito', 'gomo', 'bill', 'bills', 'utility', 'utilities',
    'association dues', 'condo dues', 'hoa', 'lpg', 'gasul', 'cable',
  ],
  Rent: ['rent', 'renta', 'upa', 'rental', 'boarding house', 'bedspace', 'bed space', 'dorm', 'apartment', 'lease', 'condo rent'],
  Healthcare: [
    'medicine', 'medicines', 'gamot', 'meds', 'hospital', 'clinic', 'doctor', 'doktor', 'check up', 'checkup', 'consultation',
    'pharmacy', 'botika', 'mercury drug', 'mercury', 'generika', 'southstar', 'rose pharmacy', 'dental', 'dentist', 'laboratory',
    'lab test', 'x ray', 'xray', 'vitamins', 'vitamin', 'therapy', 'optical', 'eyeglasses', 'salamin', 'medical', 'health', 'gym',
    'fitness', 'anytime fitness', 'vaccine', 'bakuna',
  ],
  Entertainment: [
    'movie', 'movies', 'cinema', 'sine', 'concert', 'games', 'game', 'gaming', 'steam', 'playstation', 'ps5', 'nintendo',
    'mobile legends', 'ml diamonds', 'diamonds', 'robux', 'valorant', 'genshin', 'karaoke', 'videoke', 'bowling', 'arcade',
    'timezone', 'billiards', 'party', 'gimik', 'ticket', 'tickets', 'museum', 'theme park', 'enchanted kingdom',
  ],
  Subscription: [
    'netflix', 'spotify', 'youtube premium', 'yt premium', 'disney+', 'disney plus', 'hbo', 'hbo go', 'prime video',
    'apple music', 'icloud', 'google one', 'chatgpt', 'claude', 'canva', 'adobe', 'subscription', 'subscribed', 'membership',
    'viu', 'iwanttfc', 'vivamax', 'apple tv', 'patreon', 'crunchyroll',
  ],
  Shopping: [
    'shopee', 'lazada', 'zalora', 'amazon', 'temu', 'shein', 'tiktok shop', 'mall', 'sm', 'gadget', 'gadgets', 'headphones',
    'earphones', 'appliance', 'furniture', 'ikea', 'ace hardware', 'hardware', 'handyman', 'wilcon', 'shopping', 'phone case', 'charger', 'laptop', 'gift for', 'gifts', 'christmas gifts', 'regalo kay', 'regalo para', 'national bookstore',
    'miniso', 'daiso', 'japan home', 'abenson', 'anson',
  ],
  Clothing: [
    'clothes', 'damit', 'shirt', 'tshirt', 't shirt', 'pants', 'jeans', 'shorts', 'dress', 'shoes', 'sapatos', 'sneakers',
    'tsinelas', 'slippers', 'uniqlo', 'h&m', 'zara', 'bench', 'penshoppe', 'nike', 'adidas', 'jacket', 'socks', 'medyas',
    'underwear', 'bag', 'polo', 'blouse', 'skirt', 'uniform',
  ],
  'Personal Care': [
    'haircut', 'gupit', 'barber', 'barbershop', 'salon', 'rebond', 'nails', 'manicure', 'pedicure', 'mani pedi', 'spa',
    'massage', 'masahe', 'hilot', 'watsons', 'skincare', 'toiletries', 'shampoo', 'soap', 'sabon', 'toothpaste', 'deodorant',
    'perfume', 'makeup', 'make up', 'cosmetics', 'laundry', 'laba', 'labada', 'diapers', 'diaper', 'lotion',
  ],
  Education: [
    'tuition', 'matrikula', 'school', 'books', 'book', 'libro', 'school supplies', 'course', 'udemy', 'coursera', 'seminar',
    'training', 'review center', 'exam', 'enrollment', 'enrolment', 'class', 'lesson', 'tutor', 'tutorial', 'project sa school',
  ],
  Insurance: [
    'insurance', 'premium', 'philhealth', 'sss', 'pag ibig contribution', 'insular', 'sun life', 'sunlife', 'axa', 'pru life',
    'prulife', 'manulife', 'hmo', 'maxicare', 'intellicare', 'medicard', 'fwd',
  ],
  Travel: [
    'travel', 'flight', 'airfare', 'plane ticket', 'cebu pacific', 'cebupac', 'pal', 'philippine airlines', 'airasia', 'hotel',
    'airbnb', 'agoda', 'booking', 'resort', 'vacation', 'bakasyon', 'trip', 'tour', 'ferry', 'boat', 'baggage', 'travel tax',
    'terminal fee', 'beach', 'staycation', 'outing', 'swimming', 'pasalubong',
  ],
  Donation: ['donation', 'donate', 'donated', 'charity', 'tithe', 'tithes', 'offering', 'abuloy', 'alay', 'simbahan', 'church'],
  Salary: ['salary', 'sahod', 'sweldo', 'suweldo', 'payroll', 'payday', 'pay day', '13th month', 'paycheck', 'wage', 'wages', 'incentive', 'bonus'],
  Freelance: ['freelance', 'client', 'commission', 'invoice', 'project', 'upwork', 'fiverr', 'onlinejobs', 'raket', 'sideline', 'gig', 'downpayment', 'down payment'],
  Business: ['business', 'negosyo', 'sales', 'benta', 'nabenta', 'binenta', 'sold', 'profit', 'revenue', 'customer', 'order payment'],
  Investment: ['dividend', 'dividends', 'interest', 'stock', 'stocks', 'crypto', 'bitcoin', 'btc', 'eth', 'ethereum', 'mutual fund', 'uitf', 'mp2', 'bond', 'bonds', 'capital gains', 'staking'],
  Remittance: ['padala', 'remittance', 'western union', 'palawan', 'palawan express', 'cebuana', 'mlhuillier', 'm lhuillier', 'lbc', 'ofw', 'from abroad'],
  Gift: ['gift', 'regalo', 'aguinaldo', 'pamasko', 'ampao', 'angpao', 'birthday money', 'napanalunan', 'won', 'prize', 'raffle'],
  'Other Income': ['refund', 'refunded', 'cashback', 'cash back', 'reimbursement', 'reimbursed', 'rebate', 'allowance', 'baon', 'tips', 'tip', 'borrowed', 'utang'],
}

// Longer phrases are checked first and blanked, so "grab food" is food and not a ride.
const CATEGORY_PHRASES = Object.entries(CATEGORY_KEYWORDS)
  .flatMap(([name, words]) => words.map((word) => ({ name, word, re: phraseRegex([word], /^[a-z ]+$/.test(word) && !/s$/.test(word)) })))
  .sort((a, b) => b.word.length - a.word.length)

function inferCategory(lower: string, type: TransactionType | undefined): { name?: string; confidence: number } {
  let best: { name?: string; score: number } = { score: 0 }
  const scratch = new Work(lower)
  const scores = new Map<string, number>()
  for (const { name, word, re } of CATEGORY_PHRASES) {
    for (const span of findAll(scratch.text, re)) {
      scores.set(name, (scores.get(name) ?? 0) + 1 + word.length / 20)
      scratch.blank(span.start, span.end)
    }
  }
  for (const [name, score] of scores) {
    const isIncome = INCOME_CATEGORIES.has(name)
    if (type === 'income' && !isIncome) continue
    if (type === 'expense' && isIncome) continue
    if (score > best.score) best = { name, score }
  }
  return { name: best.name, confidence: best.name ? Math.min(0.5 + best.score * 0.2, 0.95) : 0 }
}

const DEFAULT_CATEGORY_NAMES = new Set(Object.keys(CATEGORY_KEYWORDS).concat('Other Expense').map((n) => n.toLowerCase()))

/** A category of the user's own that is named in the message ("Coffee", "Baby", "Pets"). */
function explicitCategory(text: string, categories: ParserCategory[] | undefined, type: TransactionType, typeKnown: boolean): ParserCategory | undefined {
  if (!categories?.length) return undefined
  const sorted = [...categories]
    .filter((c) => c.name?.trim())
    // With no verb, a default income category ("Gift") shouldn't flip "gift for mom" to income: keywords handle those.
    .filter((c) => (typeKnown ? !c.type || c.type === type : !c.type || c.type === type || !DEFAULT_CATEGORY_NAMES.has(c.name.trim().toLowerCase())))
    .sort((a, b) => b.name.length - a.name.length)
  for (const category of sorted) {
    const name = category.name.trim()
    const forms = [name]
    if (/s$/i.test(name)) forms.push(name.slice(0, -1))
    else forms.push(`${name}s`)
    if (findFirst(text, phraseRegex(forms))) return category
  }
  return undefined
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

const historyKey = (s?: string | null) =>
  (s ?? '').split('·')[0].toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim()

function matchHistory(description: string | undefined, history: ParserHistoryItem[] | undefined, type?: TransactionType) {
  const key = historyKey(description)
  if (!key || key.length < 3 || !history?.length) return undefined
  const counts = new Map<string, { item: ParserHistoryItem; count: number; exact: boolean }>()
  history.forEach((item) => {
    if (type && item.type && item.type !== type) return
    const k = historyKey(item.description)
    if (!k) return
    const exact = k === key
    if (!exact && !(k.startsWith(`${key} `) || key.startsWith(`${k} `))) return
    const id = `${k}|${item.type}`
    const entry = counts.get(id)
    if (entry) entry.count++
    else counts.set(id, { item, count: 1, exact })
  })
  return [...counts.values()].sort((a, b) => Number(b.exact) - Number(a.exact) || b.count - a.count)[0]?.item
}

// ---------------------------------------------------------------------------
// Description cleanup
// ---------------------------------------------------------------------------

const STRIP_ANYWHERE = phraseRegex([
  'spent', 'spend', 'paid', 'payed', 'bought', 'purchased', 'received', 'recieved', 'earned', 'transferred', 'transfered',
  'transfer', 'xfer', 'trf', 'binayad', 'nagbayad', 'pinambayad', 'binili', 'bumili', 'gastos', 'ginastos', 'nagastos',
  'gumastos', 'natanggap', 'tinanggap', 'withdrew', 'withdraw', 'withdrawal', 'nagwithdraw', 'nag withdraw',
])
const EDGE_WORDS = new Set([
  'i', 'ako', 'we', 'just', 'got', 'get', 'have', 'had', 'already', 'na', 'nag', 'pay', 'paying', 'buy', 'order', 'ordered',
  'sent', 'send', 'moved', 'move', 'on', 'for', 'from', 'to', 'at', 'in', 'into', 'of', 'the', 'a', 'an', 'my', 'some', 'about',
  'with', 'and', 'sa', 'ng', 'para', 'pang', 'pambayad', 'ko', 'po', 'lang', 'din', 'rin', 'yung', 'ung', 'ang', 'mga', 'kay',
  'ni', 'si', 'via', 'using', 'thru', 'through', 'gamit', 'by', 'worth', 'amount', 'total', 'is', 'was', 'it', 'me', 'nang',
  'pa', 'kaya', 'yes', 'ok', 'okay', 'also', 'then', 'plus', 'pesos', 'peso', 'php', 'deposited', 'deposit', 'cash', 'bayad',
])
const PUNCT_EDGE = /^[\s,.;:!?+&/@\-–—()|*"']+|[\s,.;:!?+&/@\-–—(|*"']+$/g

function cleanDescription(work: Work): string | undefined {
  let s = work.text.replace(STRIP_ANYWHERE, '$1 ')
  s = s.replace(/\(\s*\)/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/([,;:])(?:\s*[,;:])+/g, '$1').replace(/\s+/g, ' ').trim()
  for (let i = 0; i < 12; i++) {
    const before = s
    s = s.replace(PUNCT_EDGE, '').trim()
    const words = s.split(' ')
    while (words.length && EDGE_WORDS.has(words[0].toLowerCase().replace(/[^a-z']/g, ''))) words.shift()
    while (words.length && EDGE_WORDS.has(words[words.length - 1].toLowerCase().replace(/[^a-z']/g, ''))) words.pop()
    s = words.join(' ')
    if (s === before) break
  }
  // A dangling "with" or "and" in the middle after the wallet was removed: "lunch with" → "lunch".
  s = s.replace(/\s+(?:and|with|at|sa|ng|for|on)\s*(?=[,.;]|$)/gi, '').trim()
  return s ? capitalize(s) : undefined
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

const toWallets = (wallets?: (string | ParserWallet)[]) =>
  wallets?.map((w) => (typeof w === 'string' ? { name: w } : w)).filter((w) => w?.name)

export function parseTransactionText(text: string, context: ParseContext = {}): ParsedTransaction {
  const now = context.now ?? new Date()
  const wallets = toWallets(context.wallets)
  const work = new Work(normalize(text))

  const { date, confidence: dateConf } = extractDate(work, now)
  const serviceFee = extractServiceFee(work)

  // Read the type before the wallets are blanked so "cash in"/"withdraw" stay visible, but after
  // the dates so "kahapon" or "noong lunes" don't count.
  const typeLower = work.lower
  const mentions = extractWallets(work, walletMatchers(wallets))
  const leadingWallet = mentions.length === 0 ? extractLeadingWallet(work) : undefined

  const { candidate, parts, confidence: amountConfRaw } = pickAmount(work.text)
  for (const c of parts ?? (candidate ? [candidate] : [])) {
    // Take a cue word in front with it: "for 180", "worth 1,845".
    const cue = work.text.slice(0, c.start).match(/(?:^|\s)(for|worth|@|=|total|amount|amt|halagang|halaga|nagkakahalaga|presyo)\s*:?\s*$/i)
    work.blank(cue ? c.start - cue[0].length + (/^\s/.test(cue[0]) ? 1 : 0) : c.start, c.end)
  }

  const signal = detectType(work.lower)
  let { type, confidence: typeConf } = signal
  let cashInMention = mentions.find((m) => m.cashIn || m.cardPayment)
  // "nag cash in ako 2000 sa gcash": the cash-in words and the wallet aren't side by side.
  const cashInWords = findFirst(work.text, CASH_IN_ANY)
  if (!cashInMention && cashInWords && mentions.length) {
    cashInMention = mentions.find((m) => m.role === 'to') ?? mentions.find((m) => m.start > cashInWords.start) ?? mentions[0]
    cashInMention.cashIn = true
  }
  if (cashInWords) work.blank(cashInWords.start, cashInWords.end)

  // ---- Wallet roles ------------------------------------------------------
  let from: ParserWallet | undefined
  let to: ParserWallet | undefined
  const distinct = mentions.filter((m, i) => mentions.findIndex((o) => o.wallet.name === m.wallet.name) === i)
  const cashWallet = (wallets ?? []).find((w) => w.type === 'cash') ?? (wallets ?? []).find((w) => /\bcash\b/i.test(w.name))

  if (signal.withdraw) {
    type = 'transfer'
    from = distinct.find((m) => m.role !== 'to' && m.wallet !== cashWallet)?.wallet ?? distinct.find((m) => m.wallet !== cashWallet)?.wallet
    to = cashWallet ?? (wallets ? undefined : { name: 'Cash', type: 'cash' })
    typeConf = 0.9
  } else if (cashInMention) {
    type = 'transfer'
    to = cashInMention.wallet
    from = distinct.find((m) => m !== cashInMention && m.wallet !== to)?.wallet
    typeConf = 0.9
  } else if (distinct.length >= 2) {
    type = 'transfer'
    typeConf = 0.9
    const src = distinct.find((m) => m.role === 'from')
    const dst = distinct.find((m) => m.role === 'to' && m !== src)
    if (src) {
      from = src.wallet
      to = (dst ?? distinct.find((m) => m !== src))?.wallet
    } else if (dst) {
      to = dst.wallet
      from = distinct.find((m) => m !== dst)?.wallet
    } else {
      from = distinct[0].wallet
      to = distinct[1].wallet
    }
  } else if (distinct.length === 1) {
    const only = distinct[0]
    if (signal.explicitTransfer || (only.role === 'to' && signal.type !== 'income' && /\b(sent|send|moved|move|deposit(?:ed)?|save[ds]?|ipon|top|load)\b/.test(typeLower))) {
      type = 'transfer'
      typeConf = 0.85
      if (only.role === 'to' || (only.role === 'none' && INTO_WALLET.test(typeLower))) to = only.wallet
      else from = only.wallet
    } else {
      from = only.wallet
    }
  } else if (signal.explicitTransfer) {
    type = 'transfer'
  }

  // Without known wallets, keep reading "from X to Y" for names we don't know.
  if (type === 'transfer' && !from && !to) {
    const m = work.text.match(/\bfrom\s+([a-z][\w&]*(?:\s+[a-z][\w&]*){0,2}?)\s+to\s+([a-z][\w&]*(?:\s+[a-z][\w&]*){0,2})\s*$/i) ??
      work.text.match(/\bfrom\s+([a-z][\w&]*)\s+to\s+([a-z][\w&]*)/i)
    if (m) {
      from = { name: m[1].trim() }
      to = { name: m[2].trim() }
      work.blank(m.index ?? 0, (m.index ?? 0) + m[0].length)
    }
  }

  // ---- Category ----------------------------------------------------------
  const remainingLower = work.lower
  const explicit = type !== 'transfer' ? explicitCategory(work.text, context.categories, type, typeConf >= 0.8) : undefined
  let categoryName: string | undefined
  let categoryConf = 0
  if (explicit) {
    categoryName = explicit.name
    categoryConf = 0.95
    if (typeConf < 0.8 && (explicit.type === 'income' || explicit.type === 'expense')) {
      type = explicit.type
      typeConf = 0.8
    }
  } else if (type !== 'transfer') {
    if (typeConf < 0.8) {
      // No verb said which way the money went: let a strong income word decide ("sahod 25000").
      const any = inferCategory(remainingLower, undefined)
      const asExpense = inferCategory(remainingLower, 'expense')
      if (any.name && TYPE_DECIDING_CATEGORIES.has(any.name) && !asExpense.name) {
        type = 'income'
        typeConf = 0.75
      }
    }
    const inferred = inferCategory(remainingLower, type)
    categoryName = inferred.name
    categoryConf = inferred.confidence
  }

  // ---- Description -------------------------------------------------------
  let description = cleanDescription(work)

  // ---- History: reuse what was picked last time for the same note --------
  let matchedHistory = false
  let amountFromHistory = false
  let amount = candidate?.value
  let amountConf = candidate ? amountConfRaw : 0
  const past = type !== 'transfer' ? matchHistory(description, context.history, typeConf >= 0.8 ? type : undefined) : undefined
  if (past) {
    matchedHistory = true
    if (typeConf < 0.8 && (past.type === 'income' || past.type === 'expense')) {
      type = past.type
      typeConf = 0.8
    }
    if (!explicit && past.categoryName) {
      categoryName = past.categoryName
      categoryConf = 0.9
    }
    if (!from && past.walletName) from = (wallets ?? []).find((w) => w.name === past.walletName) ?? (wallets ? undefined : { name: past.walletName })
    if (!amount) {
      const pastAmount = Number(past.amount)
      if (pastAmount > 0) {
        amount = pastAmount
        amountConf = 0.6
        amountFromHistory = true
      }
    }
  }

  if (type === 'transfer') {
    const fromName = from?.name
    const toName = to?.name
    const leftover = description && !/^(cash\s*in|top\s*up|load)$/i.test(description) ? description : undefined
    if (leftover) description = leftover
    else if (signal.withdraw) description = fromName ? `ATM withdrawal from ${fromName}` : 'ATM withdrawal'
    else if (cashInMention?.cardPayment) description = `${toName} payment`
    else if (cashInMention) description = `Cash in to ${toName}`
    else if (fromName && toName) description = `${wallets ? fromName : titleCase(fromName)} to ${wallets ? toName : titleCase(toName)}`
    categoryName = undefined
    categoryConf = 0
  }

  return {
    amount,
    description: description || undefined,
    type,
    date: date ?? isoDate(now),
    inferredCategoryName: categoryName,
    fromWalletName: from?.name ?? leadingWallet,
    toWalletName: to?.name,
    serviceFee,
    matchedHistory: matchedHistory || undefined,
    amountFromHistory: amountFromHistory || undefined,
    confidence: {
      amount: amountConf,
      type: typeConf,
      date: dateConf > 0 ? dateConf : 0.8,
      category: categoryConf,
    },
  }
}

// ---------------------------------------------------------------------------
// Receipts (OCR text)
// ---------------------------------------------------------------------------

const TOTAL_LINE = /\b(grand\s*total|amount\s*due|total\s*due|total\s*amount|net\s*amount|amount\s*paid|total\s*sales|total)\b/i
const NOT_TOTAL_LINE = /\b(sub\s*-?\s*total|total\s*(items?|qty|quantity|discount|savings?)|vat(able)?|change|cash\s*tendered|tendered|discount)\b/i
const RECEIPT_BOILERPLATE = /\b(official\s+receipt|sales\s+invoice|invoice|receipt|vat\s*reg|tin\b|min\b|s\/?n\b|address|tel\b|telephone|cashier|welcome|thank\s*you|branch|permit|accreditation)\b/i
const MONEY_IN_LINE = /(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})|\d+\.\d{2})/g

/** Reads OCR text from a receipt photo: the total, the store name as the note, the date and a category. */
export function parseReceiptText(text: string, context: ParseContext = {}): ParsedTransaction {
  const now = context.now ?? new Date()
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const moneyOf = (line: string) =>
    [...line.matchAll(MONEY_IN_LINE)].map((m) => parseFloat(m[1].replace(/[,\s]/g, ''))).filter((n) => n > 0 && n < 10_000_000)

  let amount: number | undefined
  let amountConf = 0
  const totalLines = lines.filter((l) => TOTAL_LINE.test(l) && !NOT_TOTAL_LINE.test(l))
  // Prefer the strongest label (grand total/amount due), then the last total line on the receipt.
  const ranked = [...totalLines].sort((a, b) => Number(/grand|due|amount\s*paid/i.test(b)) - Number(/grand|due|amount\s*paid/i.test(a)))
  for (const line of [...ranked.filter((l) => /grand|due|amount\s*paid/i.test(l)), ...totalLines.reverse()]) {
    const values = moneyOf(line)
    if (values.length) {
      amount = values[values.length - 1]
      amountConf = 0.9
      break
    }
  }
  if (amount === undefined) {
    const all = lines.filter((l) => !NOT_TOTAL_LINE.test(l)).flatMap(moneyOf)
    if (all.length) {
      amount = Math.max(...all)
      amountConf = 0.6
    }
  }
  if (amount === undefined) {
    const parsed = parseTransactionText(lines.join(' '), context)
    return { ...parsed, type: parsed.type ?? 'expense' }
  }

  const merchant = lines.slice(0, 6).find((l) => /[a-z]{3,}/i.test(l) && !RECEIPT_BOILERPLATE.test(l) && !/\d{4,}/.test(l))
  const description = merchant ? titleCase(merchant.toLowerCase()).replace(/\s+/g, ' ').slice(0, 60) : undefined

  const work = new Work(normalize(lines.join(' ')))
  const { date, confidence: dateConf } = extractDate(work, now)
  const category = inferCategory(`${merchant ?? ''} ${work.lower}`.toLowerCase(), 'expense')
  const past = matchHistory(description, context.history, 'expense')

  return {
    amount,
    description,
    type: 'expense',
    date: date ?? isoDate(now),
    inferredCategoryName: past?.categoryName ?? category.name,
    fromWalletName: past?.walletName ?? undefined,
    matchedHistory: past ? true : undefined,
    confidence: { amount: amountConf, type: 0.8, date: dateConf > 0 ? dateConf : 0.6, category: past ? 0.9 : category.confidence },
  }
}

// ---------------------------------------------------------------------------
// Matching parsed names to the user's records
// ---------------------------------------------------------------------------

// Default category names and what users often call their own versions of them.
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  'Food & Dining': ['food', 'dining', 'meals', 'eating out', 'restaurants', 'pagkain'],
  Groceries: ['grocery', 'market', 'supermarket'],
  Transportation: ['transport', 'transpo', 'commute', 'travel & transport', 'gas', 'fuel'],
  'Bills & Utilities': ['bills', 'utilities', 'utility'],
  Rent: ['housing', 'house', 'rent & housing'],
  Healthcare: ['health', 'medical', 'medicine'],
  Entertainment: ['fun', 'leisure', 'games'],
  Subscription: ['subscriptions', 'streaming'],
  Shopping: ['shopping', 'online shopping'],
  Clothing: ['clothes', 'apparel'],
  'Personal Care': ['self care', 'grooming', 'beauty'],
  Education: ['school', 'learning'],
  Salary: ['salary & income', 'income', 'pay'],
  'Other Income': ['other income', 'misc income'],
}

export interface MatchableCategory {
  id?: string
  _id?: string
  name?: string
  type?: string
}

/** Finds the user's category for a parsed name, only among categories of the right type. */
export function matchCategory<T extends MatchableCategory>(name: string | undefined, type: TransactionType | undefined, categories: T[]): T | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase().trim()
  const usable = categories.filter((c) => c.name && (!c.type || !type || type === 'transfer' || c.type === type))
  const nameOf = (c: T) => (c.name ?? '').toLowerCase().trim()
  const exact = usable.find((c) => nameOf(c) === lower)
  if (exact) return exact
  const synonyms = [lower, ...(CATEGORY_SYNONYMS[name] ?? [])]
  const bySynonym = usable.find((c) => synonyms.includes(nameOf(c)))
  if (bySynonym) return bySynonym
  const contains = usable.find((c) => {
    const n = nameOf(c)
    return n.length >= 3 && (n.includes(lower) || lower.includes(n))
  })
  if (contains) return contains
  // Word overlap, ignoring "&" and short words: "Food & Dining" → "Food".
  const words = lower.split(/[^a-z]+/).filter((w) => w.length >= 4)
  return usable.find((c) => nameOf(c).split(/[^a-z]+/).some((w) => w.length >= 4 && words.includes(w)))
}

export interface MatchableWallet {
  id?: string
  _id?: string
  name?: string
  type?: string
  status?: string
}

/** Finds the user's wallet for a parsed wallet name. */
export function matchWallet<T extends MatchableWallet>(walletName: string | undefined, wallets: T[]): T | undefined {
  if (!walletName) return undefined
  const query = walletName.toLowerCase().trim()
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const active = wallets.filter((w) => w.status !== 'archived' && w.name)
  return (
    active.find((w) => (w.name ?? '').toLowerCase().trim() === query) ??
    active.find((w) => squash(w.name ?? '') === squash(query)) ??
    active.filter((w) => (w.name ?? '').toLowerCase().startsWith(query)).sort((a, b) => (a.name ?? '').length - (b.name ?? '').length)[0] ??
    active.find((w) => {
      const name = (w.name ?? '').toLowerCase()
      return name.length >= 3 && query.startsWith(name)
    })
  )
}
