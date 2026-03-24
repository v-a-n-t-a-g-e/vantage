import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/project/projectState.svelte.ts', () => ({
  projectState: { dirty: false },
}))

import { clearHistory, undo, redo } from '@/lib/history.svelte.ts'
import { undoableToggle, undoableDrag } from '@/lib/undoable.ts'

describe('undoable', () => {
  beforeEach(() => {
    clearHistory()
  })

  describe('undoableToggle', () => {
    it('toggles a boolean property', () => {
      const obj = { locked: false }
      const toggle = undoableToggle(obj, 'locked')

      toggle()
      expect(obj.locked).toBe(true)

      toggle()
      expect(obj.locked).toBe(false)
    })

    it('supports undo/redo', () => {
      const obj = { locked: false }
      const toggle = undoableToggle(obj, 'locked')

      toggle()
      expect(obj.locked).toBe(true)

      undo()
      expect(obj.locked).toBe(false)

      redo()
      expect(obj.locked).toBe(true)
    })
  })

  describe('undoableDrag', () => {
    it('captures start value and commits with undo', () => {
      let value = 10
      const drag = undoableDrag(
        () => value,
        (v) => {
          value = v
        }
      )

      drag.start()
      drag.apply(20)
      expect(value).toBe(20)

      drag.commit(20)

      undo()
      expect(value).toBe(10)

      redo()
      expect(value).toBe(20)
    })

    it('does not push command if value unchanged', () => {
      let value = 10
      const drag = undoableDrag(
        () => value,
        (v) => {
          value = v
        }
      )

      drag.start()
      drag.commit(10) // same as start

      // Undo should be a no-op (no command was pushed)
      undo()
      expect(value).toBe(10)
    })
  })
})
