import { pushCommand } from '@/lib/history.svelte.ts'

/**
 * Create an undoable toggle for a boolean property.
 * Returns a function that toggles the value and pushes an undo command.
 */
export function undoableToggle<T extends Record<string, boolean>>(
  target: T,
  key: keyof T & string
): () => void {
  return () => {
    const was = target[key]
    target[key] = !was as T[typeof key]
    const now = target[key]
    pushCommand({
      undo: () => { target[key] = was },
      redo: () => { target[key] = now },
    })
  }
}

/**
 * Create an undoable setter for a property.
 * Returns { start, apply, commit } for drag-style interactions:
 *   - start(): captures the current value
 *   - apply(v): sets the value (no undo entry yet)
 *   - commit(v): pushes an undo command if value changed
 */
export function undoableDrag<T>(
  getter: () => T,
  setter: (v: T) => void
): {
  start: () => void
  apply: (v: T) => void
  commit: (v: T) => void
} {
  let startValue: T

  return {
    start() {
      startValue = getter()
    },
    apply(v: T) {
      setter(v)
    },
    commit(v: T) {
      const before = startValue
      const after = v
      if (before === after) return
      setter(after)
      pushCommand({
        undo: () => setter(before),
        redo: () => setter(after),
      })
    },
  }
}
