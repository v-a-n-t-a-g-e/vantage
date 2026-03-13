<script lang="ts">
  import { onMount } from 'svelte'
  import * as THREE from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  import { TransformControls } from 'three/addons/controls/TransformControls.js'
  import { sceneState, sceneActions, setSceneActions } from '@/lib/sceneState.svelte.ts'
  // sceneActions.value is the live reactive getter; setSceneActions mutates the backing state
  import { pushCommand } from '@/lib/history.svelte.ts'
  import { loadGLTF } from '@/lib/gltfLoader.ts'

  let canvas: HTMLCanvasElement

  async function handleFiles(files: FileList | null | undefined) {
    if (!files) return
    for (const file of files) {
      if (!/\.(gltf|glb)$/i.test(file.name)) continue
      const group = await loadGLTF(file)
      const name = file.name.replace(/\.(gltf|glb)$/i, '')
      sceneActions.value?.addObject(name, group)
    }
  }

  onMount(() => {
    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    renderer.setClearColor(0xf3e7fd)

    // Scene & camera
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    )
    camera.position.set(18, 14, 18)
    camera.lookAt(0, 0, 0)

    // Controls
    const orbit = new OrbitControls(camera, canvas)
    orbit.enableDamping = true

    // TransformControls — r168+: add getHelper() to scene, not the control itself
    const transform = new TransformControls(camera, canvas)
    const _cs = getComputedStyle(document.documentElement)
    const _cc = (v: string) => new THREE.Color(_cs.getPropertyValue(v).trim())
    transform.setColors(
      _cc('--color-axis-x'),
      _cc('--color-axis-y'),
      _cc('--color-axis-z'),
      _cc('--color-axis-x')
    )
    const _gizmo = (transform as any)._gizmo
    const _origGizmoUpdate = _gizmo.updateMatrixWorld.bind(_gizmo)
    _gizmo.updateMatrixWorld = function (force: boolean) {
      _origGizmoUpdate(force)
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
    let dragSnapshot: {
      position: THREE.Vector3
      rotation: THREE.Euler
      scale: THREE.Vector3
    } | null = null
    transform.addEventListener('change', () => {
      sceneState.transformRevision++
    })
    transform.addEventListener('dragging-changed', (e) => {
      orbit.enabled = !(e as any).value
      const obj = sceneState.selected?.object
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
    const tcHelper = transform.getHelper()
    scene.add(tcHelper)

    // Default scene objects (not in assets panel)
    const grid = new THREE.PolarGridHelper(20, 8, 8, 64)
    scene.add(grid)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(10, 20, 10)
    scene.add(dirLight)

    // User-editable objects
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    )
    box.name = 'Box'
    scene.add(box)

    sceneState.objects = [{ name: box.name, object: box, visible: box.visible }]

    // Register scene actions
    setSceneActions({
      addObject(name, obj) {
        // Deduplicate name
        const existing = sceneState.objects.map((o) => o.name)
        let uniqueName = name
        let i = 1
        while (existing.includes(uniqueName)) {
          uniqueName = `${name} (${i++})`
        }
        obj.name = uniqueName
        scene.add(obj)
        sceneState.objects = [...sceneState.objects, { name: uniqueName, object: obj, visible: true }]
      },
      removeObject(item) {
        scene.remove(item.object)
        if (sceneState.selected === item) {
          transform.detach()
          sceneState.selected = null
        }
        sceneState.objects = sceneState.objects.filter((o) => o !== item)
      },
    })

    // Resize
    const ro = new ResizeObserver(() => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
      camera.aspect = canvas.clientWidth / canvas.clientHeight
      camera.updateProjectionMatrix()
    })
    ro.observe(canvas)

    // Animate — poll sceneState for selection/mode changes
    let lastSelected = sceneState.selected
    let lastMode = sceneState.transformMode

    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)
      orbit.update()

      if (sceneState.selected !== lastSelected) {
        lastSelected = sceneState.selected
        if (lastSelected) {
          transform.attach(lastSelected.object)
        } else {
          transform.detach()
        }
      }

      if (sceneState.transformMode !== lastMode) {
        lastMode = sceneState.transformMode
        transform.setMode(lastMode)
      }

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      setSceneActions(null)
      cancelAnimationFrame(animId)
      ro.disconnect()
      transform.dispose()
      renderer.dispose()
    }
  })
</script>

<canvas
  class="w-full h-full block"
  bind:this={canvas}
  ondragover={(e) => e.preventDefault()}
  ondrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer?.files) }}
></canvas>
