"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useState } from "react"
import { AppToaster } from "@/components/ui/app-toaster"
import { CelebrationHost } from "@/components/celebration-dialog"
import { useSupabaseAuthSync } from "@/store/auth-store"

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  useSupabaseAuthSync()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <AppToaster />
      <CelebrationHost />
  </QueryClientProvider>
  )
}
