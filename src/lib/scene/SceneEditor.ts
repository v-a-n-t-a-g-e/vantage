import * as THREE from 'three'
import { sceneState, setSceneActions, SCENE_DEFAULTS } from '@/lib/sceneState.svelte.ts'
import type { SceneObject, SceneObjectSource, ProjectionItem, Tool } from '@/lib/types.ts'
import { pushCommand, clearHistory } from '@/lib/history.svelte.ts'
import { DefaultEnvironment } from '@/lib/scene/DefaultEnvironment.ts'
import { CameraRig } from '@/lib/scene/CameraRig.ts'
import { TransformGizmo } from '@/lib/scene/TransformGizmo.ts'
import { AimModeController } from '@/lib/scene/AimModeController.ts'
import { PickingController } from '@/lib/scene/PickingController.ts'
import { SelectionManager } from '@/lib/scene/SelectionManager.ts'
import { UI_LAYER } from '@/lib/scene/layers.ts'
import { VantageProjection } from '@/lib/scene/projection'
import { importFiles } from '@/lib/fileImport.ts'
import { CAMERA_DEFAULTS } from '@/lib/constants.ts'

export class SceneEditor {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private rig: CameraRig
  private gizmo: TransformGizmo
  private selectionManager: SelectionManager
  private lastTool: Tool = 'cursor'
  private animId = 0
  private ro: ResizeObserver
  private canvas: HTMLCanvasElement
  private clock = new THREE.Timer()
  private env: DefaultEnvironment
  private aimController: AimModeController
  private pickingController: PickingController
  private ac = new AbortController()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.setClearColor(0xf3e7fd)

    // Scene & camera
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

    // Controls
    this.rig = new CameraRig(this.camera, canvas)
    this.rig.enableDamping = true

    this.gizmo = new TransformGizmo(this.camera, canvas, this.rig)
    // TransformControls uses a shared module-level Raycaster (default layer 0 only).
    // Enabling UI_LAYER on it lets the gizmo hit-test its own objects after we move them.
    this.gizmo.getRaycaster().layers.enable(UI_LAYER)
    const gizmoHelper = this.gizmo.getHelper()
    gizmoHelper.traverse((o) => o.layers.set(UI_LAYER))
    this.scene.add(gizmoHelper)

    this.selectionManager = new SelectionManager(this.scene, this.gizmo)

    // Default scene content
    this.env = new DefaultEnvironment()
    this.scene.add(this.env)

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
        this.doRemove(item)
        pushCommand({
          undo: () => {
            this.doAdd(item.name, item.object, item.source)
            if (wasSelected) sceneState.selected = sceneState.objects[sceneState.objects.length - 1]
          },
          redo: () => this.doRemove(item),
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

    // Resize
    this.ro = new ResizeObserver(() => {
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight
      this.camera.updateProjectionMatrix()
    })
    this.ro.observe(canvas)

    this.animate()
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
    const item: SceneObject = {
      kind: 'object',
      id: crypto.randomUUID(),
      name: uniqueName,
      object: obj,
      visible: true,
      locked: false,
      source,
    }
    sceneState.objects = [...sceneState.objects, item]

    // Apply all visible projections to the new object
    for (const p of sceneState.projections) {
      if (p.visible) p.projection.project(obj)
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

    // Project onto all visible scene objects
    for (const obj of sceneState.objects) {
      if (obj.visible) {
        projection.project(obj.object)
      }
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

  getCameraState() {
    return {
      position: this.camera.position,
      target: this.rig.target,
      fov: this.camera.fov,
    }
  }

  // ── Render loop ──

  private animate() {
    this.animId = requestAnimationFrame(() => this.animate())
    this.clock.update()
    const deltaMs = this.clock.getDelta() * 1000

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

    this.selectionManager.update()

    for (const p of sceneState.projections) {
      if (p.visible) p.projection.update(this.renderer, this.scene)
    }

    // Sync grid visibility and clear color from state
    this.env.grid.visible = sceneState.showGrid
    if (this.env.grid.visible) this.env.grid.update(this.camera)
    this.renderer.setClearColor(sceneState.clearColor)

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    if (sceneState.tool === 'aim') this.aimController.exit()
    setSceneActions(null)
    cancelAnimationFrame(this.animId)
    this.ro.disconnect()
    this.ac.abort()
    this.aimController.dispose()
    this.pickingController.dispose()
    this.gizmo.dispose()
    this.selectionManager.dispose()
    for (const p of sceneState.projections) {
      p.projection.dispose()
    }
    this.renderer.dispose()
  }
}
