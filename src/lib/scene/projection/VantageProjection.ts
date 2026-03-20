import {
  PerspectiveCamera,
  WebGLRenderTarget,
  DepthTexture,
  MeshDepthMaterial,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  type Texture,
  type WebGLRenderer,
  type Scene,
  type Object3D,
  type Material,
} from 'three'
import ProjectionMaterial from './ProjectionMaterial'
import { UI_LAYER } from '@/lib/scene/layers.ts'

interface VantageProjectionOptions {
  texture?: Texture
  fov?: number
  near?: number
  far?: number
  renderTargetSize?: number
}

export class VantageProjection extends PerspectiveCamera {
  isVantageProjection = true
  renderTarget: WebGLRenderTarget
  texture: Texture | null = null
  projectionPlane: Mesh | null = null

  private _materials = new Map<Mesh, { mat: ProjectionMaterial; hadGroups: boolean }>()
  private _depthMaterial = new MeshDepthMaterial({
    polygonOffset: true,
    polygonOffsetFactor: 1.0,
    polygonOffsetUnits: 1.0,
  })

  constructor({
    texture,
    fov = 60,
    near = 5,
    far = 1000,
    renderTargetSize = 1024,
  }: VantageProjectionOptions = {}) {
    super(fov, 1, near, far)

    this.renderTarget = new WebGLRenderTarget(renderTargetSize, renderTargetSize)
    this.renderTarget.depthTexture = new DepthTexture(renderTargetSize, renderTargetSize)

    this._initProjectionPlane()

    if (texture) this.setTexture(texture)
  }

  override updateProjectionMatrix() {
    super.updateProjectionMatrix()
    this._updateProjectionPlaneSize()
  }

  setTexture(texture: Texture) {
    this.texture = texture
    const img = texture.image as HTMLImageElement | HTMLVideoElement | null
    const w = (img as HTMLVideoElement)?.videoWidth ?? (img as HTMLImageElement)?.width ?? 1
    const h = (img as HTMLVideoElement)?.videoHeight ?? (img as HTMLImageElement)?.height ?? 1
    this.aspect = w / h
    this.updateProjectionMatrix()
    if (this.projectionPlane) {
      ;(this.projectionPlane.material as MeshBasicMaterial).map = texture
      ;(this.projectionPlane.material as MeshBasicMaterial).needsUpdate = true
    }
  }

  project(object: Object3D) {
    object.traverse((child) => {
      if (!(child as Mesh).isMesh) return
      this._applyMaterial(child as Mesh)
    })
  }

  unproject(object: Object3D) {
    object.traverse((child) => {
      if (!(child as Mesh).isMesh) return
      const mesh = child as Mesh
      const entry = this._materials.get(mesh)
      if (!entry) return
      const { mat, hadGroups } = entry

      const materials = mesh.material as Material[]
      const idx = materials.indexOf(mat)
      if (idx !== -1) {
        mesh.geometry.groups = mesh.geometry.groups.filter((g) => g.materialIndex !== idx)
        if (!hadGroups) {
          mesh.geometry.groups = mesh.geometry.groups.filter((g) => g.materialIndex !== 0)
        }
        mesh.geometry.groups.forEach((g) => {
          if (g.materialIndex! > idx) g.materialIndex!--
        })
        materials.splice(idx, 1)
        if (materials.length === 1) mesh.material = materials[0]
      }

      this._materials.delete(mesh)
      mat.dispose()
    })
  }

  update(renderer: WebGLRenderer, scene: Scene) {
    if (!this.texture || this._materials.size === 0) return
    this._createDepthMap(renderer, scene)
    for (const [mesh, { mat }] of this._materials) {
      mat.project(mesh)
    }
  }

  dispose() {
    this.renderTarget.depthTexture?.dispose()
    this.renderTarget.dispose()
    for (const { mat } of this._materials.values()) {
      mat.dispose()
    }
    this._materials.clear()
    if (this.projectionPlane) {
      this.projectionPlane.geometry.dispose()
      ;(this.projectionPlane.material as MeshBasicMaterial).dispose()
    }
  }

  private _initProjectionPlane() {
    const mat = new MeshBasicMaterial({ map: null, transparent: true })
    const geo = new PlaneGeometry(1, 1)
    this.projectionPlane = new Mesh(geo, mat)
    this.projectionPlane.visible = true
    this.projectionPlane.renderOrder = -1
    this.projectionPlane.layers.set(UI_LAYER)
    this.add(this.projectionPlane)
    this._updateProjectionPlaneSize()
  }

  private _updateProjectionPlaneSize() {
    if (!this.projectionPlane) return
    const halfFovRad = (this.fov * Math.PI) / 180 / 2
    const h = 2 * this.far * Math.tan(halfFovRad)
    const w = h * this.aspect
    this.projectionPlane.scale.set(w, h, 1)
    this.projectionPlane.position.set(0, 0, -this.far)
  }

  private _applyMaterial(mesh: Mesh) {
    if (this._materials.has(mesh)) return
    if (!this.texture) return

    const hadGroups = mesh.geometry.groups.length > 0

    if (!Array.isArray(mesh.material)) {
      mesh.material = [mesh.material]
      // Collapse all existing group materialIndex to 0 since they all
      // referenced the same single material that is now at index 0
      for (const g of mesh.geometry.groups) {
        g.materialIndex = 0
      }
    }
    if (!hadGroups) {
      mesh.geometry.addGroup(0, Infinity, 0)
    }

    const materialIndex = mesh.material.length
    mesh.geometry.addGroup(0, Infinity, materialIndex)

    const mat = new ProjectionMaterial({
      camera: this,
      texture: this.texture,
      transparent: true,
      opacity: 1,
      depthMap: this.renderTarget.depthTexture as DepthTexture,
    })
    mesh.material.push(mat)
    mat.project(mesh)
    this._materials.set(mesh, { mat, hadGroups })
  }

  private _createDepthMap(renderer: WebGLRenderer, scene: Scene) {
    scene.overrideMaterial = this._depthMaterial
    renderer.setRenderTarget(this.renderTarget)
    renderer.render(scene, this)
    renderer.setRenderTarget(null)
    scene.overrideMaterial = null
  }
}
