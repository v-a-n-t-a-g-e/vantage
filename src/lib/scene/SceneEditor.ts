import * as THREE from 'three'
import { sceneState, setSceneActions } from '@/lib/sceneState.svelte.ts'
import type { SceneObject, SceneObjectSource } from '@/lib/sceneState.svelte.ts'
import { pushCommand, clearHistory } from '@/lib/history.svelte.ts'
import { loadGLTF } from '@/lib/gltfLoader.ts'
import { DefaultEnvironment } from '@/lib/scene/DefaultEnvironment.ts'
import { CameraRig } from '@/lib/scene/CameraRig.ts'
import { TransformGizmo } from '@/lib/scene/TransformGizmo.ts'
import { themeColors } from '@/lib/scene/themeColors.ts'

export class SceneEditor {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private rig: CameraRig
  private gizmo: TransformGizmo
  private hoverHelper: THREE.BoxHelper | null = null
  private lastSelected: SceneObject | null = null
  private lastHovered: SceneObject | null = null
  private lastMode = sceneState.transformMode
  private animId = 0
  private ro: ResizeObserver

  constructor(canvas: HTMLCanvasElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.setClearColor(0xf3e7fd)

    // Scene & camera
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100000)
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
        this.gizmo.detach()
        sceneState.objects = []
        sceneState.selected = null
        sceneState.hovered = null
        clearHistory()
      },
      addObjectSilent: (name, obj, source) => {
        return this.doAdd(name, obj, source)
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
      return sceneState.objects.find((item) => {
        let node: THREE.Object3D | null = hits[0].object
        while (node) {
          if (node === item.object) return true
          node = node.parent
        }
        return false
      }) ?? null
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
        sceneState.hovered = null
        return
      }
      if (this.gizmo.axis !== null) return
      const hit = pick(e.clientX, e.clientY)
      sceneState.hovered = hit === sceneState.selected ? null : hit
    })

    canvas.addEventListener('pointerleave', () => {
      sceneState.hovered = null
    })

    canvas.addEventListener('pointerup', (e) => {
      if (isDragging) return
      if (this.gizmo.axis !== null) return
      sceneState.selected = pick(e.clientX, e.clientY)
      sceneState.hovered = null
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
    sceneState.objects = [{
      id: crypto.randomUUID(),
      name: box.name,
      object: box,
      visible: box.visible,
      source: { kind: 'primitive', geometryType: 'box' },
    }]
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
    return item
  }

  private doRemove(item: SceneObject) {
    const obj = item.object
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

  private async handleFiles(files: FileList | null | undefined) {
    if (!files) return
    for (const file of files) {
      if (!/\.(gltf|glb)$/i.test(file.name)) continue
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

    // Selection changes
    if (sceneState.selected !== this.lastSelected) {
      this.lastSelected = sceneState.selected
      if (this.lastSelected) {
        this.gizmo.attach(this.lastSelected.object)
      } else {
        this.gizmo.detach()
      }
    }

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

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    setSceneActions(null)
    cancelAnimationFrame(this.animId)
    this.ro.disconnect()
    this.gizmo.dispose()
    this.renderer.dispose()
  }
}
