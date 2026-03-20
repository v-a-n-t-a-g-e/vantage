import * as THREE from 'three'
import { sceneState, setSceneActions, TRANSFORM_TOOLS } from '@/lib/sceneState.svelte.ts'
import type {
  SceneObject,
  SceneObjectSource,
  ProjectionItem,
  TransformTool,
  Tool,
} from '@/lib/sceneState.svelte.ts'
import { pushCommand, clearHistory } from '@/lib/history.svelte.ts'
import { loadGLTF } from '@/lib/gltfLoader.ts'
import { DefaultEnvironment } from '@/lib/scene/DefaultEnvironment.ts'
import { CameraRig } from '@/lib/scene/CameraRig.ts'
import { TransformGizmo } from '@/lib/scene/TransformGizmo.ts'
import { themeColors } from '@/lib/scene/themeColors.ts'
import { UI_LAYER } from '@/lib/scene/layers.ts'
import { VantageProjection, ProjectionHelper, loadTexture } from '@/lib/scene/projection'

// Reused vectors for aim mode
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _worldUp = new THREE.Vector3(0, 1, 0)
const _euler = new THREE.Euler(0, 0, 0, 'YXZ')

export class SceneEditor {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private rig: CameraRig
  private gizmo: TransformGizmo
  private hoverHelper: THREE.BoxHelper | null = null
  private selectionHelper: THREE.BoxHelper | null = null
  private projectionHelper: ProjectionHelper | null = null
  private lastSelected: SceneObject | ProjectionItem | null = null
  private lastHovered: SceneObject | null = null
  private lastTool: Tool = 'cursor'
  private animId = 0
  private ro: ResizeObserver
  private canvas: HTMLCanvasElement
  private clock = new THREE.Timer()
  private env: DefaultEnvironment

  // Aim mode state
  private aimHeldKeys = new Set<string>()
  private aimIsDragging = false
  private aimDragLast = { x: 0, y: 0 }
  private aimOrbitPositionBefore: THREE.Vector3 | null = null
  private aimOrbitTargetBefore: THREE.Vector3 | null = null
  // Per-interaction snapshots for granular undo
  private aimDragRotationBefore: THREE.Euler | null = null
  private aimKeyPositionBefore: THREE.Vector3 | null = null

