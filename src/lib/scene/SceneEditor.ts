import * as THREE from 'three'
import { sceneState, setSceneActions } from '@/lib/sceneState.svelte.ts'
import type { SceneObject, SceneObjectSource, ProjectionItem } from '@/lib/sceneState.svelte.ts'
import { pushCommand, clearHistory } from '@/lib/history.svelte.ts'
import { loadGLTF } from '@/lib/gltfLoader.ts'
import { DefaultEnvironment } from '@/lib/scene/DefaultEnvironment.ts'
import { CameraRig } from '@/lib/scene/CameraRig.ts'
import { TransformGizmo } from '@/lib/scene/TransformGizmo.ts'
import { themeColors } from '@/lib/scene/themeColors.ts'
import { VantageProjection, loadTexture } from 'vantage-renderer'

/**
 * VantageProjection._applyMaterial wraps mesh.material into an array [mat]
 * and adds a projection group at materialIndex = material.length.
 * This breaks meshes whose groups reference materialIndex > 0 while using a
 * single material (e.g. BoxGeometry has groups with materialIndex 0‑5).
 * After wrapping, only index 0 is valid — indices 1‑5 become undefined.
 *
 * Fix: before projecting, collapse all single-material groups to materialIndex 0.
 */
function normalizeGroupsForProjection(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    if (Array.isArray(mesh.material) || mesh.geometry.groups.length === 0) return

    // Single material but groups with varying materialIndex → remap to 0
    const needsRemap = mesh.geometry.groups.some((g) => g.materialIndex !== 0)
    if (needsRemap) {
      for (const g of mesh.geometry.groups) {
        g.materialIndex = 0
      }
    }
  })
}

export class SceneEditor {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private rig: CameraRig
  private gizmo: TransformGizmo
  private hoverHelper: THREE.BoxHelper | null = null
  private projectionHelper: THREE.CameraHelper | null = null
  private lastSelected: SceneObject | null = null
  private lastSelectedProjection: ProjectionItem | null = null
  private lastHovered: SceneObject | null = null
  private lastMode = sceneState.transformMode
  private animId = 0
  private ro: ResizeObserver

  constructor(canvas: HTMLCanvasElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.setClearColor(0xf3e7fd)

    // Scene & camera
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100000
    )
    this.camera.position.set(18, 14, 18)
    this.camera.lookAt(0, 0, 0)

    // Controls
    this.rig = new CameraRig(this.camera, canvas)
    this.rig.enableDamping = true

    this.gizmo = new TransformGizmo(this.camera, canvas, this.rig)
    this.scene.add(this.gizmo.getHelper())

