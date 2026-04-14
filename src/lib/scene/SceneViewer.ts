import * as THREE from 'three'
import { CameraRig } from '@/lib/scene/CameraRig.ts'
import { DefaultEnvironment } from '@/lib/scene/DefaultEnvironment.ts'
import { UI_LAYER } from '@/lib/scene/layers.ts'
import { VantageProjection } from '@/lib/scene/projection/index.ts'
import { CAMERA_DEFAULTS } from '@/lib/constants.ts'
import type { CameraState } from '@/lib/project/types.ts'

export interface SceneViewOptions {
  showGrid?: boolean
  clearColor?: string
}

interface LoadedObject {
  object: THREE.Object3D
  visible: boolean
}

interface LoadedProjection {
  projection: VantageProjection
  visible: boolean
}

export class SceneViewer {
  protected renderer: THREE.WebGLRenderer
  protected scene: THREE.Scene
  protected camera: THREE.PerspectiveCamera
  protected rig: CameraRig
  protected env: DefaultEnvironment
  protected clock = new THREE.Timer()
  protected projections: LoadedProjection[] = []

  private ro: ResizeObserver
  private animId = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.setClearColor(0xf3e7fd)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_DEFAULTS.fov,
      canvas.clientWidth / canvas.clientHeight,
      CAMERA_DEFAULTS.near,
      CAMERA_DEFAULTS.far
    )
    this.camera.position.set(...CAMERA_DEFAULTS.position)
    this.camera.lookAt(0, 0, 0)
    this.camera.layers.enable(UI_LAYER)

    this.rig = new CameraRig(this.camera, canvas)
    this.rig.enableDamping = true

    this.env = new DefaultEnvironment()
    this.scene.add(this.env)

    this.ro = new ResizeObserver(() => {
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight
      this.camera.updateProjectionMatrix()
    })
    this.ro.observe(canvas)

    // Defer first frame so subclass constructors finish before the first tick
    requestAnimationFrame(() => this.animate())
  }

  // ── Public API ──

  loadScene(
    objects: LoadedObject[],
    projections: LoadedProjection[],
    options: SceneViewOptions = {}
  ): void {
    // Clear previous scene content (keep env)
    for (const p of this.projections) {
      p.projection.unproject(this.scene)
      p.projection.dispose()
      this.scene.remove(p.projection)
    }
    const toRemove = this.scene.children.filter((c) => c !== this.env)
    for (const obj of toRemove) this.scene.remove(obj)

    this.projections = projections

    for (const { object, visible } of objects) {
      object.visible = visible
      this.scene.add(object)
    }

    for (const { projection, visible } of projections) {
      projection.visible = visible
      this.scene.add(projection)
      if (visible) {
        for (const { object, visible: objVisible } of objects) {
          if (objVisible) projection.project(object)
        }
      }
    }

    this.env.grid.visible = options.showGrid ?? true
    if (options.clearColor) this.renderer.setClearColor(options.clearColor)
  }

  getCameraState(): CameraState {
    return {
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      target: [this.rig.target.x, this.rig.target.y, this.rig.target.z],
      fov: this.camera.fov,
    }
  }

  setCameraState(state: CameraState): void {
    this.camera.position.set(...state.position)
    this.rig.target.set(...state.target)
    this.camera.fov = state.fov
    this.camera.updateProjectionMatrix()
    this.rig.update()
  }

  beginPlayback(): void {
    this.rig.enabled = false
  }

  endPlayback(): void {
    this.rig.enabled = true
  }

  applyAnimatedCamera(state: CameraState): void {
    this.camera.position.set(...state.position)
    this.rig.target.set(...state.target)
    this.camera.fov = state.fov
    this.camera.updateProjectionMatrix()
    this.rig.update()
  }

  dispose() {
    this.onDispose()
    cancelAnimationFrame(this.animId)
    this.ro.disconnect()
    for (const { projection } of this.projections) {
      projection.dispose()
    }
    this.renderer.dispose()
  }

  // ── Render loop ──

  private animate() {
    this.animId = requestAnimationFrame(() => this.animate())
    this.clock.update()
    const deltaMs = this.clock.getDelta() * 1000

    this.tickCamera(deltaMs)
    this.onTick()
    this.updateProjections()
    this.updateEnvironment()

    this.renderer.render(this.scene, this.camera)
  }

  // ── Hooks for subclasses ──

  protected tickCamera(_deltaMs: number): void {
    this.rig.tick()
  }

  protected onTick(): void {}

  protected updateProjections(): void {
    for (const { projection, visible } of this.projections) {
      if (visible) projection.update(this.renderer, this.scene)
    }
  }

  protected updateEnvironment(): void {
    if (this.env.grid.visible) this.env.grid.update(this.camera)
  }

  protected onDispose(): void {}
}
