import * as THREE from 'three'
import { SceneViewer } from '@/lib/scene/SceneViewer.ts'
import { sceneState, setSceneActions, SCENE_DEFAULTS } from '@/lib/sceneState.svelte.ts'
import type { SceneObject, SceneObjectSource, ProjectionItem, Tool } from '@/lib/types.ts'
import { pushCommand, clearHistory } from '@/lib/history.svelte.ts'
import { TransformGizmo } from '@/lib/scene/TransformGizmo.ts'
import { AimModeController } from '@/lib/scene/AimModeController.ts'
import { PickingController } from '@/lib/scene/PickingController.ts'
import { SelectionManager } from '@/lib/scene/SelectionManager.ts'
import { CouplingManager } from '@/lib/scene/CouplingManager.ts'
import { UI_LAYER } from '@/lib/scene/layers.ts'
import { VantageProjection } from '@/lib/scene/projection'
import { importFiles } from '@/lib/fileImport.ts'
import { splatToPoints } from '@/lib/pointCloudLoader.ts'

export class SceneEditor extends SceneViewer {
  private gizmo: TransformGizmo
  private selectionManager: SelectionManager
  private couplingManager: CouplingManager
  private lastTool: Tool = 'cursor'
  private canvas: HTMLCanvasElement
  private aimController: AimModeController
  private pickingController: PickingController
  private ac = new AbortController()

  constructor(canvas: HTMLCanvasElement) {
    super(canvas)
    this.canvas = canvas

    // Transform gizmo
    this.gizmo = new TransformGizmo(this.camera, canvas, this.rig)
    this.gizmo.getRaycaster().layers.enable(UI_LAYER)
    const gizmoHelper = this.gizmo.getHelper()
    gizmoHelper.traverse((o) => o.layers.set(UI_LAYER))
    this.scene.add(gizmoHelper)

    this.selectionManager = new SelectionManager(this.scene, this.gizmo)
    this.couplingManager = new CouplingManager()

    this.aimController = new AimModeController({
      camera: this.camera,
      rig: this.rig,
      gizmo: this.gizmo,
      canvas,
    })

    this.addDefaultBox()

    // Register actions
    setSceneActions({
      addObject: (name, obj, source) => {
        const item = this.doAdd(name, obj, source)
        pushCommand({
          undo: () => this.doRemove(item),
          redo: () => this.doAdd(item.name, item.object, item.source),
        })
      },
      removeObject: (item) => {
        const wasSelected =
          sceneState.selected?.kind === 'object' && sceneState.selected.object === item.object
        // Capture any projections tightly coupled to this model so the link can
        // be restored on undo (doAdd assigns a fresh id, so we re-point to it).
        const coupledProjections = sceneState.projections.filter(
          (p) => p.coupledObjectId === item.id
        )
        this.doRemove(item)
        for (const p of coupledProjections) {
          p.coupledObjectId = undefined
          this.couplingManager.reset(p.id)
        }
        pushCommand({
          undo: () => {
            const restored = this.doAdd(item.name, item.object, item.source)
            for (const p of coupledProjections) {
              p.coupledObjectId = restored.id
              this.couplingManager.reset(p.id)
            }
            if (wasSelected) sceneState.selected = sceneState.objects[sceneState.objects.length - 1]
          },
          redo: () => {
            this.doRemove(item)
            for (const p of coupledProjections) {
              p.coupledObjectId = undefined
              this.couplingManager.reset(p.id)
            }
          },
        })
      },
      focusObject: (item) => {
        this.rig.focusObject(item.object)
      },
      clearScene: () => {
        if (sceneState.tool === 'aim') this.aimController.exit()
        for (const item of [...sceneState.objects]) {
          this.scene.remove(item.object)
        }
        for (const item of [...sceneState.projections]) {
          item.projection.unproject(this.scene)
          item.projection.dispose()
          this.scene.remove(item.projection)
        }
        this.gizmo.detach()
        sceneState.objects = []
        sceneState.projections = []
        sceneState.selected = null
        sceneState.hovered = null
        sceneState.showGrid = SCENE_DEFAULTS.showGrid
        sceneState.clearColor = SCENE_DEFAULTS.clearColor
        clearHistory()
      },
      addObjectSilent: (name, obj, source) => {
        return this.doAdd(name, obj, source)
      },
      setObjectRenderMode: (item, mode) => {
        const prevMode = this.doSetRenderMode(item, mode)
        if (!prevMode) return
        pushCommand({
          undo: () => this.doSetRenderMode(item, prevMode),
          redo: () => this.doSetRenderMode(item, mode),
        })
      },
      addProjection: (name, projection, imageBlob, imagePath) => {
        const item = this.doAddProjection(name, projection, imagePath, imageBlob)
        pushCommand({
          undo: () => this.doRemoveProjection(item),
          redo: () =>
            this.doAddProjection(item.name, item.projection, item.imagePath, item.imageBlob),
        })
      },
      removeProjection: (item) => {
        const wasSelected =
          sceneState.selected?.kind === 'projection' &&
          sceneState.selected.projection === item.projection
        this.doRemoveProjection(item)
        pushCommand({
          undo: () => {
            this.doAddProjection(item.name, item.projection, item.imagePath, item.imageBlob)
            if (wasSelected)
              sceneState.selected = sceneState.projections[sceneState.projections.length - 1]
          },
          redo: () => this.doRemoveProjection(item),
        })
      },
      addProjectionSilent: (name, projection, imagePath) => {
        return this.doAddProjection(name, projection, imagePath)
      },
      focusProjection: (item) => {
        this.rig.flyToProjection(item.projection)
      },
      enterAimMode: () => this.aimController.enter(),
      exitAimMode: () => this.aimController.exit(),
    })

    // Click-to-select
    this.pickingController = new PickingController(canvas, this.camera, this.gizmo)

    // Drag-and-drop file import
    const opts = { signal: this.ac.signal }
    canvas.addEventListener('dragover', (e) => e.preventDefault(), opts)
    canvas.addEventListener(
      'drop',
      (e) => {
        e.preventDefault()
        this.handleFiles(e.dataTransfer?.files)
      },
      opts
    )
  }

