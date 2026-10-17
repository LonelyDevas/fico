// Parses a bank-statement CSV into rows for the transactions_bulk_import RPC.
//
// This is the parsing half of the import-transactions Edge Function
// (fico-api/supabase/functions/import-transactions), run on the device so an import works offline.
// Keep the two in step.

export interface ImportRow {
  date: string
  amount: number
  type: 'income' | 'expense'
  description: string
  tags: string[]
  category_id: string | null
}

export interface SkippedRow {
  row: number
  reason: string
}

export interface ParsedImport {
  totalRows: number
  valid: ImportRow[]
  skipped: SkippedRow[]
}

type Row = Record<string, string>

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

function findField(row: Row, ...keys: string[]): string {
  for (const key of keys) {
    const norm = normalizeKey(key)
    if (row[norm] !== undefined) return row[norm]
    const plain = norm.replace(/_/g, '')
    const match = Object.keys(row).find((k) => k.replace(/_/g, '') === plain)
    if (match !== undefined) return row[match]
  }
  return ''
}

function parseCSV(content: string): Row[] {
  const cleaned = content.replace(/^﻿/, '')
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const header = lines[0]
  const sep = header.includes('\t') ? '\t' : header.includes(';') ? ';' : ','

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = !inQ
      } else if (c === sep && !inQ) {
        fields.push(cur.trim())
        cur = ''
      } else {
        cur += c
      }
    }
    fields.push(cur.trim())
    return fields
  }

  const headers = parseLine(header).map(normalizeKey)
  return lines.slice(1).map((line) => {
    const vals = parseLine(line)
    const row: Row = {}
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? ''
    })
    return row
  })
}

