'use client'

import { useState, type ReactNode } from 'react'
import { getInstitution, institutionLogo, type Institution } from '@/lib/ph-institutions'
import { cn } from '@/lib/utils'

interface InstitutionLogoProps {
  /** Catalog id, or a full institution. */
  institution?: string | Institution | null
  /** A logo to try before the institution's own, e.g. a coin icon. */
  src?: string
  /** Used for the monogram when there is no institution. */
  fallbackLabel?: string
  fallbackColor?: string
  /** Shown instead of the monogram when no logo loads. */
  fallback?: ReactNode
  className?: string
  /** 'glass' draws the monogram on a translucent tile, for use on a card of the brand's own color. */
  variant?: 'solid' | 'glass'
}

const monogram = (label: string) => {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Institution logo: the given src, then the institution's bundled file in public/banks/,
 * falling back to a brand-colored monogram when there is none or it fails to load.
 */
export function InstitutionLogo({ institution, src, fallbackLabel = '', fallbackColor = '#0066CC', fallback, className, variant = 'solid' }: InstitutionLogoProps) {
  const resolved = typeof institution === 'string' ? getInstitution(institution) : institution ?? undefined
  const own = resolved ? institutionLogo(resolved) : undefined
  const candidates = [...(src ? [{ src, fit: 'contain' as const }] : []), ...(own ? [own] : [])]
  const key = candidates.map((c) => c.src).join('|')
  const [failed, setFailed] = useState<{ key: string; count: number }>({ key, count: 0 })
  const tried = failed.key === key ? failed.count : 0
  const current = candidates[tried]

  return (
    <span
      className={cn('relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white', className)}
      style={{ backgroundColor: current ? '#FFFFFF' : variant === 'glass' ? 'rgba(255,255,255,0.22)' : fallback ? fallbackColor : resolved?.color ?? fallbackColor }}
    >
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.src}
          src={current.src}
          alt={resolved?.name ?? fallbackLabel}
          className={cn('size-full', current.fit === 'cover' ? 'object-cover' : 'object-contain p-1.5')}
          onError={() => setFailed({ key, count: tried + 1 })}
        />
      ) : (
        fallback ?? <span aria-hidden="true">{monogram(resolved?.short ?? fallbackLabel)}</span>
      )}
    </span>
  )
}
