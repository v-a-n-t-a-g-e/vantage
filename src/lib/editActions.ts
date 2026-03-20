import { sceneState } from './sceneState.svelte.ts'
import type { SceneObject, ProjectionItem } from './sceneState.svelte.ts'
import { pushCommand } from './history.svelte.ts'

function applyVisibility(item: SceneObject | ProjectionItem, visible: boolean) {
  if (item.kind === 'object') {
    item.object.visible = visible
    item.visible = visible
  } else {
    item.visible = visible
    for (const obj of sceneState.objects) {
      if (visible) item.projection.project(obj.object)
      else item.projection.unproject(obj.object)
    }
  }
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
  item.locked = !item.locked
  const now = item.locked
  pushCommand({
    undo: () => { item.locked = !now },
    redo: () => { item.locked = now },
  })
}

export function toggleSelectedLock() {
  if (sceneState.selected) toggleLock(sceneState.selected)
}

export function renameSelected() {
  const sel = sceneState.selected
  if (!sel) return
  sceneState.renaming = sel
}