  // ── Render loop hooks ──

  protected override tickCamera(deltaMs: number): void {
    // Tool transitions
    if (sceneState.tool !== this.lastTool) {
      const prev = this.lastTool
      this.lastTool = sceneState.tool
      if (sceneState.tool === 'aim') {
        this.aimController.enter()
      } else if (prev === 'aim') {
        this.aimController.exit()
      }
    }

    if (sceneState.tool === 'aim') {
      this.aimController.update(deltaMs)
    } else {
      this.rig.tick()
    }
  }

  protected override onTick(): void {
    this.couplingManager.update()
    this.selectionManager.update()
  }

  protected override updateProjections(): void {
    for (const p of sceneState.projections) {
      if (p.visible) p.projection.update(this.renderer, this.scene)
    }
  }

  protected override updateEnvironment(): void {
    this.env.grid.visible = sceneState.showGrid
    if (this.env.grid.visible) this.env.grid.update(this.camera)
    this.renderer.setClearColor(sceneState.clearColor)
  }

  protected override onDispose(): void {
    if (sceneState.tool === 'aim') this.aimController.exit()
    setSceneActions(null)
    this.ac.abort()
    this.aimController.dispose()
    this.pickingController.dispose()
    this.gizmo.dispose()
    this.selectionManager.dispose()
    this.couplingManager.dispose()
    for (const p of sceneState.projections) {
      p.projection.dispose()
    }
  }

  // ── Camera state (editor returns Vector3-like objects for projectActions) ──

  getEditorCameraState() {
    return {
      position: this.camera.position,
      target: this.rig.target,
      fov: this.camera.fov,
    }
  }

  // ── Scene object management ──

