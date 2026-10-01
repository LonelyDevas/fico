'use client'

import { EmptyState } from '@/components/peacock-mascot'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { ChevronDown, Plus } from 'lucide-react'
import { IonContent, IonPage } from '@ionic/react'
import { MoneyOverviewCard } from '@/components/page/wallet/money-overview-card'
import { WalletCard } from '@/components/page/wallet/wallet-card'
import { CreateWalletModal } from '@/components/page/wallet/create-wallet-modal'
import { CreateTransactionModal } from '@/components/page/transaction/create-transaction-modal'
import { useArchiveWallet, useListWallets, useSyncCardBills } from '@/queries/user/wallet/wallets'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { InterestPayout, WalletStatus, WalletType } from '@/types/wallet'

interface WalletViewModel {
  id: string
  name: string
  type: WalletType
  balance: number
  currency: string
  color?: string
  icon?: string
  accountNumber?: string
  institution?: string
  creditLimit?: number
  statementDay?: number
  dueDay?: number
  interestRate?: number
  interestPayout?: InterestPayout
  interestTaxRate?: number
  maturityDate?: string
  totalInterestEarned?: number
  status: WalletStatus
}

interface WalletApiItem {
  _id?: string
  id?: string
  name?: string
  type?: WalletType
  balance?: number | string
  currentBalance?: number | string
  currency?: string
  color?: string
  icon?: string
  accountNumber?: string
  institution?: string
  creditLimit?: number
  statementDay?: number
  dueDay?: number
  interestRate?: number
  interestPayout?: InterestPayout
  interestTaxRate?: number
  maturityDate?: string
  totalInterestEarned?: number
  status?: WalletStatus
}

const walletTypeValues: WalletType[] = ['bank', 'savings', 'cash', 'ewallet', 'credit_card', 'other']

const normalizeWallet = (wallet: WalletApiItem, index: number, fallbackCurrency: string): WalletViewModel => {
  const resolvedId = wallet._id ?? wallet.id ?? `wallet-${index}`

  const rawBalance = wallet.balance ?? wallet.currentBalance ?? 0
  const numericBalance = Number(rawBalance)

  const resolvedType = walletTypeValues.includes(wallet.type as WalletType)
    ? (wallet.type as WalletType)
    : 'other'

  const resolvedStatus: WalletStatus = wallet.status === 'archived' ? 'archived' : 'active'

  return {
    id: resolvedId,
    name: wallet.name?.trim() || 'Untitled Wallet',
    type: resolvedType,
    balance: Number.isFinite(numericBalance) ? numericBalance : 0,
    currency: wallet.currency || fallbackCurrency,
    color: wallet.color,
    icon: wallet.icon,
    accountNumber: wallet.accountNumber,
    institution: wallet.institution,
    creditLimit: wallet.creditLimit != null ? Number(wallet.creditLimit) : undefined,
    statementDay: wallet.statementDay != null ? Number(wallet.statementDay) : undefined,
    dueDay: wallet.dueDay != null ? Number(wallet.dueDay) : undefined,
    interestRate: wallet.interestRate != null ? Number(wallet.interestRate) : undefined,
    interestPayout: wallet.interestPayout,
    interestTaxRate: wallet.interestTaxRate != null ? Number(wallet.interestTaxRate) : undefined,
    maturityDate: wallet.maturityDate ?? undefined,
    totalInterestEarned: Number(wallet.totalInterestEarned ?? 0),
    status: resolvedStatus,
  }
}

