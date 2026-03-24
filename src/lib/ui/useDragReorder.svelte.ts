import { pushCommand } from '@/lib/history.svelte.ts'
import { sceneState } from '@/lib/sceneState.svelte.ts'
import type { SceneObject, ProjectionItem } from '@/lib/types.ts'

type ListKind = 'projections' | 'objects'
type DropPosition = 'above' | 'below'

const dragState = $state({
  list: null as ListKind | null,
  dragIndex: null as number | null,
  dropIndex: null as number | null,
  dropPosition: null as DropPosition | null,
})

function reset() {
  dragState.list = null
  dragState.dragIndex = null
  dragState.dropIndex = null
  dragState.dropPosition = null
}

function reprojectAll() {
  for (const p of sceneState.projections) {
    if (p.visible) {
      for (const obj of sceneState.objects) {
        p.projection.unproject(obj.object)
      }
    }
  }
  for (const p of sceneState.projections) {
    if (p.visible) {
      for (const obj of sceneState.objects) {
        p.projection.project(obj.object)
      }
    }
  }
}

function moveItem(list: ListKind, item: SceneObject | ProjectionItem, toIndex: number) {
  const arr: (SceneObject | ProjectionItem)[] =
    list === 'projections' ? sceneState.projections : sceneState.objects
  const from = arr.indexOf(item)
  if (from === -1 || from === toIndex) return
  arr.splice(from, 1)
  arr.splice(toIndex, 0, item)
  if (list === 'projections') reprojectAll()
}

function reorder(list: ListKind, fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex + 1 === toIndex) return

  const arr: (SceneObject | ProjectionItem)[] =
    list === 'projections' ? sceneState.projections : sceneState.objects
  const item = arr[fromIndex]
  const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex
  arr.splice(fromIndex, 1)
  arr.splice(insertAt, 0, item)

  if (list === 'projections') reprojectAll()

  const undoIndex = fromIndex
  pushCommand({
    undo: () => moveItem(list, item, undoIndex),
    redo: () => moveItem(list, item, insertAt),
  })
}

export function useDragReorder() {
  return {
    get state() {
      return dragState
    },

    handleDragStart(list: ListKind, index: number, e: DragEvent) {
      dragState.list = list
      dragState.dragIndex = index
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    },

    handleDragOver(list: ListKind, index: number, e: DragEvent) {
      if (dragState.list !== list || dragState.dragIndex === null) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      dragState.dropIndex = index
      dragState.dropPosition = e.clientY < midY ? 'above' : 'below'
    },

    handleDrop(list: ListKind, _index: number, e: DragEvent) {
      e.preventDefault()
      if (
        dragState.list !== list ||
        dragState.dragIndex === null ||
        dragState.dropIndex === null ||
        dragState.dropPosition === null
      )
        return

      // Column-reverse: visual above = after in array, visual below = before in array
      const targetIndex =
        dragState.dropPosition === 'above' ? dragState.dropIndex + 1 : dragState.dropIndex
      reorder(list, dragState.dragIndex, targetIndex)
      reset()
    },

    handleDragEnd() {
      reset()
    },

    getDropPosition(list: ListKind, index: number): DropPosition | null {
      if (dragState.list !== list || dragState.dropIndex !== index || dragState.dragIndex === null)
        return null
      // Column-reverse: above = after in array, below = before in array
      if (
        dragState.dropPosition === 'above' &&
        (index === dragState.dragIndex || index === dragState.dragIndex - 1)
      )
        return null
      if (
        dragState.dropPosition === 'below' &&
        (index === dragState.dragIndex || index === dragState.dragIndex + 1)
      )
        return null
      return dragState.dropPosition
    },
  }
}
