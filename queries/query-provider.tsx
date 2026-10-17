"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useEffect, useState } from "react"
import { AppToaster } from "@/components/ui/app-toaster"
import { CelebrationHost } from "@/components/celebration-dialog"
import { useSupabaseAuthSync } from "@/store/auth-store"
import { onLocalDataChanged } from "@/lib/local/status"
import { SyncStatusBadge } from "@/components/sync-status"

export default function Providers({ children }: { children: ReactNode }) {
  // Reads and writes hit the on-device database, which works without a connection, so TanStack
  // must not pause them just because the browser reports being offline.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { networkMode: "always" }, mutations: { networkMode: "always" } } })
  )
  useSupabaseAuthSync()

  // A sync that pulled new rows (changes from another device) makes every cached screen stale.
  useEffect(() => onLocalDataChanged(() => void queryClient.invalidateQueries()), [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <AppToaster />
      <CelebrationHost />
      <SyncStatusBadge />
    </QueryClientProvider>
  )
}
