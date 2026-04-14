# Building Auxiliary Vantage Apps

Auxiliary apps extend vantage projects with extra functionality — camera transitions, annotations, measurements, etc. They open an existing vantage project (or create one from a 3D model), render the scene, and write their own data back to the project directory as additional JSON files.

This guide covers everything you need to build one using the `@krisenstab/vantage` npm package.

## Project Directory Structure

A vantage project is a directory (or ZIP) with this layout:

```
my-project/
  scene.json              # Scene manifest (objects, projections, camera, settings)
  models/
    building.glb           # 3D model files referenced by scene.json
  projections/
    photo-01.jpg           # Projection images referenced by scene.json
  transitions.json         # Your auxiliary app's data (example)
```

`scene.json` is the only required file. Auxiliary apps should write their own files alongside it (e.g. `transitions.json`, `annotations.json`) rather than modifying `scene.json` itself. This avoids conflicts when switching between tools.

## Quick Start

```ts
import { SceneViewer, openProject } from '@krisenstab/vantage'

const canvas = document.getElementById('viewport') as HTMLCanvasElement
const viewer = new SceneViewer(canvas)

// Open a project from a directory picker
const handle = await openProject()
if (handle) {
  await viewer.openProject(handle.fs.readFile)

  // Write your auxiliary data back
  await handle.fs.writeFile('transitions.json', JSON.stringify(myData, null, 2))
  await handle.save()
}
```

## Opening Projects

The package provides helper functions that return a `ProjectHandle` — a unified interface for reading and writing project files regardless of how the project was opened.

```ts
interface ProjectHandle {
  fs: ProjectFS            // read/write project files
  name: string             // display name
  canSaveInPlace: boolean  // true for native FS, false for ZIP/model import
  save(): Promise<void>    // writes in-place or downloads ZIP
  export(filename?: string): Promise<void>  // always downloads ZIP
}
```

### `openProject()` — Open from a directory

Opens a native directory picker. Returns `null` if the user cancels. Requires the File System Access API (Chromium browsers).

```ts
import { openProject } from '@krisenstab/vantage'

const handle = await openProject()
if (handle) {
  // handle.canSaveInPlace === true
  await viewer.openProject(handle.fs.readFile)
}
```

### `importProject()` — Import from a file

Opens a file picker for `.zip`, `.glb`, or `.gltf` files. A ZIP is loaded as a project directly. A model file scaffolds a minimal project around it (creates a `scene.json` and places the model in `models/`).

```ts
import { importProject } from '@krisenstab/vantage'

const handle = await importProject()
if (handle) {
  // handle.canSaveInPlace === false (memory-based)
  await viewer.openProject(handle.fs.readFile)
}
```

### `onProjectDrop()` — Handle drag-and-drop

Processes a `drop` event, handling directories, ZIP files, and model files. Returns `null` if the drop doesn't contain a supported item.

```ts
import { onProjectDrop } from '@krisenstab/vantage'

const dropZone = document.getElementById('drop-zone')!

dropZone.addEventListener('dragover', (e) => e.preventDefault())
dropZone.addEventListener('drop', async (e) => {
  e.preventDefault()
  const handle = await onProjectDrop(e)
  if (handle) {
    await viewer.openProject(handle.fs.readFile)
  }
})
```

When a directory is dropped, `onProjectDrop` requests `readwrite` permission via the File System Access API, giving full save-in-place support. When a file is dropped, it behaves like `importProject`.

## Saving and Exporting

### `handle.save()`

Saves the project. If opened from a native directory (`canSaveInPlace === true`), data written via `handle.fs.writeFile()` is already persisted — `save()` is a no-op. If the project was imported from a ZIP or model file, `save()` exports and downloads a ZIP.

```ts
// Write your data
await handle.fs.writeFile('transitions.json', JSON.stringify(data, null, 2))

// Save — either in-place or as ZIP download
await handle.save()
```

### `handle.export(filename?)`

Always exports as a ZIP download, regardless of how the project was opened. Useful for "Save As" / "Export" actions.

```ts
await handle.export('my-project.zip')
```

### Standalone helpers

The `saveProject()` and `exportProject()` functions are thin wrappers if you prefer a functional style:

```ts
import { saveProject, exportProject } from '@krisenstab/vantage'

await saveProject(handle)
await exportProject(handle, 'backup.zip')
```

## Supporting Both Workflows

A typical auxiliary app offers both "Open Folder" and "Import File" options:

