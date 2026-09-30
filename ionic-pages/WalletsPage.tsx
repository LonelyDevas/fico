'use client'

import { EmptyState } from '@/components/peacock-mascot'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Plus, Filter } from 'lucide-react'
import { IonContent, IonPage } from '@ionic/react'
import { WalletOverview } from '@/components/page/wallet/wallet-overview'
import { WalletCard } from '@/components/page/wallet/wallet-card'
import { CreateWalletModal } from '@/components/page/wallet/create-wallet-modal'
import { CreateTransactionModal } from '@/components/page/transaction/create-transaction-modal'
import { useArchiveWallet, useListWallets } from '@/queries/user/wallet/wallets'
import { useSettingsStore } from '@/store/settings-store'
import { WalletStatus, WalletType } from '@/types/wallet'

interface WalletViewModel {
  id: string
  name: string
  type: WalletType
  balance: number
  currency: string
  color?: string
  icon?: string
  accountNumber?: string
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
  status?: WalletStatus
}

const walletTypeValues: WalletType[] = ['bank', 'cash', 'ewallet', 'credit_card', 'other']

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
    status: resolvedStatus,
  }
}

export function WalletsPage() {
  const [filterType, setFilterType] = useState<string>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletViewModel | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)

  const { data: walletResponse, isLoading, refetch } = useListWallets()
  const { mutate: archiveWallet } = useArchiveWallet()
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
  const totalBalance = activeWallets.reduce((sum, wallet) => sum + wallet.balance, 0)
  const monthlyIncome = 0
  const monthlyExpense = 0

  const walletTypes = [
    { value: 'all', label: 'All Wallets' },
    { value: 'bank', label: 'Bank Accounts' },
    { value: 'credit_card', label: 'Credit Cards' },
    { value: 'ewallet', label: 'E-Wallets' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Others' },
  ]

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
        {/* Main Content */}
        <main className="flex-1">
          {/* Page Header */}
          <div className="bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-bold text-foreground">My Wallets</h1>
                  <p className="text-muted-foreground mt-2">Manage all your accounts and payment methods</p>
                </div>
                <Button className="gap-2 rounded-full" onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Wallet</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Overview Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <WalletOverview
              totalBalance={totalBalance}
              currency={currency}
              activeWallets={activeWallets.length}
              totalWallets={wallets.length}
              monthlyIncome={monthlyIncome}
              monthlyExpense={monthlyExpense}
            />
          </div>

          {/* Filters Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-ios">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Filter by Type</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {walletTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setFilterType(type.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      filterType === type.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Show Archived Toggle */}
              <div className="mt-4 flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-card text-primary accent-primary cursor-pointer"
                  />
                  <span className="text-sm text-muted-foreground">Show archived wallets</span>
                </label>
              </div>
            </div>
          </div>

          {/* Wallets Grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                {filteredWallets.length} Wallet{filteredWallets.length !== 1 ? 's' : ''}
              </h2>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="h-72 rounded-2xl border border-border bg-card animate-pulse" />
                ))}
              </div>
            ) : filteredWallets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredWallets.map((wallet) => (
                  <WalletCard
                    key={wallet.id}
                    {...wallet}
                    onEdit={() => setSelectedWallet(wallet)}
                    onArchive={handleArchiveWallet}
                    onTransfer={handleTransfer}
                    onReceive={handleReceive}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-12">
                <EmptyState title="No wallets found" description="Add a wallet to start tracking your money.">
                  <Button className="gap-2 rounded-full" onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4" />
                    Create Your First Wallet
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