  private addDefaultBox() {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    )
    box.name = 'Box'
    this.scene.add(box)
    sceneState.objects = [
      {
        kind: 'object',
        id: crypto.randomUUID(),
        name: box.name,
        object: box,
        visible: box.visible,
        locked: false,
        source: { kind: 'primitive', geometryType: 'box' },
      },
    ]
  }

  private doAdd(name: string, obj: THREE.Object3D, source: SceneObjectSource): SceneObject {
    const existing = sceneState.objects.map((o) => o.name)
    let uniqueName = name
    let i = 1
    while (existing.includes(uniqueName)) {
      uniqueName = `${name} (${i++})`
    }
    obj.name = uniqueName
    this.scene.add(obj)
    if (source.kind === 'imported' && source.format === 'splat') {
      void this.ensureSparkRenderer()
    }
    const item: SceneObject = {
      kind: 'object',
      id: crypto.randomUUID(),
      name: uniqueName,
      object: obj,
      visible: true,
      locked: false,
      source,
      display: obj.userData.display as SceneObject['display'],
    }
    sceneState.objects = [...sceneState.objects, item]

    for (const p of sceneState.projections) {
      p.projection.project(obj)
    }

    return item
  }

  private doRemove(item: SceneObject) {
    const obj = item.object

    // Unproject all projections from this object before removing
    for (const p of sceneState.projections) {
      p.projection.unproject(obj)
    }

    this.scene.remove(obj)
    if (sceneState.selected?.kind === 'object' && sceneState.selected.object === obj) {
      this.gizmo.detach()
      sceneState.selected = null
    }
    if (sceneState.hovered?.object === obj) {
      sceneState.hovered = null
    }
    sceneState.objects = sceneState.objects.filter((o) => o.object !== obj)
  }

  /**
   * Toggle a splat/point-cloud object between Gaussian-splat and point-cloud
   * rendering by swapping the scene object. Returns the previous mode (for
   * undo), or null if it was a no-op. The two representations are cached and
   * linked via `userData`, so toggling back needs no reload.
   */
  private doSetRenderMode(
    item: SceneObject,
    mode: 'splat' | 'pointcloud'
  ): 'splat' | 'pointcloud' | null {
    const display = item.display
    if (!display || display.renderAs === mode) return null

    const current = item.object
    let next: THREE.Object3D | undefined
    if (mode === 'pointcloud') {
      next =
        (current.userData.pointsVariant as THREE.Object3D | undefined) ??
        splatToPoints(current as Parameters<typeof splatToPoints>[0], display)
    } else {
      next = current.userData.sourceSplat as THREE.Object3D | undefined
    }
    if (!next) return null

    const prevMode = display.renderAs
    this.swapObject(item, next)
    display.renderAs = mode
    next.userData.display = display
    return prevMode
  }

  /** Replace `item.object` in the scene with `next`, preserving transform and selection. */
  private swapObject(item: SceneObject, next: THREE.Object3D) {
    const prev = item.object
    next.position.copy(prev.position)
    next.quaternion.copy(prev.quaternion)
    next.scale.copy(prev.scale)
    next.visible = prev.visible
    next.name = prev.name

    for (const p of sceneState.projections) p.projection.unproject(prev)
    this.scene.remove(prev)
    this.scene.add(next)
    if (next.userData.isSplat) void this.ensureSparkRenderer()
    for (const p of sceneState.projections) p.projection.project(next)

    item.object = next
    if (sceneState.hovered?.object === prev) sceneState.hovered = null
  }

  private doAddProjection(
    name: string,
    projection: VantageProjection,
    imagePath: string,
    imageBlob?: Blob
  ): ProjectionItem {
    const existingNames = [
      ...sceneState.objects.map((o) => o.name),
      ...sceneState.projections.map((p) => p.name),
    ]
    let uniqueName = name
    let i = 1
    while (existingNames.includes(uniqueName)) {
      uniqueName = `${name} (${i++})`
    }

    this.scene.add(projection)

    for (const obj of sceneState.objects) {
      projection.project(obj.object)
    }

    const item: ProjectionItem = {
      kind: 'projection',
      id: crypto.randomUUID(),
      name: uniqueName,
      projection,
      visible: true,
      locked: false,
      imageBlob,
      imagePath,
    }
    sceneState.projections = [...sceneState.projections, item]
    return item
  }

  private doRemoveProjection(item: ProjectionItem) {
    const isSelected =
      sceneState.selected?.kind === 'projection' &&
      sceneState.selected.projection === item.projection
    if (sceneState.tool === 'aim' && isSelected) {
      this.aimController.exit()
    }

    // Unproject from all objects
    for (const obj of sceneState.objects) {
      item.projection.unproject(obj.object)
    }

    this.scene.remove(item.projection)

    if (isSelected) {
      this.gizmo.detach()
      sceneState.selected = null
    }

    item.projection.dispose()
    sceneState.projections = sceneState.projections.filter((p) => p.projection !== item.projection)
  }

  private async handleFiles(files: FileList | null | undefined) {
    await importFiles(files)
  }
}
