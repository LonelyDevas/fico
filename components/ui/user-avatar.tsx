'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  user?: { username?: string; email?: string; avatarUrl?: string } | null
  className?: string
}

/** Round profile picture, falling back to the first letter of the name when there is none (or it fails to load). */
export function UserAvatar({ user, className }: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = user?.avatarUrl
  const showImage = !!url && failedUrl !== url
  const initial = (user?.username || user?.email || 'U').trim().charAt(0).toUpperCase()

  return (
    <span
      className={cn(
        'relative inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-semibold text-primary-foreground',
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setFailedUrl(url ?? null)} />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  )
}
