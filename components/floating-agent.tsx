'use client'

import { PeacockAvatar } from '@/components/peacock-mascot'
import { Skeleton } from '@/components/ui/skeleton'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useListTransactions } from '@/queries/user/transaction/transaction'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useListCategories } from '@/queries/user/category/categories'
import { X, Send, Camera, CheckCircle2, ChevronDown, ArrowDownLeft, ArrowUpRight, Shuffle } from 'lucide-react'
import { CreateTransactionModal } from '@/components/page/transaction/create-transaction-modal'
import { parseTransactionText } from '@/utils/transaction-parser'
import { frequentTransactionSuggestions } from '@/utils/frequent-transactions'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { CreateTransactionData } from '@/types/transaction'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

/** Renders the **bold** markers used in agent replies instead of showing the asterisks. */
function RichText({ text }: { text: string }) {
  return (
    <span className="whitespace-pre-wrap">
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

const chipClass = (selected: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:border-primary/50'
  }`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Corner = 'tl' | 'tr' | 'bl' | 'br'

// A soft spring: quick off the mark, a hair of overshoot, then settles.
const SNAP_TRANSITION = 'transform 480ms cubic-bezier(0.34, 1.32, 0.54, 1)'

export function FloatingAgent() {
  const { data: walletsResponse } = useListWallets()
  const { data: categoriesResponse } = useListCategories()
  const { data: recentTransactionsResponse, isLoading: suggestionsLoading } = useListTransactions({ limit: '200' })
  const { currency } = useSettingsStore()

  const [isOpen, setIsOpen] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  // Dragging: the whole chat (launcher + panel) moves by an offset from its default corner.
  const rootRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const offsetRef = useRef(offset)
  const [panelLayout, setPanelLayout] = useState({ up: true, shift: 0, maxH: 608 })
  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number; baseLeft: number; baseTop: number; w: number; h: number; moved: boolean; samples: { t: number; x: number; y: number }[] } | null>(null)
  const justDragged = useRef(false)
  const cornerRef = useRef<Corner>('br')
  const [dragging, setDragging] = useState(false)

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

  // Real current translation (it may be mid-slide) and where the element sits with no translation.
  const measure = () => {
    const el = rootRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return { r, tx: m.m41, ty: m.m42, baseLeft: r.left - m.m41, baseTop: r.top - m.m42 }
  }

  // Write the position straight to the element so dragging never waits on a React render.
  const moveTo = (next: { x: number; y: number }, animate: boolean) => {
    offsetRef.current = next
    const el = rootRef.current
    if (!el) return
    el.style.transition = animate ? SNAP_TRANSITION : 'none'
    el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`
  }

  // Where a corner sits, kept clear of the top header and the bottom tab bar (measured live).
  const cornerPosition = (corner: Corner, w: number, h: number) => {
    const W = window.innerWidth
    const H = window.innerHeight
    const margin = 16
    const header = [...document.querySelectorAll('header.ios-blur')].map((el) => el.getBoundingClientRect()).find((rect) => rect.height > 0)
    const nav = document.querySelector('nav[aria-label="Primary"]')?.getBoundingClientRect()
    const topLimit = header && header.height > 0 ? header.bottom : 60
    const bottomLimit = nav && nav.height > 0 ? nav.top : H
    const left = corner === 'tl' || corner === 'bl' ? margin : W - margin - w
    const top = corner === 'tl' || corner === 'tr' ? topLimit + margin : bottomLimit - margin - h
    return { left, top }
  }

  const applyCorner = useCallback((corner: Corner, animate = true) => {
    const m = measure()
    if (!m) return
    const { left, top } = cornerPosition(corner, m.r.width, m.r.height)
    const next = { x: Math.round(left - m.baseLeft), y: Math.round(top - m.baseTop) }
    moveTo(next, animate)
    setOffset(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Open the panel toward the side of the screen with more room, and keep it on screen.
  const layoutPanel = useCallback(() => {
    const m = measure()
    if (!m) return
    // Judge by where it will end up, not where it is mid-slide.
    const top = m.baseTop + offsetRef.current.y
    const bottom = top + m.r.height
    const right = m.baseLeft + offsetRef.current.x + m.r.width
    const W = window.innerWidth
    const H = window.innerHeight
    const up = top + m.r.height / 2 > H / 2
    const panelWidth = Math.min(384, W - 32)
    const leftEdge = right - panelWidth
    const shift = leftEdge < 8 ? 8 - leftEdge : 0
    const available = up ? top - 12 - 64 : H - bottom - 12 - 8
    setPanelLayout({ up, shift, maxH: Math.min(608, Math.max(240, available)) })
  }, [])

  const startDrag = (e: React.PointerEvent<HTMLElement>, ignoreButtons = false) => {
    if (ignoreButtons && (e.target as HTMLElement).closest('button')) return
    const m = measure()
    if (!m) return
    drag.current = {
      startX: e.clientX, startY: e.clientY, ox: m.tx, oy: m.ty,
      baseLeft: m.baseLeft, baseTop: m.baseTop, w: m.r.width, h: m.r.height, moved: false,
      samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }],
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    const now = performance.now()
    d.samples.push({ t: now, x: e.clientX, y: e.clientY })
    while (d.samples.length > 2 && now - d.samples[0].t > 120) d.samples.shift()
    if (!d.moved && Math.hypot(dx, dy) < 6) return
    if (!d.moved) setDragging(true)
    d.moved = true
    // Free movement while held, anywhere on screen.
    const left = Math.min(Math.max(d.baseLeft + d.ox + dx, 8), Math.max(8, window.innerWidth - 8 - d.w))
    const top = Math.min(Math.max(d.baseTop + d.oy + dy, 8), Math.max(8, window.innerHeight - 8 - d.h))
    moveTo({ x: left - d.baseLeft, y: top - d.baseTop }, false)
  }
  // On release, snap to the nearest corner.
  const endDrag = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    justDragged.current = true
    window.setTimeout(() => { justDragged.current = false }, 60)
    // Where it would coast to: current spot plus the release velocity (px/ms) over ~260ms.
    const first = d.samples[0]
    const last = d.samples[d.samples.length - 1]
    const span = Math.max(last.t - first.t, 1)
    const vx = (last.x - first.x) / span
    const vy = (last.y - first.y) / span
    const cx = d.baseLeft + offsetRef.current.x + d.w / 2 + vx * 260
    const cy = d.baseTop + offsetRef.current.y + d.h / 2 + vy * 260
    const corner: Corner = (cy < window.innerHeight / 2 ? 't' : 'b') + (cx < window.innerWidth / 2 ? 'l' : 'r') as Corner
    cornerRef.current = corner
    try { localStorage.setItem('fico-agent-corner', corner) } catch {}
    setDragging(false)
    applyCorner(corner)
  }

  // Restore the saved corner, and keep to it when the window or the bars change size.
  useEffect(() => {
    if (isHidden) return
    try {
      const saved = localStorage.getItem('fico-agent-corner')
      if (saved === 'tl' || saved === 'tr' || saved === 'bl' || saved === 'br') cornerRef.current = saved
    } catch {}
    const place = () => applyCorner(cornerRef.current, false)
    place()
    const timer = window.setTimeout(place, 400)
    window.addEventListener('resize', place)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', place)
    }
  }, [applyCorner, isHidden])

  useEffect(() => {
    layoutPanel()
  }, [layoutPanel, offset, isOpen, isHidden])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    const data = recentTransactionsResponse?.data as any
    return frequentTransactionSuggestions(Array.isArray(data) ? data : data?.items)
  }, [recentTransactionsResponse])

  const wallets: any[] = (walletsResponse?.data as any)?.items ??
    (Array.isArray(walletsResponse?.data) ? (walletsResponse.data as any[]) : [])

  const categories: any[] = (categoriesResponse?.data as any)?.items ??
    (Array.isArray(categoriesResponse?.data) ? (categoriesResponse.data as any[]) : [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isProcessing, isOcring, showWalletPicker])

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'agent',
        content: 'Hi! Tell me about your transaction — type something like "Spent 50 on coffee" or upload a receipt photo 📷',
      }])
    }
  }, [messages.length])

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
  // Render: hidden state
  // ---------------------------------------------------------------------------
  if (isHidden) {
    return createPortal(
      <button
        onClick={() => setIsHidden(false)}
        className="fixed bottom-[calc(var(--bottom-nav-h)+1rem)] right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-4 text-sm font-semibold text-foreground shadow-ios transition-colors hover:border-primary/50 lg:bottom-6 lg:right-6"
      >
        <PeacockAvatar className="h-8 w-8" />
        Show Fico
      </button>,
      document.body
    )
  }

  const isTransfer = pendingTransaction?.type === 'transfer'
  const showSuggestions = messages.length <= 1 && !isProcessing && !isOcring && !showWalletPicker
  const busy = isProcessing || isOcring

  // ---------------------------------------------------------------------------
  // Render: main
  // ---------------------------------------------------------------------------
  return createPortal(
    <>
      <div
        ref={rootRef}
        className="fixed bottom-[calc(var(--bottom-nav-h)+1rem)] right-4 z-50 lg:bottom-6 lg:right-6"
        style={{ transform: `translate3d(${offsetRef.current.x}px, ${offsetRef.current.y}px, 0)`, transition: dragging ? 'none' : SNAP_TRANSITION, willChange: 'transform' }}
      >

        {/* ── Panel ── */}
        <div
          className={`absolute ${panelLayout.up ? 'bottom-[4.75rem] origin-bottom-right' : 'top-[4.75rem] origin-top-right'} transition-all duration-300 ease-out ${
            isOpen ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'
          }`}
          style={{ right: `${-panelLayout.shift}px` }}
          aria-hidden={!isOpen}
        >
          <div
            role="dialog"
            aria-label="Fico"
            className="flex w-[calc(100vw-2rem)] max-w-[24rem] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-ios-lg"
            style={{ maxHeight: `${panelLayout.maxH}px` }}
          >
            {/* Header */}
            <div
              className="relative shrink-0 cursor-grab touch-none select-none overflow-hidden bg-gradient-to-br from-primary to-[#004C99] px-4 pb-3 pt-4 text-white active:cursor-grabbing"
              onPointerDown={(e) => startDrag(e, true)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <svg viewBox="0 0 200 200" className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 opacity-20" aria-hidden="true">
                <g transform="translate(120 110)">
                  <circle r="70" fill="#00D9CC" />
                  <circle r="48" fill="#0066CC" />
                  <circle r="28" fill="#00D9CC" />
                  <circle r="11" fill="#2ECC71" />
                </g>
              </svg>
              <div className="relative flex items-center gap-3">
                <PeacockAvatar className="h-11 w-11 ring-2 ring-white/40" />
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-base font-semibold leading-tight">Fico</p>
                  <p className="text-xs text-white/75">Add transactions by chat</p>
                </div>
                <button
                  onClick={() => { setIsOpen(false); setIsHidden(true) }}
                  className="rounded-full px-2.5 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                >
                  Hide
                </button>
                <button onClick={() => setIsOpen(false)} aria-label="Close Fico" className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white">
                  <ChevronDown size={20} />
                </button>
              </div>
            </div>

            {/* ── CREATE MODE ── */}
            {(
              <div className="flex min-h-0 flex-1 flex-col">

                {/* Messages */}
                <div className="min-h-[14rem] flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'agent' && <PeacockAvatar className="mb-0.5 h-6 w-6" />}
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'rounded-br-md bg-primary text-primary-foreground'
                            : 'rounded-bl-md bg-secondary text-foreground'
                        }`}
                      >
                        {msg.imagePreview && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={msg.imagePreview} alt="Receipt" className="mb-2 max-h-28 w-auto rounded-lg object-cover" />
                        )}
                        <RichText text={msg.content} />
                      </div>
                    </div>
                  ))}

                  {/* Typing / scanning indicator */}
                  {busy && (
                    <div className="flex items-end gap-2">
                      <PeacockAvatar className="mb-0.5 h-6 w-6" />
                      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-secondary px-3.5 py-3 text-sm text-muted-foreground">
                        {isOcring ? (
                          <span>Scanning receipt… {ocrProgress}%</span>
                        ) : (
                          <>
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: '0.2s' }} />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: '0.4s' }} />
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Wallet choice */}
                  {showWalletPicker && (
                    <div className="space-y-3 rounded-2xl border border-border bg-background p-3">
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{isTransfer ? 'From' : 'Wallet'}</p>
                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {wallets.map((w: any) => {
                            const id = w._id ?? w.id
                            return (
                              <button key={id} type="button" aria-pressed={selectedWalletId === id} onClick={() => setSelectedWalletId(id)} className={chipClass(selectedWalletId === id)}>
                                {w.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      {isTransfer && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">To</p>
                          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {wallets
                              .filter((w: any) => (w._id ?? w.id) !== selectedWalletId)
                              .map((w: any) => {
                                const id = w._id ?? w.id
                                return (
                                  <button key={id} type="button" aria-pressed={selectedToWalletId === id} onClick={() => setSelectedToWalletId(id)} className={chipClass(selectedToWalletId === id)}>
                                    {w.name}
                                  </button>
                                )
                              })}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={handleOpenForm}
                        disabled={!selectedWalletId || (isTransfer && !selectedToWalletId)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-ios transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <CheckCircle2 size={16} /> Review &amp; save
                      </button>
                    </div>
                  )}

                  {/* Starter prompts: what you log most */}
                  {showSuggestions && (
                    <div className="space-y-2 pt-1">
                      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your usual</p>
                      {suggestionsLoading && [0, 1, 2].map(i => <Skeleton key={i} className="h-[3.25rem] w-full rounded-2xl" />)}
                      {!suggestionsLoading && suggestions.map(suggestion => {
                        const tone =
                          suggestion.type === 'income' ? 'bg-success/15 text-success' : suggestion.type === 'expense' ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary'
                        const Icon = suggestion.type === 'income' ? ArrowDownLeft : suggestion.type === 'expense' ? ArrowUpRight : Shuffle
                        return (
                          <button
                            key={suggestion.text}
                            type="button"
                            onClick={() => setInputText(suggestion.text)}
                            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                          >
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                              <Icon size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">{suggestion.label}</span>
                              <span className="block text-xs text-muted-foreground">
                                {suggestion.type === 'income' ? 'Money in' : suggestion.type === 'expense' ? 'Money out' : 'Transfer'}
                              </span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatMoney(suggestion.amount, currency, false)}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input bar */}
                <div className="flex shrink-0 items-center gap-2 border-t border-border p-3">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    aria-label="Upload a receipt photo"
                    title="Upload receipt"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
                  >
                    <Camera size={18} />
                  </button>
                  <input
                    type="text"
                    placeholder="Spent 50 on coffee…"
                    aria-label="Tell Fico about a transaction"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendText()}
                    disabled={busy}
                    className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={handleSendText}
                    disabled={!inputText.trim() || busy}
                    aria-label="Send"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-ios transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send size={16} />
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>

        {/* ── Launcher ── */}
        <button
          onClick={() => { if (!justDragged.current) setIsOpen(!isOpen) }}
          onPointerDown={(e) => startDrag(e)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label={isOpen ? 'Close Fico' : 'Open Fico'}
          aria-expanded={isOpen}
          className={`relative flex h-16 w-16 touch-none select-none items-center justify-center rounded-full bg-card shadow-ios-lg ring-2 ring-primary/40 transition-all duration-300 hover:ring-primary ${
            isOpen ? 'scale-95' : 'scale-100'
          }`}
        >
          {isOpen ? <X size={24} className="text-primary" /> : (
            <>
              <PeacockAvatar className="h-14 w-14" label="Fico, your financial advisor" />
              <span className="absolute right-0 top-0 h-4 w-4 rounded-full border-2 border-card bg-success" />
            </>
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
