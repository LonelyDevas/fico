import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WidgetId = 'yourMoney' | 'whereItWent' | 'comingUp' | 'owedToYou' | 'crypto' | 'latestActivity' | 'quickActions'

export const WIDGETS: { id: WidgetId; label: string; hint: string }[] = [
  { id: 'yourMoney', label: 'Your money', hint: 'Wallet balances' },
  { id: 'whereItWent', label: 'Where it went', hint: 'Spending by category' },
  { id: 'comingUp', label: 'Coming up', hint: 'Bills due soon' },
  { id: 'owedToYou', label: 'Owed to you', hint: 'People who owe you money' },
  { id: 'crypto', label: 'Crypto', hint: 'Live value of your coins. Shows once you add a coin' },
  { id: 'latestActivity', label: 'Latest activity', hint: 'Your newest transactions' },
  { id: 'quickActions', label: 'Quick actions', hint: 'Shortcut grid, shown on large screens only' },
]

const DEFAULT_ORDER: WidgetId[] = WIDGETS.map((w) => w.id)
const KNOWN = new Set<string>(DEFAULT_ORDER)

/** Drops widgets that no longer exist and appends any new ones, so saved layouts survive app updates. */
export const resolveOrder = (order: string[]): WidgetId[] => {
  const seen = new Set<string>()
  const kept = order.filter((id): id is WidgetId => KNOWN.has(id) && !seen.has(id) && !!seen.add(id))
  return [...kept, ...DEFAULT_ORDER.filter((id) => !seen.has(id))]
}

interface HomeWidgetsState {
  order: WidgetId[]
  hidden: WidgetId[]
  move: (id: WidgetId, direction: -1 | 1) => void
  toggle: (id: WidgetId) => void
  reset: () => void
}

export const useHomeWidgets = create<HomeWidgetsState>()(
  persist(
    (set) => ({
      order: DEFAULT_ORDER,
      hidden: [],
      move: (id, direction) =>
        set((state) => {
          const order = resolveOrder(state.order)
          const from = order.indexOf(id)
          const to = from + direction
          if (from < 0 || to < 0 || to >= order.length) return state
          const next = [...order]
          ;[next[from], next[to]] = [next[to], next[from]]
          return { order: next }
        }),
      toggle: (id) =>
        set((state) => ({
          hidden: state.hidden.includes(id) ? state.hidden.filter((h) => h !== id) : [...state.hidden, id],
        })),
      reset: () => set({ order: DEFAULT_ORDER, hidden: [] }),
    }),
    { name: 'home-widgets' }
  )
)
