import { supabase } from '@/utils/supabase-client'

const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Saves a file: opens the share sheet where the device supports sharing files, otherwise downloads it. */
export async function saveFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const file = new File([blob], filename, { type: mime })

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return
    } catch (error) {
      // The user closing the share sheet is not a failure.
      if ((error as Error).name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Every transaction the signed-in user has, as a spreadsheet-friendly CSV. Returns how many rows it holds. */
export async function exportTransactionsCsv(): Promise<number> {
  const [wallets, categories] = await Promise.all([
    supabase.from('wallets').select('id, name'),
    supabase.from('categories').select('id, name'),
  ])
  if (wallets.error) throw wallets.error
  if (categories.error) throw categories.error
  const walletName = new Map((wallets.data ?? []).map((w) => [w.id, w.name]))
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]))

  const rows: Record<string, unknown>[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('transactions')
      .select('date, type, amount, description, wallet_id, to_wallet_id, category_id, service_fee, status, tags')
      .order('date', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }

  const header = ['Date', 'Type', 'Amount', 'Description', 'Wallet', 'To wallet', 'Category', 'Fee', 'Status', 'Tags']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.type,
        r.amount,
        r.description,
        walletName.get(r.wallet_id as string),
        r.to_wallet_id ? walletName.get(r.to_wallet_id as string) : '',
        r.category_id ? categoryName.get(r.category_id as string) : '',
        r.service_fee,
        r.status,
        Array.isArray(r.tags) ? r.tags.join(' ') : '',
      ]
        .map(csvCell)
        .join(',')
    )
  }

  await saveFile(`fico-transactions-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + lines.join('\r\n'), 'text/csv')
  return rows.length
}
