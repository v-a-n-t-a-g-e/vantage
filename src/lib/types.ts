import type { Object3D } from 'three'
import type { VantageProjection } from './scene/projection'

export type TransformTool = 'translate' | 'rotate' | 'scale'
export type Tool = 'cursor' | TransformTool | 'aim'
export const TRANSFORM_TOOLS: TransformTool[] = ['translate', 'rotate', 'scale']

export type SceneObjectSource =
  | { kind: 'primitive'; geometryType: string }
  | { kind: 'imported'; relativePath: string; originalBlob?: Blob }

export type SceneObject = {
  kind: 'object'
  id: string
  name: string
  object: Object3D
  visible: boolean
  locked: boolean
  source: SceneObjectSource
}

export type ProjectionItem = {
  kind: 'projection'
  id: string
  name: string
  projection: VantageProjection
  visible: boolean
  locked: boolean
  imageBlob?: Blob
  imagePath: string
}

export type SceneActions = {
  addObject: (_name: string, _obj: Object3D, _source: SceneObjectSource) => void
  removeObject: (_item: SceneObject) => void
  focusObject: (_item: SceneObject) => void
  clearScene: () => void
  addObjectSilent: (_name: string, _obj: Object3D, _source: SceneObjectSource) => SceneObject
  addProjection: (
    _name: string,
    _projection: VantageProjection,
    _imageBlob: Blob,
    _imagePath: string
  ) => void
  removeProjection: (_item: ProjectionItem) => void
  addProjectionSilent: (
    _name: string,
    _projection: VantageProjection,
    _imagePath: string
  ) => ProjectionItem
  focusProjection: (_item: ProjectionItem) => void
  enterAimMode: () => void
  exitAimMode: () => void
}

// Re-export project types for convenience
export type { SceneManifest, SceneObjectEntry, ProjectionEntry, CameraState } from './project/types'