```ts
import {
  SceneViewer,
  openProject,
  importProject,
  supportsNativeFS,
  type ProjectHandle,
} from '@krisenstab/vantage'

const viewer = new SceneViewer(canvas)
let handle: ProjectHandle | null = null

// Wire up your UI buttons
openFolderBtn.onclick = async () => {
  handle = await openProject()
  if (handle) await viewer.openProject(handle.fs.readFile)
}

importFileBtn.onclick = async () => {
  handle = await importProject()
  if (handle) await viewer.openProject(handle.fs.readFile)
}

saveBtn.onclick = async () => {
  if (!handle) return
  await handle.fs.writeFile('my-data.json', JSON.stringify(data, null, 2))
  await handle.save()
}

// Hide "Open Folder" if native FS isn't available
if (!supportsNativeFS()) {
  openFolderBtn.style.display = 'none'
}
```

## Reading Auxiliary Data

Your app can read its own data back from the project after opening:

```ts
const handle = await openProject()
if (handle) {
  await viewer.openProject(handle.fs.readFile)

  // Load existing auxiliary data if present
  try {
    const file = await handle.fs.readFile('transitions.json')
    const transitions = JSON.parse(await file.text())
  } catch {
    // No existing data — start fresh
  }
}
```

## Recent Projects

The `createRecentProjects` factory creates a per-app recent projects store backed by IndexedDB. Each app uses a unique name so recent lists don't collide between tools.

```ts
import {
  createRecentProjects,
  createHandleFromDirectory,
  openProject,
  type ProjectHandle,
  type RecentProject,
} from '@krisenstab/vantage'

const recents = createRecentProjects('my-transition-tool')
```

### Storing a recent project

After opening a project via `openProject()` or `onProjectDrop()`, store the directory handle:

```ts
const handle = await openProject()
if (handle?.directoryHandle) {
  await recents.add(handle.directoryHandle)
}
```

Only native directory handles can be stored — ZIP and model imports don't have one (`handle.directoryHandle` will be `undefined`).

### Listing and re-opening

```ts
const list = await recents.get() // RecentProject[] — most recent first

async function openRecent(recent: RecentProject) {
  const perm = await recent.handle.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') return
  const handle = createHandleFromDirectory(recent.handle)
  await viewer.openProject(handle.fs.readFile)
  // Store again to move it to the front
  await recents.add(recent.handle)
}
```

### Auto-loading the last project

A common pattern is to automatically re-open the last project on app startup:

```ts
async function autoLoad(): Promise<boolean> {
  const [last] = await recents.get()
  if (!last) return false
  try {
    const perm = await last.handle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') return false
    const handle = createHandleFromDirectory(last.handle)
    await viewer.openProject(handle.fs.readFile)
    return true
  } catch {
    return false
  }
}

// On startup:
const loaded = await autoLoad()
if (!loaded) {
  // Show welcome screen or open picker
}
```

Recent projects require the File System Access API (Chromium browsers). On unsupported browsers, `recents.get()` returns an empty array and `recents.add()` is a silent no-op.

## Creating a Project from a Single 3D Model

`importProject()` handles this automatically when the user selects a `.glb` or `.gltf` file. It:

1. Loads the model with `loadGLTF`
2. Creates a `MemoryFS` with `models/<filename>` and a generated `scene.json`
3. Returns a `ProjectHandle` ready for `viewer.openProject()`

If you need to do this programmatically:

```ts
import { SceneViewer, loadGLTF, serializeScene, createMemoryFS } from '@krisenstab/vantage'

const { group, blob } = await loadGLTF(modelFile)
const viewer = new SceneViewer(canvas)

viewer.loadScene([{ object: group, visible: true }], [])

const fs = createMemoryFS()
const modelPath = `models/${modelFile.name}`
await fs.writeFile(modelPath, blob)

const manifest = serializeScene([{
  kind: 'object',
  id: crypto.randomUUID(),
  name: modelFile.name.replace(/\.\w+$/, ''),
  object: group,
  visible: true,
  locked: false,
  source: { kind: 'imported', relativePath: modelPath },
}])
await fs.writeFile('scene.json', JSON.stringify(manifest, null, 2))
```

## Loading from a URL

For demos or hosted projects, use `createHandleFromFetch` to create a handle backed by HTTP requests. Fetched files are cached internally, so exports include everything that was loaded:

```ts
import { SceneViewer, createHandleFromFetch } from '@krisenstab/vantage'

const handle = createHandleFromFetch('/demo')
await viewer.openProject(handle.fs.readFile)

// Export includes all fetched files
await handle.export('demo-copy.zip')
```

