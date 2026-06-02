import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

type FlyTarget = { position: THREE.Vector3; target: THREE.Vector3 }

const _dir = new THREE.Vector3()

/**
 * World-space bounds of an object. Splat meshes (e.g. Spark's SplatMesh) have no
 * standard geometry, so `setFromObject` yields an empty box; they instead expose
 * a `getBoundingBox()` returning local-space bounds, which we transform to world.
 */
function worldBounds(object: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3().setFromObject(object)
  if (!box.isEmpty()) return box
  const getBoundingBox = (object as { getBoundingBox?: () => THREE.Box3 }).getBoundingBox
  if (typeof getBoundingBox === 'function') {
    object.updateWorldMatrix(true, false)
    return getBoundingBox.call(object).clone().applyMatrix4(object.matrixWorld)
  }
  return box
}

export class CameraRig extends OrbitControls {
  private flyTarget: FlyTarget | null = null

  constructor(camera: THREE.Camera, canvas: HTMLElement) {
    super(camera, canvas)
    this.addEventListener('start', () => {
      this.flyTarget = null
    })
  }

  focusObject(object: THREE.Object3D) {
    const box = worldBounds(object)
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3()).length()
    const dir = this.object.position.clone().sub(this.target).normalize()
    this.flyTarget = {
      target: center,
      position: center.clone().add(dir.multiplyScalar(size * 1.5)),
    }
  }

  /** Fly the orbit camera to match a projection camera's viewpoint. */
  flyToProjection(projection: THREE.PerspectiveCamera) {
    const pos = projection.getWorldPosition(new THREE.Vector3())
    projection.getWorldDirection(_dir)
    this.flyTarget = {
      position: pos,
      target: pos.clone().addScaledVector(_dir, 10),
    }
  }

  tick() {
    if (this.flyTarget) {
      this.object.position.lerp(this.flyTarget.position, 0.08)
      this.target.lerp(this.flyTarget.target, 0.08)
      if (this.object.position.distanceTo(this.flyTarget.position) < 0.1) {
        this.object.position.copy(this.flyTarget.position)
        this.target.copy(this.flyTarget.target)
        this.flyTarget = null
      }
    }
    this.update()
  }
}
