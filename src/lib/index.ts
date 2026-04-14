// Scene viewer
export { SceneViewer } from './scene/SceneViewer'
export type { SceneViewOptions } from './scene/SceneViewer'

// Projection system
export { VantageProjection } from './scene/projection/VantageProjection'
export { default as ProjectionMaterial } from './scene/projection/ProjectionMaterial'
export { ProjectionHelper } from './scene/projection/ProjectionHelper'
export { loadTexture } from './scene/projection/loadTexture'

// Scene utilities
export { UI_LAYER } from './scene/layers'
export { themeColors, themeColorDefaults } from './scene/themeColors'

// Serialization
export { serializeScene, deserializeScene, deserializeProjections } from './project/serializer'

// Types
export * from './types'
export * from './project/types'