function parseImportDate(s: string): Date | null {
  if (!s?.trim()) return null
  const t = s.trim()
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(t)) {
    const d = new Date(t.replace(/\//g, '-'))
    return isNaN(d.getTime()) ? null : d
  }
  if (/^\d{8}$/.test(t)) {
    const d = new Date(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`)
    return isNaN(d.getTime()) ? null : d
  }
  // DD-MM-YYYY or DD/MM/YYYY, with an optional time ("05/01/2024 10:30").
  const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?))?$/.exec(t)
  if (dmy) {
    const [, day, month, year, time] = dmy
    const d = new Date(`${year}-${month}-${day}${time ? `T${time.replace(/^(\d):/, '0$1:')}` : ''}`)
    return isNaN(d.getTime()) ? null : d
  }
  const fallback = new Date(t)
  return isNaN(fallback.getTime()) ? null : fallback
}

function parseImportAmount(s: string): number | null {
  if (!s?.trim()) return null
  const c = s.trim().replace(/[€$£¥\s]/g, '')
  // "1,234.56" and "1.234,56" carry both separators; a lone comma is a decimal ("12,50") unless it
  // groups digits in threes ("1,234", "12,500"), which is a thousands separator.
  const norm =
    c.includes(',') && c.includes('.')
      ? c.lastIndexOf(',') > c.lastIndexOf('.')
        ? c.replace(/\./g, '').replace(',', '.')
        : c.replace(/,/g, '')
      : c.includes(',')
        ? /^\d{1,3}(,\d{3})+$/.test(c)
          ? c.replace(/,/g, '')
          : c.replace(',', '.')
        : c
  const v = parseFloat(norm)
  return isNaN(v) ? null : Math.abs(v)
}

function mapIndicator(s: string): 'income' | 'expense' | null {
  const u = s.trim().toUpperCase()
  if (['CRDT', 'CREDIT', 'C', 'CR'].includes(u)) return 'income'
  if (['DBIT', 'DEBIT', 'D', 'DR'].includes(u)) return 'expense'
  return null
}

export function parseImportCsv(content: string, categories: { id: string; name: string }[], defaultCategoryId?: string | null): ParsedImport {
  const rows = parseCSV(content)
  const valid: ImportRow[] = []
  const skipped: SkippedRow[] = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2

    let bookDate = findField(row, 'Date and Time', 'date and time', 'datetime')
    if (!bookDate) {
      const dateField = findField(row, 'Date', 'date', 'book date', 'booking date', 'value date')
      const timeField = findField(row, 'Time', 'time', 'hour', 'hours')
      bookDate = timeField ? `${dateField} ${timeField}` : dateField
    }

    const debitStr = findField(row, 'Debit', 'debit')
    const creditStr = findField(row, 'Credit', 'credit')

    let amountStr = ''
    let indicator = ''
    if (debitStr?.trim() || creditStr?.trim()) {
      // Exports often fill the unused column with 0.00, so the one holding a real amount wins.
      if (parseImportAmount(debitStr)) {
        amountStr = debitStr
        indicator = 'DEBIT'
      } else if (parseImportAmount(creditStr)) {
        amountStr = creditStr
        indicator = 'CREDIT'
      }
    } else {
      amountStr = findField(row, 'Amount', 'amount')
      indicator = findField(row, 'Credit/debit indicator', 'credit debit indicator', 'indicator')
    }

    const description = findField(row, 'Description', 'description', 'memo', 'narration')
    const counterParty = findField(row, 'Counter party name', 'counterparty name', 'beneficiary', 'payee', 'merchant')
    const txRef = findField(row, 'Transaction reference', 'transaction reference', 'reference', 'ref', 'reference no')
    const txType = findField(row, 'Transaction type', 'transaction type')
    const txGroup = findField(row, 'Transaction group', 'transaction group')
    const csvCategory = findField(row, 'Category', 'category')
    const currency = findField(row, 'Currency', 'currency')
    const instructedAmt = findField(row, 'Instructed amount', 'instructed amount')
    const exchangeRate = findField(row, 'Currency exchange rate', 'exchange rate')
    const instructedCur = findField(row, 'Instructed currency', 'instructed currency')

    const parsedDate = parseImportDate(bookDate)
    if (!parsedDate) {
      skipped.push({ row: rowNum, reason: 'missing_date' })
      return
    }

    const parsedAmount = parseImportAmount(amountStr)
    if (parsedAmount === null || parsedAmount === 0) {
      skipped.push({ row: rowNum, reason: 'invalid_amount' })
      return
    }

    const type = mapIndicator(indicator)
    if (!type) {
      skipped.push({ row: rowNum, reason: 'missing_indicator' })
      return
    }

    if (!description.trim() && !counterParty.trim() && !txRef.trim()) {
      skipped.push({ row: rowNum, reason: 'unidentifiable_system_payment' })
      return
    }

    let finalDesc = description.trim() || counterParty.trim() || txRef.trim()
    if (counterParty.trim() && description.trim() && description.trim() !== counterParty.trim()) {
      finalDesc = `${description.trim()} · ${counterParty.trim()}`
    }
    if (instructedAmt.trim() && instructedCur.trim() && instructedCur.trim() !== currency.trim()) {
      finalDesc += ` [${instructedCur.trim()} ${instructedAmt.trim()}${exchangeRate.trim() ? ` @ ${exchangeRate.trim()}` : ''}]`
    }

    const tags: string[] = []
    if (txType.trim()) tags.push(txType.trim())
    if (txGroup.trim() && txGroup.trim() !== txType.trim()) tags.push(txGroup.trim())

    let matchedCategoryId: string | null = null
    if (csvCategory.trim()) {
      const cat = categories.find((c) => c.name?.toLowerCase() === csvCategory.trim().toLowerCase())
      if (cat) matchedCategoryId = cat.id
    }
    if (!matchedCategoryId && defaultCategoryId) matchedCategoryId = defaultCategoryId

    valid.push({
      date: parsedDate.toISOString(),
      amount: parsedAmount,
      type,
      description: finalDesc,
      tags,
      category_id: matchedCategoryId,
    })
  })

  return { totalRows: rows.length, valid, skipped }
}