    // Default scene content
    this.scene.add(new DefaultEnvironment())

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
        const wasSelected = sceneState.selected?.object === item.object
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
        sceneState.selectedProjection = null
        sceneState.hovered = null
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
        const wasSelected = sceneState.selectedProjection?.projection === item.projection
        this.doRemoveProjection(item)
        pushCommand({
          undo: () => {
            this.doAddProjection(item.name, item.projection, item.imagePath, item.imageBlob)
            if (wasSelected)
              sceneState.selectedProjection =
                sceneState.projections[sceneState.projections.length - 1]
          },
          redo: () => this.doRemoveProjection(item),
        })
      },
      addProjectionSilent: (name, projection, imagePath) => {
        return this.doAddProjection(name, projection, imagePath)
      },
    })

    // Click-to-select + hover in viewport
    const raycaster = new THREE.Raycaster()
    let pointerDownPos = { x: 0, y: 0 }
    let isDragging = false

    const pick = (clientX: number, clientY: number): SceneObject | null => {
      const rect = canvas.getBoundingClientRect()
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1
        ),
        this.camera
      )
      const targets: THREE.Object3D[] = []
      for (const item of sceneState.objects) {
        item.object.traverse((child) => targets.push(child))
      }
      const hits = raycaster.intersectObjects(targets, false)
      if (hits.length === 0) return null
      return (
        sceneState.objects.find((item) => {
          let node: THREE.Object3D | null = hits[0].object
          while (node) {
            if (node === item.object) return true
            node = node.parent
          }
          return false
        }) ?? null
      )
    }

    canvas.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY }
      isDragging = false
    })

    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons > 0) {
        // Mouse button held — user is orbiting/panning, clear and skip hover
        const dx = e.clientX - pointerDownPos.x
        const dy = e.clientY - pointerDownPos.y
        if (Math.hypot(dx, dy) > 5) isDragging = true
        return
      }
    })

    canvas.addEventListener('pointerup', (e) => {
      if (isDragging) return
      if (this.gizmo.axis !== null) return
      sceneState.selected = pick(e.clientX, e.clientY)
      sceneState.selectedProjection = null
    })

    // Drag-and-drop file import
    canvas.addEventListener('dragover', (e) => e.preventDefault())
    canvas.addEventListener('drop', (e) => {
      e.preventDefault()
      this.handleFiles(e.dataTransfer?.files)
    })

    // Resize
    this.ro = new ResizeObserver(() => {
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight
      this.camera.updateProjectionMatrix()
    })
    this.ro.observe(canvas)

    this.animate()
  }

  private addDefaultBox() {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    )
    box.name = 'Box'
    this.scene.add(box)
    sceneState.objects = [
      {
        id: crypto.randomUUID(),
        name: box.name,
        object: box,
        visible: box.visible,
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
      id: crypto.randomUUID(),
      name: uniqueName,
      object: obj,
      visible: true,
      source,
    }
    sceneState.objects = [...sceneState.objects, item]

    // Apply all visible projections to the new object
    if (sceneState.projections.length > 0) {
      normalizeGroupsForProjection(obj)
      for (const p of sceneState.projections) {
        if (p.visible) p.projection.project(obj)
      }
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
    if (sceneState.selected?.object === obj) {
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

    // Normalize geometry groups and project onto all visible scene objects
    for (const obj of sceneState.objects) {
      if (obj.visible) {
        normalizeGroupsForProjection(obj.object)
        projection.project(obj.object)
      }
    }

    const item: ProjectionItem = {
      id: crypto.randomUUID(),
      name: uniqueName,
      projection,
      visible: true,
      imageBlob,
      imagePath,
    }
    sceneState.projections = [...sceneState.projections, item]
    return item
  }

  private doRemoveProjection(item: ProjectionItem) {
    // Unproject from all objects
    for (const obj of sceneState.objects) {
      item.projection.unproject(obj.object)
    }

    this.scene.remove(item.projection)

    if (sceneState.selectedProjection?.projection === item.projection) {
      this.gizmo.detach()
      sceneState.selectedProjection = null
    }

    item.projection.dispose()
    sceneState.projections = sceneState.projections.filter((p) => p.projection !== item.projection)
  }

  private async handleFiles(files: FileList | null | undefined) {
    if (!files) return
    for (const file of files) {
      if (/\.(gltf|glb)$/i.test(file.name)) {
        const { group, blob } = await loadGLTF(file)
        const name = file.name.replace(/\.(gltf|glb)$/i, '')
        const source: SceneObjectSource = {
          kind: 'imported',
          relativePath: `geometry/${file.name}`,
          originalBlob: blob,
        }
        const item = this.doAdd(name, group, source)
        pushCommand({
          undo: () => this.doRemove(item),
          redo: () => this.doAdd(item.name, item.object, item.source),
        })
      } else if (/\.(jpe?g|png|webp)$/i.test(file.name)) {
        const url = URL.createObjectURL(file)
        try {
          const texture = await loadTexture(url)
          const projection = new VantageProjection({ texture })
          const name = file.name.replace(/\.(jpe?g|png|webp)$/i, '')
          const imagePath = `projections/${file.name}`
          const item = this.doAddProjection(name, projection, imagePath, file)
          pushCommand({
            undo: () => this.doRemoveProjection(item),
            redo: () =>
              this.doAddProjection(item.name, item.projection, item.imagePath, item.imageBlob),
          })
        } finally {
          URL.revokeObjectURL(url)
        }
      }
    }
  }

  getCameraState() {
    return {
      position: this.camera.position,
      target: this.rig.target,
      fov: this.camera.fov,
    }
  }

  private animate() {
    this.animId = requestAnimationFrame(() => this.animate())
    this.rig.tick()

    // Object selection changes
    if (sceneState.selected !== this.lastSelected) {
      this.lastSelected = sceneState.selected
      if (this.lastSelected) {
        this.gizmo.attach(this.lastSelected.object)
      } else if (!sceneState.selectedProjection) {
        this.gizmo.detach()
      }
    }

    // Projection selection changes
    if (sceneState.selectedProjection !== this.lastSelectedProjection) {
      // Clean up old projection helper
      if (this.projectionHelper) {
        this.scene.remove(this.projectionHelper)
        this.projectionHelper = null
      }

      this.lastSelectedProjection = sceneState.selectedProjection
      if (this.lastSelectedProjection) {
        this.gizmo.attach(this.lastSelectedProjection.projection)
        this.projectionHelper = new THREE.CameraHelper(this.lastSelectedProjection.projection)
        this.scene.add(this.projectionHelper)
      } else if (!sceneState.selected) {
        this.gizmo.detach()
      }
    }

    // Update projection helper if it exists
    if (this.projectionHelper) this.projectionHelper.update()

    // Transform mode changes
    if (sceneState.transformMode !== this.lastMode) {
      this.lastMode = sceneState.transformMode
      this.gizmo.setMode(this.lastMode)
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
        this.scene.add(this.hoverHelper)
      }
    }
    if (this.hoverHelper) this.hoverHelper.update()

    // Hide helpers during projection depth pass to avoid feedback loops
    // (VantageProjection._createDepthMap renders the full scene to a render target)
    const gizmoHelper = this.gizmo.getHelper()
    const gizmoWasVisible = gizmoHelper.visible
    const helperWasVisible = this.projectionHelper?.visible ?? false
    const hoverWasVisible = this.hoverHelper?.visible ?? false
    gizmoHelper.visible = false
    if (this.projectionHelper) this.projectionHelper.visible = false
    if (this.hoverHelper) this.hoverHelper.visible = false

    // Update all visible projections
    for (const p of sceneState.projections) {
      if (p.visible) p.projection.update(this.renderer, this.scene)
    }

    // Restore helpers
    gizmoHelper.visible = gizmoWasVisible
    if (this.projectionHelper) this.projectionHelper.visible = helperWasVisible
    if (this.hoverHelper) this.hoverHelper.visible = hoverWasVisible

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    setSceneActions(null)
    cancelAnimationFrame(this.animId)
    this.ro.disconnect()
    this.gizmo.dispose()
    if (this.projectionHelper) this.scene.remove(this.projectionHelper)
    for (const p of sceneState.projections) {
      p.projection.dispose()
    }
    this.renderer.dispose()
  }
}
