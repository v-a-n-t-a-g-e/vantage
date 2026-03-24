import * as THREE from 'three'
import { sceneState } from '@/lib/sceneState.svelte.ts'
import { pushCommand } from '@/lib/history.svelte.ts'
import type { CameraRig } from '@/lib/scene/CameraRig.ts'
import type { TransformGizmo } from '@/lib/scene/TransformGizmo.ts'
import type { VantageProjection } from '@/lib/scene/projection'

// Reused vectors for aim mode
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _worldUp = new THREE.Vector3(0, 1, 0)
const _euler = new THREE.Euler(0, 0, 0, 'YXZ')

const AIM_MOVEMENT_KEYS = new Set([
  'KeyW',
  'KeyS',
  'KeyA',
  'KeyD',
  'KeyR',
  'KeyF',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

export interface AimModeDeps {
  camera: THREE.PerspectiveCamera
  rig: CameraRig
  gizmo: TransformGizmo
  canvas: HTMLCanvasElement
}

export class AimModeController {
  private camera: THREE.PerspectiveCamera
  private rig: CameraRig
  private gizmo: TransformGizmo

  private heldKeys = new Set<string>()
  private isDragging = false
  private dragLast = { x: 0, y: 0 }
  private orbitPositionBefore: THREE.Vector3 | null = null
  private orbitTargetBefore: THREE.Vector3 | null = null
  private dragRotationBefore: THREE.Euler | null = null
  private keyPositionBefore: THREE.Vector3 | null = null
  private ac = new AbortController()

  constructor(deps: AimModeDeps) {
    this.camera = deps.camera
    this.rig = deps.rig
    this.gizmo = deps.gizmo

    const opts = { signal: this.ac.signal }
    deps.canvas.addEventListener('mousedown', this.onMouseDown, opts)
    deps.canvas.addEventListener('mousemove', this.onMouseMove, opts)
    deps.canvas.addEventListener('mouseup', this.onMouseUp, opts)
    deps.canvas.addEventListener('mouseleave', this.onMouseUp, opts)
    document.addEventListener('keydown', this.onKeyDown, opts)
    document.addEventListener('keyup', this.onKeyUp, opts)
  }

  enter() {
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
    if (!proj) return

    // Save orbit state so we can restore it on exit
    this.orbitPositionBefore = this.camera.position.clone()
    this.orbitTargetBefore = this.rig.target.clone()

    // Sync orbit camera to projection viewpoint (strip roll to keep camera upright)
    this.camera.position.copy(proj.projection.getWorldPosition(new THREE.Vector3()))
    _euler.setFromQuaternion(proj.projection.quaternion)
    _euler.z = 0
    this.camera.quaternion.setFromEuler(_euler)

    // Disable orbit controls and gizmo
    this.rig.enabled = false
    this.gizmo.detach()

    this.heldKeys.clear()
    this.isDragging = false
    this.dragRotationBefore = null
    this.keyPositionBefore = null
  }

  exit() {
    if (sceneState.tool === 'aim') sceneState.tool = 'cursor'
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null

    // Flush any in-progress interactions before leaving
    if (proj) {
      this.flushDragCommand(proj.projection)
      this.flushKeyCommand(proj.projection)
    }

    this.heldKeys.clear()
    this.isDragging = false

    // Re-enable orbit controls and restore pre-aim camera position/target
    this.rig.enabled = true
    if (this.orbitPositionBefore && this.orbitTargetBefore) {
      this.camera.position.copy(this.orbitPositionBefore)
      this.rig.target.copy(this.orbitTargetBefore)
      this.rig.enableDamping = false
      this.rig.update()
      this.rig.enableDamping = true
    }
    this.orbitPositionBefore = null
    this.orbitTargetBefore = null

    // Re-attach gizmo
    if (proj) {
      this.gizmo.attach(proj.projection)
    }
  }

  update(deltaMs: number) {
    this.updateMovement(deltaMs)

    // Sync camera from projection (strip roll to keep camera upright)
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
    if (proj) {
      this.camera.position.copy(proj.projection.position)
      _euler.setFromQuaternion(proj.projection.quaternion)
      _euler.z = 0
      this.camera.quaternion.setFromEuler(_euler)
    }
  }

  dispose() {
    this.ac.abort()
  }

  private flushDragCommand(p: VantageProjection) {
    if (!this.dragRotationBefore) return
    const before = this.dragRotationBefore
    const after = p.rotation.clone()
    this.dragRotationBefore = null
    if (!before.equals(after)) {
      pushCommand({
        undo: () => {
          p.rotation.copy(before)
          sceneState.transformRevision++
        },
        redo: () => {
          p.rotation.copy(after)
          sceneState.transformRevision++
        },
      })
    }
  }

  private flushKeyCommand(p: VantageProjection) {
    if (!this.keyPositionBefore) return
    const before = this.keyPositionBefore
    const after = p.position.clone()
    this.keyPositionBefore = null
    if (!before.equals(after)) {
      pushCommand({
        undo: () => {
          p.position.copy(before)
          sceneState.transformRevision++
        },
        redo: () => {
          p.position.copy(after)
          sceneState.transformRevision++
        },
      })
    }
  }

  private updateMovement(deltaMs: number) {
    if (this.heldKeys.size === 0) return
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
    if (!proj) return

    this.camera.getWorldDirection(_forward)
    _forward.y = 0
    const len = _forward.length()
    if (len < 0.001) return
    _forward.divideScalar(len)
    _right.crossVectors(_forward, _worldUp).normalize()

    const speed = 0.03 * deltaMs
    const pos = this.camera.position
    let moved = false

    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) {
      pos.addScaledVector(_forward, speed)
      moved = true
    }
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) {
      pos.addScaledVector(_forward, -speed)
      moved = true
    }
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) {
      pos.addScaledVector(_right, -speed)
      moved = true
    }
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) {
      pos.addScaledVector(_right, speed)
      moved = true
    }
    if (this.heldKeys.has('KeyR')) {
      pos.y += speed
      moved = true
    }
    if (this.heldKeys.has('KeyF')) {
      pos.y -= speed
      moved = true
    }

    if (moved) {
      proj.projection.position.copy(pos)
      proj.projection.updateMatrixWorld()
      sceneState.transformRevision++
    }
  }

  private onMouseDown = (event: MouseEvent) => {
    if (sceneState.tool !== 'aim') return
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
    if (!proj) return
    this.isDragging = true
    this.dragLast = { x: event.clientX, y: event.clientY }
    this.dragRotationBefore = proj.projection.rotation.clone()
  }

  private onMouseMove = (event: MouseEvent) => {
    if (sceneState.tool !== 'aim' || !this.isDragging) return
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
    if (!proj) return

    const dx = event.clientX - this.dragLast.x
    const dy = event.clientY - this.dragLast.y
    this.dragLast = { x: event.clientX, y: event.clientY }

    // Preserve projection's existing roll
    _euler.setFromQuaternion(proj.projection.quaternion)
    const roll = _euler.z

    // Compute new pitch/yaw from camera (always upright)
    _euler.setFromQuaternion(this.camera.quaternion)
    _euler.y -= dx * 0.003
    _euler.x -= dy * 0.003
    _euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, _euler.x))
    _euler.z = 0
    this.camera.quaternion.setFromEuler(_euler)

    // Write back to projection with preserved roll
    _euler.z = roll
    proj.projection.quaternion.setFromEuler(_euler)
    proj.projection.updateMatrixWorld()
    sceneState.transformRevision++
  }

  private onMouseUp = () => {
    if (!this.isDragging) return
    this.isDragging = false
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
    if (proj) this.flushDragCommand(proj.projection)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (sceneState.tool !== 'aim') return
    if (event.code === 'Escape') {
      this.exit()
      return
    }
    this.heldKeys.add(event.code)
    // Snapshot position when first movement key is pressed
    if (AIM_MOVEMENT_KEYS.has(event.code) && !this.keyPositionBefore) {
      const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
      if (proj) this.keyPositionBefore = proj.projection.position.clone()
    }
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.heldKeys.delete(event.code)
    // Push position command when all movement keys are released
    if (AIM_MOVEMENT_KEYS.has(event.code) && this.keyPositionBefore) {
      const hasMovementKeys = [...this.heldKeys].some((k) => AIM_MOVEMENT_KEYS.has(k))
      if (!hasMovementKeys) {
        const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
        if (proj) this.flushKeyCommand(proj.projection)
      }
    }
  }
}
