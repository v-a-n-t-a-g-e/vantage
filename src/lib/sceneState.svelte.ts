export {
  TRANSFORM_TOOLS,
  type TransformTool,
  type Tool,
  type SceneObjectSource,
  type SceneObject,
  type ProjectionItem,
  type SceneActions,
} from '@/lib/types.ts'

import type { SceneObject, ProjectionItem, Tool, SceneActions } from '@/lib/types.ts'

type SceneState = {
  objects: SceneObject[]
  projections: ProjectionItem[]
  selected: SceneObject | ProjectionItem | null
  hovered: SceneObject | null
  renaming: SceneObject | ProjectionItem | null
  tool: Tool
  transformRevision: number
  showGrid: boolean
  clearColor: string
}

export const SCENE_DEFAULTS = {
  showGrid: true,
  clearColor: '#f3e7fd',
} as const

export const sceneState: SceneState = $state({
  objects: [],
  projections: [],
  selected: null,
  hovered: null,
  renaming: null,
  tool: 'cursor',
  transformRevision: 0,
  showGrid: SCENE_DEFAULTS.showGrid,
  clearColor: SCENE_DEFAULTS.clearColor,
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
