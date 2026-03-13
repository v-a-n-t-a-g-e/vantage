import type { Object3D } from 'three'

export type TransformMode = 'translate' | 'rotate' | 'scale'

export type SceneObject = {
  name: string
  object: Object3D
  visible: boolean
}

type SceneState = {
  objects: SceneObject[]
  selected: SceneObject | null
  transformMode: TransformMode
  transformRevision: number
}

export const sceneState: SceneState = $state({
  objects: [],
  selected: null,
  transformMode: 'translate',
  transformRevision: 0,
})
