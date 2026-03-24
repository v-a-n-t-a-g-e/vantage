import * as THREE from 'three'
import {
  sceneState,
  TRANSFORM_TOOLS,
} from '@/lib/sceneState.svelte.ts'
import type {
  SceneObject,
  ProjectionItem,
  TransformTool,
  Tool,
} from '@/lib/sceneState.svelte.ts'
import type { TransformGizmo } from '@/lib/scene/TransformGizmo.ts'
import { ProjectionHelper } from '@/lib/scene/projection'
import { themeColors } from '@/lib/scene/themeColors.ts'
import { UI_LAYER } from '@/lib/scene/layers.ts'

export class SelectionManager {
  private scene: THREE.Scene
  private gizmo: TransformGizmo
  private hoverHelper: THREE.BoxHelper | null = null
  private selectionHelper: THREE.BoxHelper | null = null
  private projectionHelper: ProjectionHelper | null = null
  private lastSelected: SceneObject | ProjectionItem | null = null
  private lastHovered: SceneObject | null = null
  private lastTool: Tool = 'cursor'

  constructor(scene: THREE.Scene, gizmo: TransformGizmo) {
    this.scene = scene
    this.gizmo = gizmo
  }

  update() {
    // Selection changes
    if (sceneState.selected !== this.lastSelected) {
      // Clean up old projection helper if previous selection was a projection
      if (this.lastSelected?.kind === 'projection') {
        if (this.projectionHelper) {
          this.scene.remove(this.projectionHelper)
          this.projectionHelper = null
        }
      }
      // Clean up old selection box helper
      if (this.selectionHelper) {
        this.scene.remove(this.selectionHelper)
        this.selectionHelper = null
      }

      this.lastSelected = sceneState.selected
      if (this.lastSelected?.kind === 'object') {
        if (sceneState.tool === 'cursor') {
          this.gizmo.detach()
          this.selectionHelper = new THREE.BoxHelper(this.lastSelected.object, themeColors.brand)
          this.selectionHelper.layers.set(UI_LAYER)
          this.scene.add(this.selectionHelper)
        } else {
          this.gizmo.attach(this.lastSelected.object)
        }
      } else if (this.lastSelected?.kind === 'projection') {
        if (sceneState.tool !== 'aim' && sceneState.tool !== 'cursor')
          this.gizmo.attach(this.lastSelected.projection)
        this.projectionHelper = new ProjectionHelper(this.lastSelected.projection)
        this.scene.add(this.projectionHelper)
      } else {
        this.gizmo.detach()
      }
    }

    // Update projection helper if it exists
    if (this.projectionHelper) this.projectionHelper.update()
    // Update selection box helper if it exists
    if (this.selectionHelper) this.selectionHelper.update()

    // Handle tool changes (cursor ↔ transform)
    if (sceneState.tool === 'cursor') {
      // In cursor mode: detach gizmo, show selection helper for objects
      if (this.gizmo.object) this.gizmo.detach()
      if (this.lastSelected?.kind === 'object' && !this.selectionHelper) {
        this.selectionHelper = new THREE.BoxHelper(this.lastSelected.object, themeColors.brand)
        this.selectionHelper.layers.set(UI_LAYER)
        this.scene.add(this.selectionHelper)
      }
    } else {
      // In transform/aim mode: remove selection helper, attach gizmo
      if (this.selectionHelper) {
        this.scene.remove(this.selectionHelper)
        this.selectionHelper = null
      }
      if (TRANSFORM_TOOLS.includes(sceneState.tool as TransformTool)) {
        this.gizmo.setMode(sceneState.tool as TransformTool)
        if (this.lastSelected?.kind === 'object' && !this.gizmo.object) {
          this.gizmo.attach(this.lastSelected.object)
        } else if (this.lastSelected?.kind === 'projection' && !this.gizmo.object) {
          this.gizmo.attach(this.lastSelected.projection)
        }
      }
    }

    // Hover highlight
    if (sceneState.hovered !== this.lastHovered) {
      if (this.hoverHelper) {
        this.scene.remove(this.hoverHelper)
        this.hoverHelper = null
      }
      this.lastHovered = sceneState.hovered
      if (this.lastHovered) {
        this.hoverHelper = new THREE.BoxHelper(this.lastHovered.object, themeColors.brand)
        this.hoverHelper.layers.set(UI_LAYER)
        this.scene.add(this.hoverHelper)
      }
    }
    if (this.hoverHelper) this.hoverHelper.update()
  }

  dispose() {
    if (this.projectionHelper) this.scene.remove(this.projectionHelper)
    if (this.selectionHelper) this.scene.remove(this.selectionHelper)
    if (this.hoverHelper) this.scene.remove(this.hoverHelper)
  }
}
