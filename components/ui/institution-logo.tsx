'use client'

import { useState } from 'react'
import { getInstitution, institutionLogoSrc, type Institution } from '@/lib/ph-institutions'
import { cn } from '@/lib/utils'

interface InstitutionLogoProps {
  /** Catalog id, or a full institution. */
  institution?: string | Institution | null
  /** Used for the monogram when there is no institution. */
  fallbackLabel?: string
  fallbackColor?: string
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
 * Institution logo from public/banks/<id>.svg, falling back to a brand-colored
 * monogram when the file is missing (or no institution is set).
 */
export function InstitutionLogo({ institution, fallbackLabel = '', fallbackColor = '#0066CC', className, variant = 'solid' }: InstitutionLogoProps) {
  const resolved = typeof institution === 'string' ? getInstitution(institution) : institution ?? undefined
  const [failedId, setFailedId] = useState<string | null>(null)
  const showImage = !!resolved && failedId !== resolved.id

  return (
    <span
      className={cn('relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white', className)}
      style={{ backgroundColor: showImage ? '#FFFFFF' : variant === 'glass' ? 'rgba(255,255,255,0.22)' : resolved?.color ?? fallbackColor }}
    >
      {showImage && resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={institutionLogoSrc(resolved)}
          alt={resolved.name}
          className="size-full object-contain p-1"
          onError={() => setFailedId(resolved.id)}
        />
      ) : (
        <span aria-hidden="true">{monogram(resolved?.short ?? fallbackLabel)}</span>
      )}
    </span>
  )
}