## Camera Control

The `SceneViewer` provides camera methods useful for auxiliary tools:

```ts
// Get/set camera state (position, target, fov)
const state = viewer.getCameraState()
viewer.setCameraState({ position: [10, 5, 10], target: [0, 0, 0], fov: 60 })

// Playback mode: disable orbit controls during animation
viewer.beginPlayback()
// Animate between camera states...
viewer.applyAnimatedCamera(interpolatedState)
// Re-enable orbit controls
viewer.endPlayback()
```

## Lower-Level Access

For apps that need more control, the building blocks are also exported:

```ts
import {
  // Scene
  CameraRig,              // OrbitControls wrapper with focus/fly-to
  DefaultEnvironment,      // Grid + lights
  CAMERA_DEFAULTS,         // Default FOV, near, far, position

  // Projections
  VantageProjection,       // Projection camera
  ProjectionHelper,        // Frustum visualization
  ProjectionMaterial,      // Projection shader material
  loadTexture,             // Image/video texture loader
  UI_LAYER,                // Layer constant for UI elements

  // Recent projects
  createRecentProjects,    // Per-app recent projects store (IndexedDB)
  createHandleFromDirectory, // Re-open a stored directory handle
  createHandleFromFetch,   // Load project from URL

  // Project I/O (low-level)
  createProjectFS,         // Native directory FS
  createMemoryFS,          // In-memory FS
  loadZip,                 // ZIP → MemoryFS
  exportAsZip,             // MemoryFS → ZIP blob
  downloadBlob,            // Trigger browser download
  validateManifest,        // Manifest schema validation
  deserializeScene,        // Manual scene deserialization
  deserializeProjections,  // Manual projection deserialization
  loadGLTF,                // GLTF/GLB model loader
} from '@krisenstab/vantage'
```

## Example: Camera Transition Tool

A complete skeleton for an auxiliary app that creates camera transitions:

```ts
import {
  SceneViewer,
  openProject,
  importProject,
  createRecentProjects,
  createHandleFromDirectory,
  supportsNativeFS,
  type ProjectHandle,
  type CameraState,
  type RecentProject,
} from '@krisenstab/vantage'

interface Transition {
  from: CameraState
  to: CameraState
  durationMs: number
  easing: 'linear' | 'ease-in-out'
}

const canvas = document.getElementById('viewport') as HTMLCanvasElement
const viewer = new SceneViewer(canvas)
const recents = createRecentProjects('camera-transitions')

let handle: ProjectHandle | null = null
let transitions: Transition[] = []

// ── Open project ──

async function open() {
  handle = await openProject()
  if (handle) await load()
}

async function importFile() {
  handle = await importProject()
  if (handle) await load()
}

async function openRecent(recent: RecentProject) {
  const perm = await recent.handle.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') return
  handle = createHandleFromDirectory(recent.handle)
  await load()
}

async function load() {
  await viewer.openProject(handle!.fs.readFile)

  // Track in recent projects
  if (handle!.directoryHandle) {
    await recents.add(handle!.directoryHandle)
  }

  // Load existing transition data if present
  try {
    const file = await handle!.fs.readFile('transitions.json')
    transitions = JSON.parse(await file.text())
  } catch {
    transitions = []
  }
}

// ── Edit transitions ──

function captureKeyframe() {
  return viewer.getCameraState()
}

function addTransition(from: CameraState, to: CameraState) {
  transitions.push({ from, to, durationMs: 2000, easing: 'ease-in-out' })
}

// ── Preview ──

function previewTransition(t: Transition) {
  viewer.beginPlayback()
  const start = performance.now()

  function tick() {
    const elapsed = performance.now() - start
    const progress = Math.min(elapsed / t.durationMs, 1)
    const eased = t.easing === 'linear' ? progress : easeInOut(progress)

    viewer.applyAnimatedCamera({
      position: lerp3(t.from.position, t.to.position, eased),
      target: lerp3(t.from.target, t.to.target, eased),
      fov: t.from.fov + (t.to.fov - t.from.fov) * eased,
    })

    if (progress < 1) requestAnimationFrame(tick)
    else viewer.endPlayback()
  }
  requestAnimationFrame(tick)
}

// ── Save ──

async function save() {
  if (!handle) return
  await handle.fs.writeFile('transitions.json', JSON.stringify(transitions, null, 2))
  await handle.save()
}

// ── Helpers ──

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}
```

This project can be opened in Vantage to edit the scene, then re-opened in the transition tool — the `transitions.json` file is preserved alongside `scene.json`.
