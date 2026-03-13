import type { Object3D } from 'three'

export type TransformMode = 'translate' | 'rotate' | 'scale'

export type SceneObject = {
  name: string
  object: Object3D
  visible: boolean
}

export type SceneActions = {
  addObject: (_name: string, _obj: Object3D) => void
  removeObject: (_item: SceneObject) => void
  focusObject: (_item: SceneObject) => void
}

type SceneState = {
  objects: SceneObject[]
  selected: SceneObject | null
  hovered: SceneObject | null
  transformMode: TransformMode
  transformRevision: number
}

export const sceneState: SceneState = $state({
  objects: [],
  selected: null,
  hovered: null,
  transformMode: 'translate',
  transformRevision: 0,
})

let _sceneActions: SceneActions | null = $state(null)

export const sceneActions = {
  get value() { return _sceneActions },
}

export function setSceneActions(actions: SceneActions | null) {
  _sceneActions = actions
}
