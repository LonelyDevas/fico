import { flushSync } from 'react-dom'

/** Turn any CSS colour (including oklch) into plain rgb(), which every browser accepts for theme-color. */
function toRgb(css: string, fallback: string): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (!ctx) return fallback
    ctx.fillStyle = '#000'
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  } catch {
    return fallback
  }
}

/** Paint the phone's status bar / browser chrome in the page's own background colour. */
function syncThemeColor(dark: boolean) {
  const background = getComputedStyle(document.body).backgroundColor
  const color = toRgb(background, dark ? '#0b1220' : '#f1f4f9')
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  if (metas.length === 0) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = color
    document.head.appendChild(meta)
    return
  }
  metas.forEach((meta) => {
    meta.content = color
  })
}

/** Put the `dark` class (and the matching native colour scheme) on the page. Safe to call repeatedly. */
export function applyThemeToDom(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  document.body.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  syncThemeColor(dark)
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
}

/**
 * Switch between light and dark as ONE step.
 *
 * The old way gave every element its own 300ms colour fade. Ionic paints the page background
 * from its own variables, which don't fade with the rest, so the page jumped to its new colour
 * while the cards and bars were still fading: dark cards on a white page, headings
 * unreadable for a moment. Here the browser snapshots the old screen and the new one and
 * cross-fades the two pictures, so every part changes together. Where that isn't supported
 * (or the user prefers reduced motion) everything flips in a single frame with transitions off.
 *
 * `commit` updates the stored preference; it runs inside the switch so the screen it
 * produces (icons, labels) is part of the new picture.
 */
export function runThemeSwitch(dark: boolean, commit: () => void) {
  if (typeof document === 'undefined') {
    commit()
    return
  }

  const apply = () => {
    flushSync(commit)
    applyThemeToDom(dark)
  }

  const doc = document as ViewTransitionDocument
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (doc.startViewTransition && !reduceMotion) {
    doc.startViewTransition(apply)
    return
  }

  const root = document.documentElement
  root.classList.add('theme-instant')
  apply()
  // Two frames: long enough for the new colours to paint without animating from the old ones.
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-instant')))
}
