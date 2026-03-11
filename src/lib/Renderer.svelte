<script>
  import { onMount } from 'svelte'
  import * as THREE from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  import { sceneState } from '@/lib/sceneState.svelte.js'

  let canvas

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    )
    camera.position.set(18, 14, 18)
    camera.lookAt(0, 0, 0)

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

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

    sceneState.objects = scene.children.map((obj) => ({
      name: obj.name,
      object: obj,
      visible: obj.visible,
    }))

    const resizeObserver = new ResizeObserver(() => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    resizeObserver.observe(canvas)

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      resizeObserver.disconnect()
      renderer.dispose()
    }
  })
</script>

<canvas class="w-full h-full block" bind:this={canvas}></canvas>
