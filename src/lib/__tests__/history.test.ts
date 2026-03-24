import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock projectState before importing history
vi.mock('@/lib/project/projectState.svelte.ts', () => ({
  projectState: { dirty: false },
}))

import { pushCommand, undo, redo, clearHistory } from '@/lib/history.svelte.ts'

describe('history', () => {
  beforeEach(() => {
    clearHistory()
  })

  it('pushCommand + undo reverses the action', () => {
    let value = 0
    pushCommand({
      undo: () => (value = 0),
      redo: () => (value = 1),
    })
    value = 1

    undo()
    expect(value).toBe(0)
  })

  it('redo re-applies the undone action', () => {
    let value = 0
    pushCommand({
      undo: () => (value = 0),
      redo: () => (value = 1),
    })
    value = 1

    undo()
    expect(value).toBe(0)

    redo()
    expect(value).toBe(1)
  })

  it('undo with no history is a no-op', () => {
    // Should not throw
    undo()
  })

  it('redo with no future is a no-op', () => {
    redo()
  })

  it('pushing a new command clears the redo stack', () => {
    let value = 0
    pushCommand({
      undo: () => (value = 0),
      redo: () => (value = 1),
    })
    value = 1

    undo()
    expect(value).toBe(0)

    // Push a new command — this should clear the redo stack
    pushCommand({
      undo: () => (value = 0),
      redo: () => (value = 2),
    })
    value = 2

    // Redo should now be empty (the old redo was cleared)
    redo()
    expect(value).toBe(2) // unchanged — no redo available
  })

  it('supports multiple undo/redo steps', () => {
    const values: number[] = []
    let current = 0

    for (let i = 1; i <= 5; i++) {
      const before = current
      pushCommand({
        undo: () => (current = before),
        redo: () => (current = i),
      })
      current = i
      values.push(current)
    }

    expect(current).toBe(5)

    undo()
    expect(current).toBe(4)
    undo()
    expect(current).toBe(3)

    redo()
    expect(current).toBe(4)
  })

  it('caps history at 100 commands', () => {
    const undoCalls: number[] = []

    for (let i = 0; i < 110; i++) {
      pushCommand({
        undo: () => undoCalls.push(i),
        redo: () => {},
      })
    }

    // Undo all — should only be able to undo 100 times
    let undoCount = 0
    for (let i = 0; i < 120; i++) {
      const before = undoCalls.length
      undo()
      if (undoCalls.length > before) undoCount++
    }

    expect(undoCount).toBe(100)
  })

  it('clearHistory removes all undo/redo state', () => {
    let value = 0
    pushCommand({
      undo: () => (value = 0),
      redo: () => (value = 1),
    })
    value = 1

    clearHistory()

    undo()
    expect(value).toBe(1) // unchanged — history was cleared
  })
})
