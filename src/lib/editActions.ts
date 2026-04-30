import { sceneState } from './sceneState.svelte.ts'
import type { SceneObject, ProjectionItem } from './types.ts'
import { pushCommand } from './history.svelte.ts'
import { undoableToggle } from './undoable.ts'

function applyVisibility(item: SceneObject | ProjectionItem, visible: boolean) {
  item.visible = visible
  if (item.kind === 'object') item.object.visible = visible
  else item.projection.visible = visible
}

export function toggleVisibility(item: SceneObject | ProjectionItem) {
  const was = item.visible
  applyVisibility(item, !was)
  pushCommand({
    undo: () => applyVisibility(item, was),
    redo: () => applyVisibility(item, !was),
  })
}

export function toggleSelectedVisibility() {
  if (sceneState.selected) toggleVisibility(sceneState.selected)
}

export function toggleLock(item: SceneObject | ProjectionItem) {
  undoableToggle(item, 'locked')()
}

export function toggleSelectedLock() {
  if (sceneState.selected) toggleLock(sceneState.selected)
}

export function renameSelected() {
  const sel = sceneState.selected
  if (!sel) return
  sceneState.renaming = sel
}
