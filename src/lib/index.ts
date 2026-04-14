// Scene viewer
export { SceneViewer } from './scene/SceneViewer'
export type { SceneViewOptions } from './scene/SceneViewer'

// Scene building blocks
export { CameraRig } from './scene/CameraRig'
export { DefaultEnvironment } from './scene/DefaultEnvironment'
export { CAMERA_DEFAULTS } from './constants'

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

// Project filesystem
export { type ProjectFS, createProjectFS, supportsNativeFS } from './project/fileSystem'
export {
  createMemoryFS,
  type MemoryFS,
  exportAsZip,
  downloadBlob,
  loadZip,
} from './project/memoryFS'
export { validateManifest, ManifestValidationError } from './project/validateManifest'

// Project helpers
export {
  type ProjectHandle,
  openProject,
  importProject,
  onProjectDrop,
  saveProject,
  exportProject,
} from './project/projectHandle'

// Loaders
export { loadGLTF } from './gltfLoader'

// Types
export * from './types'
export * from './project/types'
