import * as THREE from 'three'
import { sceneState } from '@/lib/sceneState.svelte.ts'
import type { SceneObject, ProjectionItem } from '@/lib/types.ts'
import { UI_LAYER } from '@/lib/scene/layers.ts'
import type { TransformGizmo } from '@/lib/scene/TransformGizmo.ts'
import { DRAG_PIXEL_THRESHOLD } from '@/lib/constants.ts'

export class PickingController {
  private raycaster = new THREE.Raycaster()
  private pointerDownPos = { x: 0, y: 0 }
  private isDragging = false
  private gizmo: TransformGizmo
  private camera: THREE.PerspectiveCamera
  private canvas: HTMLCanvasElement
  private ac = new AbortController()

  constructor(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera, gizmo: TransformGizmo) {
    this.canvas = canvas
    this.camera = camera
    this.gizmo = gizmo
    this.raycaster.layers.enable(UI_LAYER)

    const opts = { signal: this.ac.signal }
    canvas.addEventListener('pointerdown', this.onPointerDown, opts)
    canvas.addEventListener('pointermove', this.onPointerMove, opts)
    canvas.addEventListener('pointerup', this.onPointerUp, opts)
  }

  private pick(clientX: number, clientY: number): SceneObject | ProjectionItem | null {
    const rect = this.canvas.getBoundingClientRect()
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      ),
      this.camera
    )

    // Collect unlocked scene object targets
    const objTargets: THREE.Object3D[] = []
    for (const item of sceneState.objects) {
      if (!item.locked) item.object.traverse((child) => objTargets.push(child))
    }

    // Collect unlocked, visible projection plane targets
    const projPlaneTargets: THREE.Object3D[] = []
    for (const item of sceneState.projections) {
      const plane = item.projection.projectionPlane
      if (!item.locked && item.visible && plane?.visible) {
        projPlaneTargets.push(plane)
      }
    }

    const objHits = this.raycaster.intersectObjects(objTargets, false)
    const projHits = this.raycaster.intersectObjects(projPlaneTargets, false)

    // Filter projection hits to front face only (texture side)
    const frontProjHits = projHits.filter((hit) => {
      if (!hit.face) return false
      const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      return worldNormal.dot(this.raycaster.ray.direction) < 0
    })

    const closestObj = objHits[0] ?? null
    const closestProj = frontProjHits[0] ?? null

    if (!closestObj && !closestProj) return null

    // Pick whichever is closer; prefer objects on equal distance
    if (closestObj && (!closestProj || closestObj.distance <= closestProj.distance)) {
      return (
        sceneState.objects.find((item) => {
          let node: THREE.Object3D | null = closestObj.object
          while (node) {
            if (node === item.object) return true
            node = node.parent
          }
          return false
        }) ?? null
      )
    } else {
      return (
        sceneState.projections.find(
          (item) =>
            (item.projection as unknown as { projectionPlane: THREE.Mesh | null })
              .projectionPlane === closestProj!.object
        ) ?? null
      )
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY }
    this.isDragging = false
  }

  private onPointerMove = (e: PointerEvent) => {
    if (e.buttons > 0) {
      // Mouse button held — user is orbiting/panning, clear and skip hover
      const dx = e.clientX - this.pointerDownPos.x
      const dy = e.clientY - this.pointerDownPos.y
      if (Math.hypot(dx, dy) > DRAG_PIXEL_THRESHOLD) this.isDragging = true
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    if (sceneState.tool === 'aim') return
    if (this.isDragging) return
    if (this.gizmo.axis !== null) return
    sceneState.selected = this.pick(e.clientX, e.clientY)
  }

  dispose() {
    this.ac.abort()
  }
}
