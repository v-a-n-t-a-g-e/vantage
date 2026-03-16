export interface SceneManifest {
  version: 1
  objects: SceneObjectEntry[]
  camera?: CameraState
  projections?: ProjectionEntry[]
}

export interface SceneObjectEntry {
  id: string
  name: string
  type: 'mesh' | 'pointcloud' | 'splat' | 'group'
  source: { kind: 'primitive'; geometryType: string } | { kind: 'imported'; path: string }
  transform: {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  }
  visible: boolean
  metadata?: Record<string, unknown>
}

export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

export interface ProjectionEntry {
  id: string
  name: string
  imagePath: string
  transform: {
    position: [number, number, number]
    rotation: [number, number, number]
  }
  fov: number
  near: number
  far: number
  visible: boolean
}
