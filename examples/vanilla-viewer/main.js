import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  deserializeScene,
  deserializeProjections,
  ProjectionHelper,
  UI_LAYER,
} from 'vantage'

// ── Renderer ──

const canvas = document.getElementById('viewport')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.setClearColor(0xf0f0f0)

// ── Scene & Camera ──

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100000,
)
camera.layers.enable(UI_LAYER)

// ── Lights ──

const ambient = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambient)

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(10, 20, 10)
scene.add(dirLight)

// ── OrbitControls ──

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// ── State ──

const objects = []
const projections = []

// ── Load demo project ──

async function loadDemo() {
  const basePath = './demo'

  /** Fetch a file from the demo project by relative path */
  async function readFile(path) {
    const res = await fetch(`${basePath}/${path}`)
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
    const blob = await res.blob()
    const name = path.split('/').pop()
    return new File([blob], name)
  }

  // Fetch and parse the manifest
  const res = await fetch(`${basePath}/scene.json`)
  const manifest = await res.json()

  // Deserialize scene objects
  const sceneObjects = await deserializeScene(manifest, readFile)
  for (const obj of sceneObjects) {
    scene.add(obj.object)
    objects.push(obj)
  }

  // Deserialize projections
  if (manifest.projections?.length) {
    const projItems = await deserializeProjections(
      manifest.projections,
      readFile,
    )
    for (const p of projItems) {
      scene.add(p.projection)

      // Apply projection to all visible scene objects
      for (const obj of objects) {
        if (obj.visible) {
          p.projection.project(obj.object)
        }
      }

      // Create frustum helper
      const helper = new ProjectionHelper(p.projection)
      scene.add(helper)

      projections.push({ ...p, helper })
    }
  }

  // Apply camera state from manifest
  if (manifest.camera) {
    camera.position.set(...manifest.camera.position)
    camera.fov = manifest.camera.fov
    camera.updateProjectionMatrix()
    controls.target.set(...manifest.camera.target)
    controls.update()
  }

  // Build the UI panel
  buildUI()

  // Hide loading indicator
  document.getElementById('loading').classList.add('hidden')
}

// ── UI ──

function buildUI() {
  const objectList = document.getElementById('object-list')
  for (const obj of objects) {
    const li = document.createElement('li')

    const name = document.createElement('span')
    name.textContent = obj.name
    li.appendChild(name)

    const btn = document.createElement('button')
    btn.className = 'toggle-btn'
    btn.textContent = obj.visible ? 'Hide' : 'Show'
    if (!obj.visible) btn.classList.add('off')
    btn.addEventListener('click', () => {
      obj.visible = !obj.visible
      obj.object.visible = obj.visible
      btn.textContent = obj.visible ? 'Hide' : 'Show'
      btn.classList.toggle('off', !obj.visible)
    })
    li.appendChild(btn)

    objectList.appendChild(li)
  }

  const projectionList = document.getElementById('projection-list')
  for (const p of projections) {
    const li = document.createElement('li')

    const name = document.createElement('span')
    name.textContent = p.name
    li.appendChild(name)

    const btn = document.createElement('button')
    btn.className = 'toggle-btn'
    btn.textContent = p.visible ? 'Hide' : 'Show'
    if (!p.visible) btn.classList.add('off')
    btn.addEventListener('click', () => {
      p.visible = !p.visible
      p.projection.visible = p.visible
      if (p.visible) {
        for (const obj of objects) {
          if (obj.visible) p.projection.project(obj.object)
        }
      } else {
        for (const obj of objects) {
          p.projection.unproject(obj.object)
        }
      }
      if (p.helper) p.helper.visible = p.visible
      btn.textContent = p.visible ? 'Hide' : 'Show'
      btn.classList.toggle('off', !p.visible)
    })
    li.appendChild(btn)

    projectionList.appendChild(li)
  }
}

// ── Resize ──

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
})

// ── Render loop ──

function animate() {
  requestAnimationFrame(animate)
  controls.update()

  // Update projection depth maps and material uniforms
  for (const p of projections) {
    if (p.visible) {
      p.projection.update(renderer, scene)
    }
  }

  // Update projection helpers
  for (const p of projections) {
    if (p.helper?.visible) {
      p.helper.update()
    }
  }

  renderer.render(scene, camera)
}

// ── Start ──

loadDemo()
  .then(() => animate())
  .catch((err) => {
    console.error('Failed to load demo:', err)
    document.getElementById('loading').textContent =
      'Failed to load scene. Check console.'
  })