export function WalletsPage() {
  const [filterType, setFilterType] = useState<string>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const { hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletViewModel | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)

  const { data: walletResponse, isLoading, refetch } = useListWallets()
  const { mutate: archiveWallet } = useArchiveWallet()
  const { mutate: syncCardBills } = useSyncCardBills()
  const { currency } = useSettingsStore()

  const wallets = useMemo(() => {
    const responseData = walletResponse?.data as
      | WalletApiItem[]
      | { items?: WalletApiItem[]; wallets?: WalletApiItem[] }
      | undefined

    if (Array.isArray(responseData)) {
      return responseData.map((wallet, walletIndex) => normalizeWallet(wallet, walletIndex, currency))
    }

    if (responseData && Array.isArray(responseData.items)) {
      return responseData.items.map((wallet, walletIndex) => normalizeWallet(wallet, walletIndex, currency))
    }

    if (responseData && Array.isArray(responseData.wallets)) {
      return responseData.wallets.map((wallet, walletIndex) => normalizeWallet(wallet, walletIndex, currency))
    }

    return []
  }, [walletResponse])

  const filteredWallets = wallets.filter((wallet) => {
    if (filterType !== 'all' && wallet.type !== filterType) return false
    if (!showArchived && wallet.status === 'archived') return false
    return true
  })

  const activeWallets = wallets.filter((wallet) => wallet.status === 'active')
  const archivedCount = wallets.length - activeWallets.length
  // Credit card balances are what you owe, so they reduce net worth instead of adding to it.
  const cards = activeWallets.filter((wallet) => wallet.type === 'credit_card')
  const assets = activeWallets.filter((wallet) => wallet.type !== 'credit_card').reduce((sum, wallet) => sum + wallet.balance, 0)
  const owed = cards.reduce((sum, wallet) => sum + wallet.balance, 0)
  const interestEarned = activeWallets.reduce((sum, wallet) => sum + (wallet.totalInterestEarned ?? 0), 0)
  // Keep each card's "payment" bill in step with what is currently owed on it.
  const cardKey = cards.map((card) => `${card.id}:${card.balance}:${card.dueDay ?? ''}`).join('|')
  useEffect(() => {
    if (cards.some((card) => card.dueDay)) syncCardBills()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey])

  const hasSavings = activeWallets.some((wallet) => wallet.type === 'savings')
  const money = (value: number) => formatMoney(value, currency, !showAmounts)

  const note = useMemo(() => {
    if (activeWallets.length === 0) return 'Add your first wallet and I will keep track of every peso for you.'
    const busiest = cards
      .filter((card) => card.creditLimit && card.creditLimit > 0)
      .map((card) => ({ card, pct: (card.balance / (card.creditLimit as number)) * 100 }))
      .sort((a, b) => b.pct - a.pct)[0]
    if (busiest && busiest.pct >= 70) {
      return `Your ${busiest.card.name} card is ${Math.round(busiest.pct)}% used. Maybe go easy on it until the next statement.`
    }
    if (interestEarned > 0) {
      return `Your savings have earned ${formatMoney(interestEarned, currency, false)} in interest so far. Nice work.`
    }
    return `You are holding ${formatMoney(assets, currency, false)} across ${activeWallets.length} wallet${activeWallets.length === 1 ? '' : 's'}.`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets, currency])

  const walletTypes: { value: string; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'bank', label: 'Banks' },
    { value: 'savings', label: 'Savings' },
    { value: 'credit_card', label: 'Cards' },
    { value: 'ewallet', label: 'E-wallets' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' },
  ]
  const SECTIONS: { type: WalletType; title: string }[] = [
    { type: 'ewallet', title: 'E-wallets' },
    { type: 'bank', title: 'Bank accounts' },
    { type: 'savings', title: 'Savings' },
    { type: 'credit_card', title: 'Credit cards' },
    { type: 'cash', title: 'Cash' },
    { type: 'other', title: 'Other' },
  ]
  const sections = SECTIONS.map((section) => {
    const items = filteredWallets.filter((wallet) => wallet.type === section.type)
    const total = items.filter((wallet) => wallet.status === 'active').reduce((sum, wallet) => sum + wallet.balance, 0)
    return { ...section, items, total }
  }).filter((section) => section.items.length > 0)
  const countFor = (type: string) =>
    wallets.filter((wallet) => (showArchived || wallet.status !== 'archived') && (type === 'all' || wallet.type === type)).length

  const handleArchiveWallet = (walletId: string) => {
    archiveWallet(
      { id: walletId },
      {
        onSuccess: () => {
          toast.success('Wallet archived')
          refetch()
        },
      }
    )
  }

  const handleTransfer = (walletId: string) => {
    setSelectedWalletId(walletId)
    setShowTransferModal(true)
  }

  const handleReceive = (walletId: string) => {
    setSelectedWalletId(walletId)
    setShowReceiveModal(true)
  }

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Your accounts</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Money</h1>
          </div>

          <div className="mt-5">
            <MoneyOverviewCard
              note={note}
              netWorth={money(assets - owed)}
              assets={money(assets)}
              owed={money(owed)}
              interest={money(interestEarned)}
              hasCards={cards.length > 0}
              hasSavings={hasSavings}
              showAmounts={showAmounts}
              onToggleAmounts={() => setShowAmounts((v) => !v)}
              onAdd={() => setShowCreateModal(true)}
            />
          </div>

          {/* Filters */}
          <div className="-mx-1 mt-5 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter wallets">
            {walletTypes
              .filter((type) => type.value === 'all' || type.value === filterType || countFor(type.value) > 0)
              .map((type) => {
                const selected = filterType === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFilterType(type.value)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    {type.label}
                    <span className={`rounded-full px-1.5 text-xs tabular-nums ${selected ? 'bg-white/25' : 'bg-secondary text-muted-foreground'}`}>
                      {countFor(type.value)}
                    </span>
                  </button>
                )
              })}
            {archivedCount > 0 && (
              <button
                type="button"
                aria-pressed={showArchived}
                onClick={() => setShowArchived((v) => !v)}
                className={`ml-auto shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  showArchived ? 'border-primary bg-primary/10 text-primary' : 'border-dashed border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {showArchived ? 'Hide archived' : `Archived (${archivedCount})`}
              </button>
            )}
          </div>

          {/* Wallets, grouped by kind */}
          <div className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="h-44 animate-pulse rounded-3xl bg-secondary" />
                ))}
              </div>
            ) : sections.length > 0 ? (
              <div className="space-y-5">
                {sections.map((section) => {
                  const isCardSection = section.type === 'credit_card'
                  const open = !collapsed[section.type]
                  return (
                    <section key={section.type} aria-label={section.title}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setCollapsed((prev) => ({ ...prev, [section.type]: open }))}
                        className="mb-2.5 flex w-full items-center justify-between gap-3 px-1 text-left"
                      >
                        <span className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
                          {section.title}
                        </span>
                        <span className={`text-sm font-semibold tabular-nums ${isCardSection && section.total > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {isCardSection && section.total > 0 ? '-' : ''}
                          {money(section.total)}
                        </span>
                      </button>
                      {open && (
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                          {section.items.map((wallet) => (
                            <WalletCard
                              key={wallet.id}
                              {...wallet}
                              hideAmounts={!showAmounts}
                              onEdit={() => setSelectedWallet(wallet)}
                              onArchive={handleArchiveWallet}
                              onTransfer={handleTransfer}
                              onReceive={handleReceive}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-border bg-card p-10 shadow-ios">
                <EmptyState
                  title={wallets.length === 0 ? 'No wallets yet' : 'Nothing in this filter'}
                  description={wallets.length === 0 ? 'Add a wallet to start tracking your money.' : 'Try another type, or add a new wallet.'}
                >
                  <Button className="gap-2 rounded-full" onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4" />
                    {wallets.length === 0 ? 'Create your first wallet' : 'New wallet'}
                  </Button>
                </EmptyState>
              </div>
            )}
          </div>
        </main>
      </IonContent>

      <CreateWalletModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => refetch()}
      />

      <CreateWalletModal
        open={!!selectedWallet}
        onClose={() => setSelectedWallet(null)}
        onSuccess={() => refetch()}
        wallet={selectedWallet}
      />

      {/* Transfer Modal */}

      {showTransferModal && selectedWalletId && (
        <CreateTransactionModal
        open={showTransferModal}
        onClose={() => {
          setShowTransferModal(false)
          setSelectedWalletId(null)
        }}
        onSuccess={() => refetch()}
        initialWalletId={selectedWalletId || undefined}
        initialType="transfer"
        title="Transfer Money"
        />
      )}

      {/* Receive Modal */}

      {showReceiveModal && selectedWalletId && (
      <CreateTransactionModal
        open={showReceiveModal}
        onClose={() => {
          setShowReceiveModal(false)
          setSelectedWalletId(null)
        }}
        onSuccess={() => refetch()}
        initialWalletId={selectedWalletId || undefined}
        initialType="income"
        title="Receive Money"
      />
      )}
    </IonPage>
  )
}
