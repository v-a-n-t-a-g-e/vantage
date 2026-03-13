<script>
  import { onMount } from 'svelte'
  import * as THREE from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  import { TransformControls } from 'three/addons/controls/TransformControls.js'
  import { sceneState } from '@/lib/sceneState.svelte.js'
  import { pushCommand } from '@/lib/history.svelte.js'

  let canvas

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
    const _cc = (v) => new THREE.Color(_cs.getPropertyValue(v).trim())
    transform.setColors(
      _cc('--color-axis-x'),
      _cc('--color-axis-y'),
      _cc('--color-axis-z'),
      _cc('--color-axis-x')
    )
    const _gizmo = /** @type {any} */ (transform)._gizmo
    const _origGizmoUpdate = _gizmo.updateMatrixWorld.bind(_gizmo)
    _gizmo.updateMatrixWorld = function (force) {
      _origGizmoUpdate(force)
      if (this.axis) {
        const handles = [...this.gizmo[this.mode].children, ...this.helper[this.mode].children]
        for (const handle of handles) {
          if (!handle.material?._color) continue
          const isActive =
            handle.name === this.axis || this.axis.split('').some((a) => handle.name === a)
          if (isActive) {
            handle.material.color.copy(handle.material._color)
          } else {
            handle.material.opacity = handle.material._opacity * 0.15
          }
        }
      }
    }
    let dragSnapshot = /** @type {{ position: any, rotation: any, scale: any } | null} */ (null)
    transform.addEventListener('dragging-changed', (e) => {
      orbit.enabled = !e.value
      const obj = sceneState.selected?.object
      if (e.value) {
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
          },
          redo: () => {
            obj.position.copy(after.position)
            obj.rotation.copy(after.rotation)
            obj.scale.copy(after.scale)
          },
        })
      }
    })
    const tcHelper = transform.getHelper()
    scene.add(tcHelper)

    // Objects
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    )
    box.name = 'Box'
    scene.add(box)

    const grid = new THREE.PolarGridHelper(20, 8, 8, 64)
    grid.name = 'Polar Grid'
    scene.add(grid)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    ambient.name = 'Ambient Light'
    scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.name = 'Directional Light'
    dirLight.position.set(10, 20, 10)
    scene.add(dirLight)

    const dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 2)
    scene.add(dirLightHelper)

    // Expose named objects (skip internal helpers)
    sceneState.objects = scene.children
      .filter((o) => o !== tcHelper && o !== dirLightHelper)
      .map((o) => ({ name: o.name, object: o, visible: o.visible }))

    // Resize
    const ro = new ResizeObserver(() => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
      camera.aspect = canvas.clientWidth / canvas.clientHeight
      camera.updateProjectionMatrix()
    })
    ro.observe(canvas)

    // Animate — poll sceneState for selection/mode changes
    let boxHelper = null
    let lastSelected = null
    let lastMode = sceneState.transformMode

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      orbit.update()

      if (sceneState.selected !== lastSelected) {
        lastSelected = sceneState.selected
        if (boxHelper) {
          scene.remove(boxHelper)
          boxHelper = null
        }
        if (lastSelected) {
          transform.attach(lastSelected.object)
          boxHelper = new THREE.BoxHelper(lastSelected.object, 0x01ff00)
          scene.add(boxHelper)
        } else {
          transform.detach()
        }
      }

      if (sceneState.transformMode !== lastMode) {
        lastMode = sceneState.transformMode
        transform.setMode(lastMode)
      }

      if (boxHelper) boxHelper.update()
      dirLightHelper.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      transform.dispose()
      renderer.dispose()
    }
  })
</script>

<canvas class="w-full h-full block" bind:this={canvas}></canvas>