  private static AIM_MOVEMENT_KEYS = new Set([
    'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyR', 'KeyF',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ])

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
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100000
    )
    this.camera.position.set(18, 14, 18)
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
    gizmoHelper.traverse(o => o.layers.set(UI_LAYER))
    this.scene.add(gizmoHelper)

    // Default scene content
    this.env = new DefaultEnvironment()
    this.scene.add(this.env)

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
        if (sceneState.tool === 'aim') this.exitAimMode()
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
      enterAimMode: () => this.enterAimMode(),
      exitAimMode: () => this.exitAimMode(),
    })

    // Click-to-select + hover in viewport
    const raycaster = new THREE.Raycaster()
    raycaster.layers.enable(UI_LAYER)
    let pointerDownPos = { x: 0, y: 0 }
    let isDragging = false

    const pick = (clientX: number, clientY: number): SceneObject | ProjectionItem | null => {
      const rect = canvas.getBoundingClientRect()
      raycaster.setFromCamera(
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
        const plane = (item.projection as unknown as { projectionPlane: THREE.Mesh | null })
          .projectionPlane
        if (!item.locked && item.visible && plane?.visible) {
          projPlaneTargets.push(plane)
        }
      }

      const objHits = raycaster.intersectObjects(objTargets, false)
      const projHits = raycaster.intersectObjects(projPlaneTargets, false)

      // Filter projection hits to front face only (texture side)
      const frontProjHits = projHits.filter((hit) => {
        if (!hit.face) return false
        const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        return worldNormal.dot(raycaster.ray.direction) < 0
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
      if (sceneState.tool === 'aim') return
      if (isDragging) return
      if (this.gizmo.axis !== null) return
      sceneState.selected = pick(e.clientX, e.clientY)
    })

    // Aim mode mouse handlers
    canvas.addEventListener('mousedown', this.onAimMouseDown)
    canvas.addEventListener('mousemove', this.onAimMouseMove)
    canvas.addEventListener('mouseup', this.onAimMouseUp)
    canvas.addEventListener('mouseleave', this.onAimMouseUp)
    document.addEventListener('keydown', this.onAimKeydown)
    document.addEventListener('keyup', this.onAimKeyup)

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

  // ── Aim mode ──

  private enterAimMode() {
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
    if (!proj) return
    this.lastTool = 'aim'

    // Save orbit state so we can restore it on exit
    this.aimOrbitPositionBefore = this.camera.position.clone()
    this.aimOrbitTargetBefore = this.rig.target.clone()

    // Sync orbit camera to projection viewpoint (strip roll to keep camera upright)
    this.camera.position.copy(proj.projection.getWorldPosition(new THREE.Vector3()))
    _euler.setFromQuaternion(proj.projection.quaternion)
    _euler.z = 0
    this.camera.quaternion.setFromEuler(_euler)

    // Disable orbit controls and gizmo
    this.rig.enabled = false
    this.gizmo.detach()

    this.aimHeldKeys.clear()
    this.aimIsDragging = false
    this.aimDragRotationBefore = null
    this.aimKeyPositionBefore = null
  }

  private exitAimMode() {
    if (sceneState.tool === 'aim') sceneState.tool = 'cursor'
    this.lastTool = sceneState.tool
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null

    // Flush any in-progress interactions before leaving
    if (proj) {
      this.flushAimDragCommand(proj.projection)
      this.flushAimKeyCommand(proj.projection)
    }

    this.aimHeldKeys.clear()
    this.aimIsDragging = false

    // Re-enable orbit controls and restore pre-aim camera position/target
    this.rig.enabled = true
    if (this.aimOrbitPositionBefore && this.aimOrbitTargetBefore) {
      this.camera.position.copy(this.aimOrbitPositionBefore)
      this.rig.target.copy(this.aimOrbitTargetBefore)
      this.rig.enableDamping = false
      this.rig.update()
      this.rig.enableDamping = true
    }
    this.aimOrbitPositionBefore = null
    this.aimOrbitTargetBefore = null

    // Re-attach gizmo
    if (proj) {
      this.gizmo.attach(proj.projection)
    }
  }

  private flushAimDragCommand(p: VantageProjection) {
    if (!this.aimDragRotationBefore) return
    const before = this.aimDragRotationBefore
    const after = p.rotation.clone()
    this.aimDragRotationBefore = null
    if (!before.equals(after)) {
      pushCommand({
        undo: () => { p.rotation.copy(before); sceneState.transformRevision++ },
        redo: () => { p.rotation.copy(after); sceneState.transformRevision++ },
      })
    }
  }

  private flushAimKeyCommand(p: VantageProjection) {
    if (!this.aimKeyPositionBefore) return
    const before = this.aimKeyPositionBefore
    const after = p.position.clone()
    this.aimKeyPositionBefore = null
    if (!before.equals(after)) {
      pushCommand({
        undo: () => { p.position.copy(before); sceneState.transformRevision++ },
        redo: () => { p.position.copy(after); sceneState.transformRevision++ },
      })
    }
  }

  private updateAimMovement(deltaMs: number) {
    if (this.aimHeldKeys.size === 0) return
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

    if (this.aimHeldKeys.has('KeyW') || this.aimHeldKeys.has('ArrowUp')) {
      pos.addScaledVector(_forward, speed)
      moved = true
    }
    if (this.aimHeldKeys.has('KeyS') || this.aimHeldKeys.has('ArrowDown')) {
      pos.addScaledVector(_forward, -speed)
      moved = true
    }
    if (this.aimHeldKeys.has('KeyA') || this.aimHeldKeys.has('ArrowLeft')) {
      pos.addScaledVector(_right, -speed)
      moved = true
    }
    if (this.aimHeldKeys.has('KeyD') || this.aimHeldKeys.has('ArrowRight')) {
      pos.addScaledVector(_right, speed)
      moved = true
    }
    if (this.aimHeldKeys.has('KeyR')) {
      pos.y += speed
      moved = true
    }
    if (this.aimHeldKeys.has('KeyF')) {
      pos.y -= speed
      moved = true
    }

    if (moved) {
      proj.projection.position.copy(pos)
      proj.projection.updateMatrixWorld()
      sceneState.transformRevision++
    }
  }

  private onAimMouseDown = (event: MouseEvent) => {
    if (sceneState.tool !== 'aim') return
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
    if (!proj) return
    this.aimIsDragging = true
    this.aimDragLast = { x: event.clientX, y: event.clientY }
    this.aimDragRotationBefore = proj.projection.rotation.clone()
  }

  private onAimMouseMove = (event: MouseEvent) => {
    if (sceneState.tool !== 'aim' || !this.aimIsDragging) return
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
    if (!proj) return

    const dx = event.clientX - this.aimDragLast.x
    const dy = event.clientY - this.aimDragLast.y
    this.aimDragLast = { x: event.clientX, y: event.clientY }

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

  private onAimMouseUp = () => {
    if (!this.aimIsDragging) return
    this.aimIsDragging = false
    const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
    if (proj) this.flushAimDragCommand(proj.projection)
  }

  private onAimKeydown = (event: KeyboardEvent) => {
    if (sceneState.tool !== 'aim') return
    if (event.code === 'Escape') {
      this.exitAimMode()
      return
    }
    this.aimHeldKeys.add(event.code)
    // Snapshot position when first movement key is pressed
    if (SceneEditor.AIM_MOVEMENT_KEYS.has(event.code) && !this.aimKeyPositionBefore) {
      const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
      if (proj) this.aimKeyPositionBefore = proj.projection.position.clone()
    }
  }

  private onAimKeyup = (event: KeyboardEvent) => {
    this.aimHeldKeys.delete(event.code)
    // Push position command when all movement keys are released
    if (SceneEditor.AIM_MOVEMENT_KEYS.has(event.code) && this.aimKeyPositionBefore) {
      const hasMovementKeys = [...this.aimHeldKeys].some(k => SceneEditor.AIM_MOVEMENT_KEYS.has(k))
      if (!hasMovementKeys) {
        const proj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
        if (proj) this.flushAimKeyCommand(proj.projection)
      }
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
      this.exitAimMode()
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
    if (!files) return
    for (const file of files) {
      if (/\.(gltf|glb)$/i.test(file.name)) {
        const { group, blob } = await loadGLTF(file)
        const name = file.name.replace(/\.(gltf|glb)$/i, '')
        const source: SceneObjectSource = {
          kind: 'imported',
          relativePath: `models/${file.name}`,
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
          projection.position.y = 1.5
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
        this.enterAimMode()
      } else if (prev === 'aim') {
        this.exitAimMode()
      }
    }

    if (sceneState.tool === 'aim') {
      this.updateAimMovement(deltaMs)
      // Sync camera from projection (strip roll to keep camera upright)
      const aimProj = sceneState.selected?.kind === 'projection' ? sceneState.selected : null
      if (aimProj) {
        this.camera.position.copy(aimProj.projection.position)
        _euler.setFromQuaternion(aimProj.projection.quaternion)
        _euler.z = 0
        this.camera.quaternion.setFromEuler(_euler)
      }
    } else {
      this.rig.tick()
    }

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
    if (sceneState.tool === 'aim') this.exitAimMode()
    setSceneActions(null)
    cancelAnimationFrame(this.animId)
    this.ro.disconnect()
    this.canvas.removeEventListener('mousedown', this.onAimMouseDown)
    this.canvas.removeEventListener('mousemove', this.onAimMouseMove)
    this.canvas.removeEventListener('mouseup', this.onAimMouseUp)
    this.canvas.removeEventListener('mouseleave', this.onAimMouseUp)
    document.removeEventListener('keydown', this.onAimKeydown)
    document.removeEventListener('keyup', this.onAimKeyup)
    this.gizmo.dispose()
    if (this.projectionHelper) this.scene.remove(this.projectionHelper)
    if (this.selectionHelper) this.scene.remove(this.selectionHelper)
    for (const p of sceneState.projections) {
      p.projection.dispose()
    }
    this.renderer.dispose()
  }
}
