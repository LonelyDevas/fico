'use client'

import { useEffect } from 'react'
import { useBillSummary } from '@/queries/user/bill/bills'
import { normalizeBillSummary } from '@/components/page/bills/bill-utils'

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** Shows the number of overdue and due-soon bills on the installed app's icon. Renders nothing. */
export function AppBadge() {
  const { data } = useBillSummary()
  const summary = data ? normalizeBillSummary(data) : null
  const count = summary ? summary.overdueBills + summary.dueSoonBills : 0

  useEffect(() => {
    const nav = navigator as BadgeNavigator
    if (!nav.setAppBadge) return
    const update = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.()
    update?.catch(() => {})
  }, [count])

  return null
}
