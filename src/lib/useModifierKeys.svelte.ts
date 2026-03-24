/**
 * Reactive modifier key state, shared across all components.
 * Tracks Alt, Shift, Ctrl/Meta keys globally.
 */
const modifierKeys = $state({
  alt: false,
  shift: false,
  ctrl: false,
  meta: false,
})

let refCount = 0
let ac: AbortController | null = null

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Alt') modifierKeys.alt = true
  if (e.key === 'Shift') modifierKeys.shift = true
  if (e.key === 'Control') modifierKeys.ctrl = true
  if (e.key === 'Meta') modifierKeys.meta = true
}

function onKeyUp(e: KeyboardEvent) {
  if (e.key === 'Alt') modifierKeys.alt = false
  if (e.key === 'Shift') modifierKeys.shift = false
  if (e.key === 'Control') modifierKeys.ctrl = false
  if (e.key === 'Meta') modifierKeys.meta = false
}

function onBlur() {
  // Reset all when window loses focus (keys may have been released while away)
  modifierKeys.alt = false
  modifierKeys.shift = false
  modifierKeys.ctrl = false
  modifierKeys.meta = false
}

/**
 * Subscribe to modifier key state. Call the returned cleanup function
 * when done (e.g. in onDestroy or $effect cleanup). Listeners are
 * reference-counted so only one set of global listeners exists.
 */
export function useModifierKeys(): { keys: typeof modifierKeys; cleanup: () => void } {
  if (refCount === 0) {
    ac = new AbortController()
    const opts = { signal: ac.signal }
    window.addEventListener('keydown', onKeyDown, opts)
    window.addEventListener('keyup', onKeyUp, opts)
    window.addEventListener('blur', onBlur, opts)
  }
  refCount++

  return {
    keys: modifierKeys,
    cleanup() {
      refCount--
      if (refCount === 0 && ac) {
        ac.abort()
        ac = null
        onBlur() // reset state
      }
    },
  }
}
