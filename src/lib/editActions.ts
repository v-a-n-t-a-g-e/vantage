import { sceneState } from './sceneState.svelte.ts'

export function toggleSelectedVisibility() {
  const sel = sceneState.selected
  if (!sel) return
  if (sel.kind === 'object') {
    sel.object.visible = !sel.object.visible
    sel.visible = sel.object.visible
  } else {
    sel.visible = !sel.visible
    for (const obj of sceneState.objects) {
      if (sel.visible) sel.projection.project(obj.object)
      else sel.projection.unproject(obj.object)
    }
  }
}

export function toggleSelectedLock() {
  const sel = sceneState.selected
  if (!sel) return
  sel.locked = !sel.locked
}
