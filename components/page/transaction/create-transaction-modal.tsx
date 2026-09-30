'use client'

import { QuickAddSheet, type QuickAddSheetProps } from '@/components/page/transaction/quick-add-sheet'

/**
 * Kept so existing callers keep working. Creating and editing a transaction both use
 * the numpad sheet now, on phones and on desktop.
 */
export function CreateTransactionModal(props: QuickAddSheetProps) {
  return <QuickAddSheet {...props} />
}
