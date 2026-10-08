'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Archive, MoreHorizontal, Pencil } from 'lucide-react'
import { investmentType } from '@/components/page/investments/investment-meta'
import type { InvestmentAction } from '@/components/page/investments/investment-action-sheet'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { coinLabel } from '@/utils/crypto-prices'
import type { LiveHolding } from '@/queries/crypto/prices'
import type { Investment } from '@/types/investment'

interface InvestmentCardProps {
  investment: Investment
  /** Live price info, when this is a crypto holding with a quantity. */
  live?: LiveHolding
  hideAmounts: boolean
  onAction: (action: InvestmentAction, investment: Investment) => void
  onEdit: (investment: Investment) => void
  onArchive: (investment: Investment) => void
}

export function InvestmentCard({ investment, live, hideAmounts, onAction, onEdit, onArchive }: InvestmentCardProps) {
  const { currency } = useSettingsStore()
  const [menu, setMenu] = useState(false)
  const meta = investmentType(investment.type)
  const money = (value: number) => formatMoney(value, investment.currency || currency, hideAmounts)

  const principal = Number(investment.principalAmount) || 0
  const value = live ? live.value : Number(investment.currentValue) || 0
  const dividends = Number(investment.dividendsReceived) || 0
  const gain = value - principal + dividends
  const gainPct = principal > 0 ? (gain / principal) * 100 : 0
  const up = gain >= 0
  const sold = investment.status === 'sold'

  return (
    <article className={`rounded-3xl border border-border bg-card p-4 shadow-ios ${sold ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: meta.color }}>
          <meta.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{investment.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {meta.label}
            {investment.platform ? ` · ${investment.platform}` : ''}
          </p>
        </div>
        {sold && <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">Sold</span>}
        <div className="relative -mr-1">
          <button type="button" onClick={() => setMenu((v) => !v)} aria-label={`${investment.name} actions`} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-ios-lg">
                <button type="button" onClick={() => { setMenu(false); onEdit(investment) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-secondary">
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button type="button" onClick={() => { setMenu(false); onArchive(investment) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-destructive hover:bg-secondary">
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {sold ? 'Sold for' : live ? 'Worth now · live' : 'Worth now'}
          </p>
          <p className="font-heading text-2xl font-bold tabular-nums text-foreground">{money(value)}</p>
        </div>
        <p className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${up ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive'}`}>
          {up ? '+' : '-'}
          {Math.abs(gainPct).toFixed(1)}%
        </p>
      </div>

      {live && investment.coinId && (
        <p className="mt-1 text-xs text-muted-foreground">
          {Number(investment.quantity)} {coinLabel(investment.coinId, investment.coinSymbol)} at {money(live.price)}
          {live.change24h != null && (
            <span className={live.change24h >= 0 ? 'text-success' : 'text-destructive'}>
              {' '}
              · {live.change24h >= 0 ? '+' : ''}
              {live.change24h.toFixed(2)}% today
            </span>
          )}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-2xl bg-secondary/60 px-3 py-2">
          <p className="text-muted-foreground">Put in</p>
          <p className="mt-0.5 truncate font-semibold tabular-nums text-foreground">{money(principal)}</p>
        </div>
        <div className="rounded-2xl bg-secondary/60 px-3 py-2">
          <p className="text-muted-foreground">Returns</p>
          <p className="mt-0.5 truncate font-semibold tabular-nums text-foreground">{money(dividends)}</p>
        </div>
        <div className="rounded-2xl bg-secondary/60 px-3 py-2">
          <p className="text-muted-foreground">{up ? 'Gain' : 'Loss'}</p>
          <p className={`mt-0.5 truncate font-semibold tabular-nums ${up ? 'text-success' : 'text-destructive'}`}>{money(Math.abs(gain))}</p>
        </div>
      </div>

      {(investment.maturityDate || investment.expectedReturnRate) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {investment.expectedReturnRate ? `Expected ${investment.expectedReturnRate}% a year` : ''}
          {investment.expectedReturnRate && investment.maturityDate ? ' · ' : ''}
          {investment.maturityDate ? `Matures ${format(new Date(investment.maturityDate), 'MMM d, yyyy')}` : ''}
        </p>
      )}

      {!sold && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([
            ['value', 'Update value'],
            ['return', 'Add return'],
            ['sell', 'Sell'],
          ] as const).map(([action, label]) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action, investment)}
              className="rounded-full bg-primary/10 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}
