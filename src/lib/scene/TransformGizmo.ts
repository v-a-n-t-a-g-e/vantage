import * as THREE from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { sceneState } from '@/lib/sceneState.svelte.ts'
import { pushCommand } from '@/lib/history.svelte.ts'
import { themeColors } from '@/lib/scene/themeColors.ts'

export class TransformGizmo extends TransformControls {
  constructor(camera: THREE.Camera, canvas: HTMLCanvasElement, orbit: OrbitControls) {
    super(camera, canvas)

    // Apply CSS-variable axis colors
    this.setColors(themeColors.axisX, themeColors.axisY, themeColors.axisZ, themeColors.axisX)

    // Dim inactive axis handles
    const gizmo = (this as any)._gizmo
    const origUpdate = gizmo.updateMatrixWorld.bind(gizmo)
    gizmo.updateMatrixWorld = function (force: boolean) {
      origUpdate(force)
      if (this.axis) {
        const handles = [...this.gizmo[this.mode].children, ...this.helper[this.mode].children]
        for (const handle of handles) {
          if (!handle.material?._color) continue
          const isActive =
            handle.name === this.axis || this.axis.split('').some((a: string) => handle.name === a)
          if (isActive) {
            handle.material.color.copy(handle.material._color)
          } else {
            handle.material.opacity = handle.material._opacity * 0.15
          }
        }
      }
    }

    // Drag snapshot for undo/redo
    let dragSnapshot: {
      position: THREE.Vector3
      rotation: THREE.Euler
      scale: THREE.Vector3
    } | null = null

    this.addEventListener('change', () => {
      sceneState.transformRevision++
    })

    this.addEventListener('dragging-changed', (e) => {
      orbit.enabled = !(e as any).value
      const obj = sceneState.selected?.kind === 'object' ? sceneState.selected.object : undefined
      if ((e as any).value) {
        if (obj)
          dragSnapshot = {
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone(),
          }
      } else if (obj && dragSnapshot) {
        const before = dragSnapshot
        const after = {
          position: obj.position.clone(),
          rotation: obj.rotation.clone(),
          scale: obj.scale.clone(),
        }
        dragSnapshot = null
        pushCommand({
          undo: () => {
            obj.position.copy(before.position)
            obj.rotation.copy(before.rotation)
            obj.scale.copy(before.scale)
            sceneState.transformRevision++
          },
          redo: () => {
            obj.position.copy(after.position)
            obj.rotation.copy(after.rotation)
            obj.scale.copy(after.scale)
            sceneState.transformRevision++
          },
        })
      }
    })
  }
}
