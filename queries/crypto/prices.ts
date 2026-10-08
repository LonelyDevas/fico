import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCoinPrices } from '@/utils/crypto-prices'
import { useSettingsStore } from '@/store/settings-store'
import type { Investment } from '@/types/investment'

export type LiveHolding = {
  /** Quantity times the current price, in the app currency. */
  value: number
  price: number
  change24h: number | null
}

/** Live value of every active crypto holding that has a coin and a quantity. */
export function useLiveHoldings(investments: Investment[]) {
  const currency = useSettingsStore((state) => state.currency)

  const holdings = useMemo(
    () => investments.filter((i) => i.type === 'crypto' && i.coinId && Number(i.quantity) > 0 && i.status !== 'sold' && i.status !== 'archived'),
    [investments]
  )
  const ids = useMemo(() => [...new Set(holdings.map((i) => i.coinId as string))].sort(), [holdings])

  const query = useQuery({
    queryKey: ['coin-prices', currency, ids],
    queryFn: () => fetchCoinPrices(ids, currency),
    enabled: ids.length > 0,
    staleTime: 60_000,
    retry: 1,
  })

  const liveById = useMemo(() => {
    const result: Record<string, LiveHolding> = {}
    const prices = query.data?.prices
    if (!prices) return result
    for (const holding of holdings) {
      const coin = prices[holding.coinId as string]
      if (coin) result[holding.id] = { value: Number(holding.quantity) * coin.price, price: coin.price, change24h: coin.change24h }
    }
    return result
  }, [holdings, query.data])

  return {
    holdings,
    liveById,
    loading: query.isLoading && ids.length > 0,
    stale: !!query.data?.stale,
    failed: query.isError,
    fetchedAt: query.data?.fetchedAt ?? null,
    refetch: query.refetch,
  }
}
