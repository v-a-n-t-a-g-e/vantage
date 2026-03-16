export interface SceneManifest {
  version: 1
  objects: SceneObjectEntry[]
  camera?: CameraState
}

export interface SceneObjectEntry {
  id: string
  name: string
  type: 'mesh' | 'pointcloud' | 'splat' | 'group'
  source:
    | { kind: 'primitive'; geometryType: string }
    | { kind: 'imported'; path: string }
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
