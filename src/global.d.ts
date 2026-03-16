declare module 'vantage-renderer' {
  import { PerspectiveCamera, WebGLRenderer, Scene, Texture } from 'three'

  export class VantageProjection extends PerspectiveCamera {
    isVantageProjection: true
    texture: Texture | null
    constructor(options?: {
      texture?: Texture
      fov?: number
      near?: number
      far?: number
      renderTargetSize?: number
    })
    setTexture(texture: Texture): void
    project(object: import('three').Object3D): void
    unproject(object: import('three').Object3D): void
    update(renderer: WebGLRenderer, scene: Scene): void
    dispose(): void
  }

  export class CameraOperator extends import('three').EventDispatcher {
    constructor(
      renderer: WebGLRenderer,
      scene: Scene,
      options?: { mapCameraPosition?: [number, number, number] }
    )
    get camera(): PerspectiveCamera
    activeProjection: VantageProjection | null
    mode: 'map' | 'move' | 'aim'
    selectProjection(projection: VantageProjection): void
    deselectProjection(): void
    setMode(mode: 'map' | 'move' | 'aim'): void
    update(deltaMs: number): void
    dispose(): void
  }

  export class VantageProjectionExporterPlugin {
    constructor(writer: any)
  }

  export class VantageProjectionLoaderPlugin {
    constructor(parser: any)
  }

  export function loadTexture(url: string): Promise<Texture>
  export function setupLights(): import('three').Group
}

declare module '*.svg' {
  import type { Component } from 'svelte'
  const component: Component
  export default component
}

// File System Access API (Chromium)
interface FileSystemDirectoryHandle {
  requestPermission(descriptor: {
    mode: 'read' | 'readwrite'
  }): Promise<'granted' | 'denied' | 'prompt'>
}

interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
}

// webkitdirectory attribute for directory picker fallback
interface HTMLInputElement {
  webkitdirectory: boolean
}
