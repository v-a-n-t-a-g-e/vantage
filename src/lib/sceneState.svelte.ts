import type { Object3D } from 'three'
import type { VantageProjection } from 'vantage-renderer'

export type TransformMode = 'translate' | 'rotate' | 'scale'

export type SceneObjectSource =
  | { kind: 'primitive'; geometryType: string }
  | { kind: 'imported'; relativePath: string; originalBlob?: Blob }

export type SceneObject = {
  id: string
  name: string
  object: Object3D
  visible: boolean
  source: SceneObjectSource
}

export type ProjectionItem = {
  id: string
  name: string
  projection: VantageProjection
  visible: boolean
  imageBlob?: Blob
  imagePath: string
}

export type SceneActions = {
  addObject: (_name: string, _obj: Object3D, _source: SceneObjectSource) => void
  removeObject: (_item: SceneObject) => void
  focusObject: (_item: SceneObject) => void
  clearScene: () => void
  addObjectSilent: (_name: string, _obj: Object3D, _source: SceneObjectSource) => SceneObject
  addProjection: (_name: string, _projection: VantageProjection, _imageBlob: Blob, _imagePath: string) => void
  removeProjection: (_item: ProjectionItem) => void
  addProjectionSilent: (_name: string, _projection: VantageProjection, _imagePath: string) => ProjectionItem
  focusProjection: (_item: ProjectionItem) => void
  enterAimMode: () => void
  exitAimMode: () => void
}

type SceneState = {
  objects: SceneObject[]
  projections: ProjectionItem[]
  selected: SceneObject | null
  selectedProjection: ProjectionItem | null
  hovered: SceneObject | null
  transformMode: TransformMode
  transformRevision: number
  aimMode: boolean
}

export const sceneState: SceneState = $state({
  objects: [],
  projections: [],
  selected: null,
  selectedProjection: null,
  hovered: null,
  transformMode: 'translate',
  transformRevision: 0,
  aimMode: false,
})

let _sceneActions: SceneActions | null = $state(null)

export const sceneActions = {
  get value() {
    return _sceneActions
  },
}

export function setSceneActions(actions: SceneActions | null) {
  _sceneActions = actions
}
