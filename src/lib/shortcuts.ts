type Shortcut = {
  key: string
  meta?: boolean // Cmd (mac) / Ctrl (win)
  shift?: boolean
  alt?: boolean
  action: () => void
}

/**
 * Register global keyboard shortcuts. Returns a cleanup function.
 * Shortcuts are skipped when focus is inside a text input or textarea
 * to avoid conflicts with editing.
 */
export function registerShortcuts(shortcuts: Shortcut[]): () => void {
  function handler(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return

    for (const s of shortcuts) {
      if (s.key.toLowerCase() !== e.key.toLowerCase()) continue
      if (!!s.meta !== (e.metaKey || e.ctrlKey)) continue
      if (!!s.shift !== e.shiftKey) continue
      if (!!s.alt !== e.altKey) continue
      e.preventDefault()
      s.action()
      return
    }
  }

  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}
