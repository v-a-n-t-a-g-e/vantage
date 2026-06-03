import * as THREE from 'three'
import { sceneState } from '@/lib/sceneState.svelte.ts'

// Reused temporaries (mirrors the pattern in AimModeController.ts)
const _ONE = new THREE.Vector3(1, 1, 1)
const _pos = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _scale = new THREE.Vector3()
const _delta = new THREE.Matrix4()
const _followerM = new THREE.Matrix4()
const _curM = new THREE.Matrix4()
const _objM = new THREE.Matrix4()

type Snapshot = { proj: THREE.Matrix4; obj: THREE.Matrix4 }

/** Build a rigid (position + rotation only, unit scale) matrix for an object.
 *  Ignoring scale keeps it out of the coupling: it never propagates in either
 *  direction, and a follower's own scale is preserved through applyDelta. */
function rigidMatrix(o: THREE.Object3D, out: THREE.Matrix4): THREE.Matrix4 {
  return out.compose(o.position, o.quaternion, _ONE)
}

/**
 * Keeps tightly-coupled model/projection pairs moving as one rigid body.
 *
 * Runs once per frame from the render loop. There is no single transform setter
 * in the app — the gizmo, the Vec3 panel inputs and aim mode each mutate
 * position/rotation directly — so instead of patching every input path we
 * observe each pair's transforms here and mirror whichever one moved onto the
 * other. This also makes undo/redo "just work": undo restores the driver, and
 * the next frame mirrors that delta onto the follower.
 */
export class CouplingManager {
  private snapshots = new Map<string, Snapshot>()

  update() {
    for (const proj of sceneState.projections) {
      const objId = proj.coupledObjectId
      if (!objId) {
        this.snapshots.delete(proj.id)
        continue
      }

      const objItem = sceneState.objects.find((o) => o.id === objId)
      if (!objItem) {
        // Coupled model is gone — drop the dangling link.
        proj.coupledObjectId = undefined
        this.snapshots.delete(proj.id)
        continue
      }

      const projObj = proj.projection
      const modelObj = objItem.object

      const snap = this.snapshots.get(proj.id)
      if (!snap) {
        // First frame of this coupling: capture the baseline pose without moving
        // anything, so the current relative arrangement is preserved.
        this.snapshots.set(proj.id, {
          proj: rigidMatrix(projObj, new THREE.Matrix4()),
          obj: rigidMatrix(modelObj, new THREE.Matrix4()),
        })
        continue
      }

      const curProj = rigidMatrix(projObj, _curM)
      const curObj = rigidMatrix(modelObj, _objM)
      const projChanged = !curProj.equals(snap.proj)
      const objChanged = !curObj.equals(snap.obj)

      if (projChanged && !objChanged) {
        this.applyDelta(snap.proj, curProj, modelObj)
      } else if (objChanged && !projChanged) {
        this.applyDelta(snap.obj, curObj, projObj)
      }
      // If both changed in the same frame (e.g. a scene load), don't sync —
      // just re-snapshot below so the new arrangement becomes the baseline.

      // Re-snapshot from the (possibly just-moved) current poses.
      rigidMatrix(projObj, snap.proj)
      rigidMatrix(modelObj, snap.obj)
    }
  }

  /** Apply the rigid motion the driver underwent (prev → cur) to the follower,
   *  preserving the follower's scale. */
  private applyDelta(prevM: THREE.Matrix4, curM: THREE.Matrix4, follower: THREE.Object3D) {
    // delta = cur * prev⁻¹  (both share the scene as parent)
    _delta.copy(prevM).invert().premultiply(curM)
    // followerNew = delta * follower
    rigidMatrix(follower, _followerM).premultiply(_delta)
    _followerM.decompose(_pos, _quat, _scale)
    follower.position.copy(_pos)
    follower.quaternion.copy(_quat)
    follower.updateMatrixWorld()
    sceneState.transformRevision++
  }

  /** Drop the cached baseline so it is recaptured next frame. */
  reset(projectionId?: string) {
    if (projectionId) this.snapshots.delete(projectionId)
    else this.snapshots.clear()
  }

  dispose() {
    this.snapshots.clear()
  }
}
