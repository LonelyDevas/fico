'use client'

/**
 * iPhone Home Screen apps report a layout height (innerHeight) that is shorter than the real
 * screen (measured: 793 of 852), so anything sized to the viewport ends ~59pt above the bottom.
 * The screen itself still paints there, so size the app to the real screen height instead.
 * Sets `data-app-h` on <html> and the --app-h variable; globals.css reads both.
 *
 * iOS also reports the full height for a moment after the app is resumed and only then shrinks
 * it, without a resize event. So in the Home Screen app the override stays on permanently, and
 * is re-applied a few times after every resume.
 */
export function installViewportFix(): () => void {
  const stopKeyboardVars = installVisualViewportVars()
  const stopHeight = installAppHeight()
  return () => {
    stopKeyboardVars()
    stopHeight()
  }
}

/**
 * Bottom sheets need to sit on the part of the screen you can actually see. With the keyboard
 * open that is the visual viewport. Publishes, only while a keyboard is open:
 *   --vv-inset: how far to lift a bottom-anchored fixed element (the keyboard height),
 *   --vv-max:   the tallest a sheet may be.
 * vaul's own keyboard handling measures window.innerHeight, which is wrong in the Home Screen
 * app, so sheets turn that off and use these instead (see globals.css).
 *
 * The Home Screen app reports a visual viewport that is ~59pt shorter than the screen even with
 * no keyboard. So the keyboard height is measured against a baseline taken while nothing is being
 * typed into, never against the raw screen height; otherwise every sheet would float 59pt high.
 */
function installVisualViewportVars(): () => void {
  const root = document.documentElement
  const vv = window.visualViewport
  if (!vv) return () => {}

  let baseline = vv.height
  const isEditing = () => {
    const el = document.activeElement as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
  }
  const clear = () => {
    root.style.removeProperty('--vv-inset')
    root.style.removeProperty('--vv-max')
  }
  const update = () => {
    const keyboardOpen = isEditing() && vv.height < baseline - 120
    if (!keyboardOpen) {
      if (!isEditing()) baseline = vv.height
      clear()
      return
    }
    root.style.setProperty('--vv-inset', `${Math.max(0, Math.round(baseline - (vv.height + vv.offsetTop)))}px`)
    root.style.setProperty('--vv-max', `${Math.round(vv.height - 8)}px`)
  }
  const afterBlur = () => window.setTimeout(update, 60)

  update()
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)
  document.addEventListener('focusin', update)
  document.addEventListener('focusout', afterBlur)
  return () => {
    vv.removeEventListener('resize', update)
    vv.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
    window.removeEventListener('orientationchange', update)
    document.removeEventListener('focusin', update)
    document.removeEventListener('focusout', afterBlur)
    clear()
  }
}

function installAppHeight(): () => void {
  const root = document.documentElement
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches

  if (!standalone) {
    root.removeAttribute('data-app-h')
    root.style.removeProperty('--app-h')
    return () => {}
  }

  const apply = () => {
    // iOS reports screen.width/height in portrait terms even when rotated.
    const portrait = window.innerHeight >= window.innerWidth
    const long = Math.max(screen.width, screen.height)
    const short = Math.min(screen.width, screen.height)
    const screenHeight = portrait ? long : short
    root.style.setProperty('--app-h', `${Math.max(screenHeight, window.innerHeight)}px`)
    root.setAttribute('data-app-h', '')
  }

  let timers: number[] = []
  const applyAfterResume = () => {
    timers.forEach(clearTimeout)
    apply()
    timers = [100, 300, 800, 1500].map((ms) => window.setTimeout(apply, ms))
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') applyAfterResume()
  }

  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', applyAfterResume)
  window.addEventListener('pageshow', applyAfterResume)
  window.addEventListener('focus', applyAfterResume)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    timers.forEach(clearTimeout)
    window.removeEventListener('resize', apply)
    window.removeEventListener('orientationchange', applyAfterResume)
    window.removeEventListener('pageshow', applyAfterResume)
    window.removeEventListener('focus', applyAfterResume)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
