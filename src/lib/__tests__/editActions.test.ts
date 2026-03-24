import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock projectState and sceneState
vi.mock('@/lib/project/projectState.svelte.ts', () => ({
  projectState: { dirty: false },
}))

vi.mock('@/lib/sceneState.svelte.ts', () => {
  const state = {
    objects: [] as any[],
    projections: [] as any[],
    selected: null as any,
    renaming: null as any,
  }
  return {
    sceneState: state,
  }
})

import { clearHistory } from '@/lib/history.svelte.ts'
import { undo, redo } from '@/lib/history.svelte.ts'
import { sceneState } from '@/lib/sceneState.svelte.ts'

// We need to import after mocks are set up
import { toggleLock, toggleVisibility, renameSelected } from '@/lib/editActions.ts'

describe('editActions', () => {
  beforeEach(() => {
    clearHistory()
    sceneState.selected = null
    sceneState.renaming = null
    sceneState.objects = []
  })

  describe('toggleLock', () => {
    it('toggles locked state from false to true', () => {
      const item = { kind: 'object' as const, locked: false } as any
      toggleLock(item)
      expect(item.locked).toBe(true)
    })

    it('toggles locked state from true to false', () => {
      const item = { kind: 'object' as const, locked: true } as any
      toggleLock(item)
      expect(item.locked).toBe(false)
    })

    it('supports undo/redo', () => {
      const item = { kind: 'object' as const, locked: false } as any
      toggleLock(item)
      expect(item.locked).toBe(true)

      undo()
      expect(item.locked).toBe(false)

      redo()
      expect(item.locked).toBe(true)
    })
  })

  describe('toggleVisibility', () => {
    it('toggles object visibility', () => {
      const item = {
        kind: 'object' as const,
        visible: true,
        object: { visible: true },
      } as any
      toggleVisibility(item)
      expect(item.visible).toBe(false)
      expect(item.object.visible).toBe(false)
    })

    it('supports undo/redo for objects', () => {
      const item = {
        kind: 'object' as const,
        visible: true,
        object: { visible: true },
      } as any
      toggleVisibility(item)
      expect(item.visible).toBe(false)

      undo()
      expect(item.visible).toBe(true)
      expect(item.object.visible).toBe(true)

      redo()
      expect(item.visible).toBe(false)
    })

    it('toggles projection visibility and calls project/unproject', () => {
      const mockObj = { object: {} }
      sceneState.objects = [mockObj] as any

      const projection = {
        project: vi.fn(),
        unproject: vi.fn(),
      }
      const item = {
        kind: 'projection' as const,
        visible: true,
        projection,
      } as any

      toggleVisibility(item)
      expect(item.visible).toBe(false)
      expect(projection.unproject).toHaveBeenCalledWith(mockObj.object)
    })
  })

  describe('renameSelected', () => {
    it('sets renaming to the selected item', () => {
      const item = { kind: 'object' as const, name: 'Box' } as any
      sceneState.selected = item
      renameSelected()
      expect(sceneState.renaming).toBe(item)
    })

    it('does nothing when nothing is selected', () => {
      sceneState.selected = null
      renameSelected()
      expect(sceneState.renaming).toBeNull()
    })
  })
})
