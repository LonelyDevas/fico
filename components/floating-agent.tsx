'use client'

import { EmptyState, PeacockAvatar, PeacockMascot } from '@/components/peacock-mascot'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuickStats } from '@/queries/user/transaction/transaction'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useListCategories } from '@/queries/user/category/categories'
import { X, MessageCircle, Plus, Send, Camera, Loader2, CheckCircle2 } from 'lucide-react'
import { CreateTransactionModal } from '@/components/page/transaction/create-transaction-modal'
import { parseTransactionText } from '@/utils/transaction-parser'
import type { CreateTransactionData } from '@/types/transaction'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentMode = 'insight' | 'create'

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  imagePreview?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FloatingAgent() {
  const { data: quickStatsResponse } = useQuickStats()
  const { data: walletsResponse } = useListWallets()
  const { data: categoriesResponse } = useListCategories()

  const [isOpen, setIsOpen] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [mode, setMode] = useState<AgentMode>('insight')

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [isOcring, setIsOcring] = useState(false)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingTransaction, setPendingTransaction] = useState<Partial<CreateTransactionData> | null>(null)
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [selectedToWalletId, setSelectedToWalletId] = useState('')
  const [showWalletPicker, setShowWalletPicker] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const insight = (quickStatsResponse?.data?.topCategory as any)?.insight as string | undefined

  const wallets: any[] = (walletsResponse?.data as any)?.items ??
    (Array.isArray(walletsResponse?.data) ? (walletsResponse.data as any[]) : [])

  const categories: any[] = (categoriesResponse?.data as any)?.items ??
    (Array.isArray(categoriesResponse?.data) ? (categoriesResponse.data as any[]) : [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isProcessing, isOcring, showWalletPicker])

  // Welcome message when switching to create mode
  useEffect(() => {
    if (mode === 'create' && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'agent',
        content: 'Hi! Tell me about your transaction — type something like "Spent 50 on coffee" or upload a receipt photo 📷',
      }])
    }
  }, [mode, messages.length])

  // ---------------------------------------------------------------------------
  // Category & wallet matching
  // ---------------------------------------------------------------------------
  const matchCategoryId = useCallback((inferredName?: string): string | undefined => {
    if (!inferredName) return undefined
    const lower = inferredName.toLowerCase()
    const match = categories.find((c: any) => {
      const name = (c.name ?? '').toLowerCase()
      return (
        name.includes(lower) ||
        lower.includes(name) ||
        lower.split(/[&\s]+/).some((word: string) => name.includes(word))
      )
    })
    return match?._id ?? match?.id
  }, [categories])

  const matchWalletId = useCallback((walletName?: string): string | undefined => {
    if (!walletName) return undefined
    const query = walletName.toLowerCase().trim()
    // 1. Exact match
    let m = wallets.find((w: any) => (w.name ?? '').toLowerCase() === query)
    if (m) return m._id ?? m.id
    // 2. Wallet name starts with query ("bdo" → "BDO Unibank, Inc")
    m = wallets.find((w: any) => (w.name ?? '').toLowerCase().startsWith(query))
    if (m) return m._id ?? m.id
    // 3. Query starts with wallet name, min 3 chars ("bpi family" → "BPI")
    m = wallets.find((w: any) => {
      const name = (w.name ?? '').toLowerCase()
      return name.length >= 3 && query.startsWith(name)
    })
    return m?._id ?? m?.id
  }, [wallets])

  // ---------------------------------------------------------------------------
  // Message helpers
  // ---------------------------------------------------------------------------
  const pushAgent = (content: string) => {
    setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'agent', content }])
  }

  // ---------------------------------------------------------------------------
  // Text send
  // ---------------------------------------------------------------------------
  const handleSendText = async () => {
    const text = inputText.trim()
    if (!text || isProcessing || isOcring) return

    setInputText('')
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }])
    setIsProcessing(true)

    // Small delay for UX (feels more natural)
    await new Promise(r => setTimeout(r, 500))
    const parsed = parseTransactionText(text)
    setIsProcessing(false)

    if (!parsed.amount || parsed.confidence.amount < 0.5) {
      pushAgent("I couldn't detect an amount. Try: \"Spent 50 on coffee\" or \"Received 2000 salary\".")
      return
    }

    const txData: Partial<CreateTransactionData> = {
      amount: parsed.amount,
      description: parsed.description,
      type: parsed.type,
      date: parsed.date,
      categoryId: matchCategoryId(parsed.inferredCategoryName),
      ...(parsed.serviceFee && { serviceFee: parsed.serviceFee }),
    }
    const matchedFromId = matchWalletId(parsed.fromWalletName)
    const matchedToId   = matchWalletId(parsed.toWalletName)

    setPendingTransaction(txData)
    setSelectedWalletId(matchedFromId ?? '')
    setSelectedToWalletId(matchedToId ?? '')
    setShowWalletPicker(true)

    const typeLabel = parsed.type === 'income' ? '💰 income' : parsed.type === 'transfer' ? '🔄 transfer' : '💸 expense'
    const isTransfer = parsed.type === 'transfer'
    const dateLabel = parsed.date ? ` · ${formatDate(parsed.date)}` : ''
    const locationLine = isTransfer && parsed.fromWalletName && parsed.toWalletName
      ? ` from **${parsed.fromWalletName.toUpperCase()}** to **${parsed.toWalletName.toUpperCase()}**`
      : parsed.description ? ` — "${parsed.description}"` : ''
    const catLine = !isTransfer && parsed.inferredCategoryName ? ` · ${parsed.inferredCategoryName}` : ''
    const feeLine = parsed.serviceFee ? ` + ${formatAmount(parsed.serviceFee)} service fee` : ''

    let walletNote = ''
    if (isTransfer) {
      const noFrom = !matchedFromId && parsed.fromWalletName
      const noTo   = !matchedToId   && parsed.toWalletName
      if (noFrom || noTo) {
        const missing = [noFrom && parsed.fromWalletName, noTo && parsed.toWalletName].filter(Boolean).join(' & ')
        walletNote = `\n\n⚠️ Couldn't find wallet "${missing}" — please select it below.`
      } else {
        walletNote = '\n\nWallets matched! Confirm below and I\'ll pre-fill the form.'
      }
    } else if (matchedFromId && parsed.fromWalletName) {
      walletNote = `\n\nWallet matched to **${parsed.fromWalletName.toUpperCase()}**. Confirm below or change it.`
    } else {
      walletNote = '\n\nNow pick a wallet and I\'ll pre-fill the form for you.'
    }

    pushAgent(`Got it! I detected ${formatAmount(parsed.amount)} ${typeLabel}${locationLine}${catLine}${feeLine}${dateLabel}.${walletNote}`)
  }

  // ---------------------------------------------------------------------------
  // Image upload / OCR
  // ---------------------------------------------------------------------------
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    const preview = URL.createObjectURL(file)
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      role: 'user',
      content: 'Uploaded a receipt image',
      imagePreview: preview,
    }])

    setIsOcring(true)
    setOcrProgress(0)

    try {
      const { extractTextFromImage } = await import('@/utils/receipt-ocr')
      const text = await extractTextFromImage(file, setOcrProgress)
      setIsOcring(false)

      if (!text.trim()) {
        pushAgent("I couldn't read text from that image. Try a clearer photo or type the details manually.")
        return
      }

      const parsed = parseTransactionText(text)

      if (!parsed.amount || parsed.confidence.amount < 0.5) {
        pushAgent(`I scanned the image but couldn't find a clear amount. Here's what I read:\n\n"${text.slice(0, 180).trim()}…"\n\nCould you type the amount?`)
        return
      }

      const txData: Partial<CreateTransactionData> = {
        amount: parsed.amount,
        description: parsed.description,
        type: parsed.type ?? 'expense',
        date: parsed.date,
        categoryId: matchCategoryId(parsed.inferredCategoryName),
        ...(parsed.serviceFee && { serviceFee: parsed.serviceFee }),
      }
      setPendingTransaction(txData)
      setSelectedWalletId(matchWalletId(parsed.fromWalletName) ?? '')
      setSelectedToWalletId(matchWalletId(parsed.toWalletName) ?? '')
      setShowWalletPicker(true)

      const typeLabel = parsed.type === 'income' ? '💰 income' : '💸 expense'
      const catLabel = parsed.inferredCategoryName ? ` · ${parsed.inferredCategoryName}` : ''
      const desc = parsed.description ? ` — "${parsed.description}"` : ''
      const feeLine = parsed.serviceFee ? ` + ${formatAmount(parsed.serviceFee)} service fee` : ''

      pushAgent(
        `Receipt scanned! I detected ${formatAmount(parsed.amount)} ${typeLabel}${catLabel}${desc}${feeLine}.\n\nPick a wallet to continue.`
      )
    } catch {
      setIsOcring(false)
      pushAgent("Something went wrong scanning the image. Try again or type the details manually.")
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ---------------------------------------------------------------------------
  // Open form
  // ---------------------------------------------------------------------------
  const handleOpenForm = () => {
    if (!selectedWalletId || !pendingTransaction) return
    setShowWalletPicker(false)
    setModalOpen(true)
  }

  const handleModalSuccess = () => {
    setModalOpen(false)
    setPendingTransaction(null)
    setSelectedWalletId('')
    setSelectedToWalletId('')
    setShowWalletPicker(false)
    setMessages([{
      id: `a-${Date.now()}`,
      role: 'agent',
      content: '✅ Transaction saved! Want to log another one?',
    }])
  }

  // ---------------------------------------------------------------------------
  // Mode switch
  // ---------------------------------------------------------------------------
  const switchMode = (next: AgentMode) => {
    setMode(next)
    if (next === 'create') {
      setMessages([])        // triggers welcome message via useEffect
      setPendingTransaction(null)
      setShowWalletPicker(false)
      setSelectedWalletId('')
      setSelectedToWalletId('')
    }
  }

  // ---------------------------------------------------------------------------
  // Render: hidden state
  // ---------------------------------------------------------------------------
  if (isHidden) {
    return createPortal(
      <button
        onClick={() => setIsHidden(false)}
        className="fixed bottom-[calc(var(--bottom-nav-h)+1rem)] right-4 z-40 lg:bottom-6 lg:right-6 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg transition-all duration-300 text-sm font-medium"
      >
        <MessageCircle size={16} />
        Show Fico
      </button>,
      document.body
    )
  }

  // ---------------------------------------------------------------------------
  // Render: main
  // ---------------------------------------------------------------------------
  return createPortal(
    <>
      <div className="fixed bottom-[calc(var(--bottom-nav-h)+1rem)] right-4 z-50 lg:bottom-6 lg:right-6">

        {/* ── Expanded Panel ── */}
        <div
          className={`absolute bottom-0 right-0 transition-all duration-300 ease-out origin-bottom-right ${
            isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'
          }`}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-80 sm:w-96 flex flex-col overflow-hidden"
            style={{ maxHeight: '560px' }}
          >

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <PeacockAvatar className="w-7 h-7" />
                <span className="text-white font-semibold text-sm">Fico</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Mode tabs */}
                <div className="flex bg-white/20 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => switchMode('insight')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      mode === 'insight' ? 'bg-white text-blue-600' : 'text-white hover:bg-white/20'
                    }`}
                  >
                    Insight
                  </button>
                  <button
                    onClick={() => switchMode('create')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                      mode === 'create' ? 'bg-white text-blue-600' : 'text-white hover:bg-white/20'
                    }`}
                  >
                    <Plus size={10} />Add
                  </button>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ── INSIGHT MODE ── */}
            {mode === 'insight' && (
              <div className="p-5 space-y-4 overflow-y-auto">
                {insight ? (
                  <div className="flex items-end gap-2">
                    <PeacockMascot pose="advisor" className="w-24 h-24 shrink-0" label="Fico, your financial advisor" />
                    <div className="relative min-w-0 flex-1 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200 dark:border-blue-700 rounded-2xl rounded-bl-md p-3">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Fico</p>
                      <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">{insight}</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-4">
                    <EmptyState compact pose="advisor" title="No insights yet" description="Keep tracking your transactions!" />
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => switchMode('create')}
                    className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium transition-colors"
                  >
                    <Plus size={12} /> Add Transaction
                  </button>
                  <button
                    onClick={() => { setIsOpen(false); setIsHidden(true) }}
                    className="flex-1 text-xs text-muted-foreground hover:text-foreground py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
                  >
                    Hide
                  </button>
                </div>
              </div>
            )}

            {/* ── CREATE MODE ── */}
            {mode === 'create' && (
              <div className="flex flex-col flex-1 min-h-0">

                {/* Messages */}
                <div
                  className="flex-1 overflow-y-auto p-3 space-y-3"
                  style={{ minHeight: '200px', maxHeight: '370px' }}
                >
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'agent' && <PeacockAvatar className="w-5 h-5 mb-0.5" />}
                      <div
                        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-blue-500 text-white rounded-br-sm'
                            : 'bg-secondary text-foreground rounded-bl-sm'
                        }`}
                      >
                        {msg.imagePreview && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={msg.imagePreview} alt="Receipt" className="rounded-lg mb-2 max-h-28 w-auto object-cover" />
                        )}
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      </div>
                    </div>
                  ))}

                  {/* Processing indicator */}
                  {(isProcessing || isOcring) && (
                    <div className="flex items-end gap-1 justify-start">
                      <PeacockAvatar className="w-5 h-5 mb-0.5" />
                      <div className="bg-secondary rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin" />
                        {isOcring ? `Scanning… ${ocrProgress}%` : 'Processing…'}
                      </div>
                    </div>
                  )}

                  {/* Inline wallet picker */}
                  {showWalletPicker && (
                    <div className="bg-card border border-border rounded-xl p-3 space-y-2 mx-1">
                      {pendingTransaction?.type === 'transfer' ? (
                        <>
                          <p className="text-xs font-medium text-foreground">From wallet:</p>
                          <select
                            value={selectedWalletId}
                            onChange={e => setSelectedWalletId(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Choose source wallet…</option>
                            {wallets.map((w: any) => (
                              <option key={w._id ?? w.id} value={w._id ?? w.id}>{w.name}</option>
                            ))}
                          </select>
                          <p className="text-xs font-medium text-foreground">To wallet:</p>
                          <select
                            value={selectedToWalletId}
                            onChange={e => setSelectedToWalletId(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Choose destination wallet…</option>
                            {wallets
                              .filter((w: any) => (w._id ?? w.id) !== selectedWalletId)
                              .map((w: any) => (
                                <option key={w._id ?? w.id} value={w._id ?? w.id}>{w.name}</option>
                              ))}
                          </select>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-medium text-foreground">Select wallet:</p>
                          <select
                            value={selectedWalletId}
                            onChange={e => setSelectedWalletId(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Choose a wallet…</option>
                            {wallets.map((w: any) => (
                              <option key={w._id ?? w.id} value={w._id ?? w.id}>{w.name}</option>
                            ))}
                          </select>
                        </>
                      )}
                      <button
                        onClick={handleOpenForm}
                        disabled={
                          !selectedWalletId ||
                          (pendingTransaction?.type === 'transfer' && !selectedToWalletId)
                        }
                        className="w-full flex items-center justify-center gap-1.5 text-xs bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors"
                      >
                        <CheckCircle2 size={12} /> Review & Save
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input bar */}
                <div className="border-t border-border p-2 shrink-0 flex items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing || isOcring}
                    title="Upload receipt"
                    className="p-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <Camera size={16} />
                  </button>
                  <input
                    type="text"
                    placeholder='e.g. "Spent 50 on coffee"'
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendText()}
                    disabled={isProcessing || isOcring}
                    className="flex-1 text-xs px-3 py-2 border border-border rounded-xl bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={handleSendText}
                    disabled={!inputText.trim() || isProcessing || isOcring}
                    className="p-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>

        {/* ── Collapsed Button ── */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 relative ${
            isOpen ? 'scale-95' : 'scale-100'
          }`}
        >
          {!isOpen ? (
            <>
              <PeacockAvatar className="w-14 h-14" label="Fico, your financial advisor" />
              <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
            </>
          ) : (
            <MessageCircle size={24} className="text-white" />
          )}
        </button>

      </div>

      {/* Transaction review modal (pre-filled by AI) */}
      {modalOpen && (
        <CreateTransactionModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={handleModalSuccess}
          title="Review Transaction"
          initialData={{
            ...pendingTransaction,
            walletId: selectedWalletId,
            ...(selectedToWalletId && { toWalletId: selectedToWalletId }),
          }}
        />
      )}
    </>,
    document.body
  )
}
