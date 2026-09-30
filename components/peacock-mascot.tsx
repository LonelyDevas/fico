import { useId, type ReactNode } from 'react'

type Pose = 'empty' | 'advisor' | 'plain'

interface PeacockMascotProps {
  pose?: Pose
  className?: string
  label?: string
  viewBox?: string
}

const FAN = [
  [86, 58],
  [116, 50],
  [146, 58],
  [168, 80],
  [176, 110],
  [168, 140],
  [146, 162],
] as const

const BACK_FAN = [
  [83, 53],
  [116, 44],
  [149, 53],
  [173, 77],
  [182, 110],
  [173, 143],
  [149, 167],
] as const

/**
 * The fico peacock. Animation comes from the `pk-*` classes in globals.css and is
 * switched off for users who prefer reduced motion.
 */
export function PeacockMascot({
  pose = 'empty',
  className = 'w-36 h-36',
  label = 'Fico peacock',
  viewBox = '16 16 194 194',
}: PeacockMascotProps) {
  const clipId = useId()

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={label} aria-hidden={label === '' ? true : undefined}>
      <defs>
        <clipPath id={clipId}>
          <ellipse cx="78" cy="146" rx="52" ry="56" />
        </clipPath>
      </defs>
      <g className="pk-bob">
        <g className={pose === 'empty' ? 'pk-droop' : 'pk-tail'}>
          <g fill="#00B8AD" opacity=".85">
            <circle cx="116" cy="110" r="66" />
            {BACK_FAN.map(([x, y]) => (
              <circle key={`b${x}${y}`} cx={x} cy={y} r="15" />
            ))}
          </g>
          <g fill="#00D9CC">
            <circle cx="116" cy="110" r="60" />
            {FAN.map(([x, y]) => (
              <circle key={`f${x}${y}`} cx={x} cy={y} r="14" />
            ))}
          </g>
          <g stroke="#00B8AD" strokeWidth="1.2" opacity=".55" strokeLinecap="round">
            {FAN.map(([x, y]) => (
              <path key={`s${x}${y}`} d={`M116 110L${x} ${y}`} />
            ))}
          </g>
          {FAN.map(([x, y]) => (
            <g key={`e${x}${y}`}>
              <circle cx={x} cy={y} r="8.5" fill="#0066CC" />
              <circle cx={x} cy={y} r="5" fill="#00D9CC" />
              <circle cx={x} cy={y} r="2.2" fill="#2ECC71" />
            </g>
          ))}
        </g>

        <ellipse cx="78" cy="146" rx="52" ry="56" fill="#0066CC" />
        <path d="M58 112C58 100 62 96 62 92L98 92C98 96 102 100 102 112Z" fill="#0066CC" />
        <circle cx="80" cy="84" r="36" fill="#0066CC" />
        <path d="M52 76C54 62 64 52 78 50" fill="none" stroke="#3388DD" strokeWidth="5" strokeLinecap="round" opacity=".45" />
        <ellipse cx="80" cy="178" rx="30" ry="34" fill="#00D9CC" opacity=".9" clipPath={`url(#${clipId})`} />
        <g stroke="#0066CC" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M80 50C80 44 80 38 80 32" />
          <path d="M68 53C65 46 62 40 59 34" />
          <path d="M92 53C95 46 98 40 101 34" />
        </g>
        <g fill="#00D9CC">
          <circle cx="80" cy="28" r="6.5" />
          <circle cx="57" cy="30" r="6" />
          <circle cx="103" cy="30" r="6" />
        </g>
        <g fill="#0066CC">
          <circle cx="80" cy="28" r="2.6" />
          <circle cx="57" cy="30" r="2.4" />
          <circle cx="103" cy="30" r="2.4" />
        </g>
        <path d="M75 92h10l-5 8z" fill="#E8A33D" stroke="#E8A33D" strokeWidth="6" strokeLinejoin="round" />
        <g className="pk-eyes">
          <circle cx="66" cy="83" r="5.4" fill="#0F1419" />
          <circle cx="94" cy="83" r="5.4" fill="#0F1419" />
          <circle cx="67.8" cy="81" r="1.7" fill="#fff" />
          <circle cx="95.8" cy="81" r="1.7" fill="#fff" />
        </g>

        {pose === 'advisor' && (
          <>
            <g className="pk-nudge" fill="none" stroke="#F1F5F9" strokeWidth="1.5">
              <circle cx="66" cy="82" r="10" />
              <circle cx="94" cy="82" r="10" />
              <path d="M76 82h8" />
            </g>
            <path d="M65 120L80 128L65 136Z M95 120L80 128L95 136Z" fill="#0F1419" />
            <circle cx="80" cy="128" r="3.6" fill="#0066CC" />
          </>
        )}
      </g>

      {pose === 'empty' && (
        <>
          <rect x="142" y="150" width="48" height="36" rx="10" fill="#0B4F9E" stroke="#3388DD" strokeWidth="1.5" />
          <rect x="168" y="160" width="22" height="14" rx="7" fill="#F1F5F9" />
          <circle cx="177" cy="167" r="2.6" fill="#0B4F9E" />
          <circle className="pk-spin" cx="166" cy="130" r="10" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeDasharray="4 4" />
        </>
      )}
    </svg>
  )
}

/** Round head-and-crest crop for small spots: chat avatars, the assistant launcher. Still, no animation. */
export function PeacockAvatar({ className = 'w-8 h-8', label = '' }: { className?: string; label?: string }) {
  return (
    <span className={`inline-block shrink-0 overflow-hidden rounded-full bg-[#F1F5F9] [&_*]:animate-none ${className}`}>
      <PeacockMascot pose="plain" className="w-full h-full" viewBox="26 14 108 108" label={label} />
    </span>
  )
}

interface EmptyStateProps {
  pose?: Pose
  title: string
  description?: string
  compact?: boolean
  children?: ReactNode
}

export function EmptyState({ pose = 'empty', title, description, compact = false, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <PeacockMascot pose={pose} className={compact ? 'w-24 h-24' : 'w-36 h-36'} label="" />
      <p className="mt-2 font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-xs">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
