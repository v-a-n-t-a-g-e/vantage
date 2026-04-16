import { sceneState, sceneActions, SCENE_DEFAULTS } from '@/lib/sceneState.svelte.ts'
import { projectState } from '@/lib/project/projectState.svelte.ts'
import { serializeScene, deserializeScene, deserializeProjections } from '@/lib/project/serializer.ts'
import { validateManifest } from '@/lib/project/validateManifest.ts'
import { addRecentHandle, getRecentHandles } from '@/lib/project/handleStore.ts'
import { supportsNativeFS } from '@/lib/project/fileSystem.ts'
import {
  openProject as pickDirectory,
  importProject as pickImportFile,
  createHandleFromDirectory,
  createHandleFromFetch,
  type ProjectHandle,
} from '@/lib/project/projectHandle.ts'
import { exportAsZip, downloadBlob, createMemoryFS } from '@/lib/project/memoryFS.ts'
import { PROJECT_DIRS } from '@/lib/constants.ts'
import type { ProjectFS } from '@/lib/project/fileSystem.ts'

let getCameraState:
  | (() => {
      position: { x: number; y: number; z: number }
      target: { x: number; y: number; z: number }
      fov: number
    })
  | null = null

export function setGetCameraState(fn: typeof getCameraState) {
  getCameraState = fn
}

// ── Saving ──

async function ensureDirectories(fs: ProjectFS) {
  for (const dir of PROJECT_DIRS) {
    await fs.mkdir(dir)
  }
}

async function writeProjectFiles(fs: ProjectFS) {
  await ensureDirectories(fs)

  for (const item of sceneState.objects) {
    if (item.source.kind === 'imported' && item.source.originalBlob) {
      await fs.writeFile(item.source.relativePath, item.source.originalBlob)
      item.source.originalBlob = undefined
    }
  }

  for (const item of sceneState.projections) {
    if (item.imageBlob) {
      await fs.writeFile(item.imagePath, item.imageBlob)
      item.imageBlob = undefined
    }
  }

  const manifest = serializeScene(sceneState.objects, getCameraState?.(), sceneState.projections, {
    showGrid: sceneState.showGrid,
    clearColor: sceneState.clearColor,
  })
  await fs.writeFile('scene.json', JSON.stringify(manifest, null, 2))
}

export async function saveProject() {
  const handle = projectState.handle
  if (!handle) {
    // No handle yet — prompt for a directory (Save As)
    return saveProjectAs()
  }

  projectState.busy = true
  try {
    await writeProjectFiles(handle.fs)
    await handle.save()
    if (handle.directoryHandle) await recordRecent(handle.directoryHandle)
    projectState.dirty = false
  } finally {
    projectState.busy = false
  }
}

export async function saveProjectAs() {
  if (supportsNativeFS()) {
    const handle = await pickDirectory()
    if (!handle) return
    projectState.handle = handle
    projectState.projectName = handle.name
    await saveProject()
  } else {
    // Fallback: save current state as ZIP
    if (!projectState.projectName) projectState.projectName = 'project'
    projectState.busy = true
    try {
      const fs = createMemoryFS()
      await writeProjectFiles(fs)
      const zip = await exportAsZip(fs)
      downloadBlob(zip, `${projectState.projectName}.zip`)
      projectState.dirty = false
    } finally {
      projectState.busy = false
    }
  }
}

export async function exportProject() {
  const handle = projectState.handle
  if (!handle) return

  const name = projectState.projectName ?? 'project'
  projectState.busy = true
  try {
    await writeProjectFiles(handle.fs)
    await handle.export(`${name}.zip`)
  } finally {
    projectState.busy = false
  }
}

// ── Opening ──

export async function openProject() {
  if (projectState.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return
  }

  const handle = await pickDirectory()
  if (!handle) return
  await loadFromHandle(handle)
}

export async function importProject() {
  if (projectState.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return
  }

  const handle = await pickImportFile()
  if (!handle) return
  await loadFromHandle(handle)
}

// ── Loading internals ──

async function recordRecent(dirHandle: FileSystemDirectoryHandle) {
  await addRecentHandle(dirHandle)
  projectState.recentProjects = await getRecentHandles()
}

function applySceneSettings(manifest: import('@/lib/project/types.ts').SceneManifest) {
  sceneState.showGrid = manifest.showGrid ?? SCENE_DEFAULTS.showGrid
  sceneState.clearColor = manifest.clearColor ?? SCENE_DEFAULTS.clearColor
}

async function loadFromFS(readFile: (path: string) => Promise<File>) {
  const sceneFile = await readFile('scene.json')
  const raw = JSON.parse(await sceneFile.text())
  const manifest = validateManifest(raw)

  sceneActions.value?.clearScene()

  const objects = await deserializeScene(manifest, readFile)
  for (const obj of objects) {
    const item = sceneActions.value?.addObjectSilent(obj.name, obj.object, obj.source)
    if (item) {
      item.id = obj.id
      item.visible = obj.visible
      item.object.visible = obj.visible
    }
  }

  if (manifest.projections?.length) {
    const projections = await deserializeProjections(manifest.projections, readFile)
    for (const p of projections) {
      const item = sceneActions.value?.addProjectionSilent(p.name, p.projection, p.imagePath)
      if (item) {
        item.id = p.id
        item.visible = p.visible
        if (!p.visible) {
          for (const obj of sceneState.objects) {
            p.projection.unproject(obj.object)
          }
        }
      }
    }
  }

  applySceneSettings(manifest)
}

async function loadFromHandle(handle: ProjectHandle) {
  projectState.busy = true
  try {
    await loadFromFS(handle.fs.readFile)
    projectState.handle = handle
    projectState.projectName = handle.name
    if (handle.directoryHandle) await recordRecent(handle.directoryHandle)
    projectState.dirty = false
  } finally {
    projectState.busy = false
  }
}

// ── New ──

export async function newProject() {
  if (projectState.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return
  }

  sceneActions.value?.clearScene()
  projectState.handle = null
  projectState.projectName = null
  projectState.dirty = false
}

// ── Recent Projects ──

export async function loadRecentProjects() {
  projectState.recentProjects = await getRecentHandles()
}

export async function openRecentProject(dirHandle: FileSystemDirectoryHandle) {
  if (projectState.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return
  }
  try {
    const perm = await dirHandle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') return
    const handle = createHandleFromDirectory(dirHandle)
    await loadFromHandle(handle)
  } catch {
    // Permission denied or load error — keep entry in recents list
  }
}

export async function autoLoadLastProject() {
  if (!supportsNativeFS()) {
    await loadDemoProject()
    return
  }
  const [last] = projectState.recentProjects
  if (!last) {
    await loadDemoProject()
    return
  }
  try {
    const perm = await last.handle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') {
      await loadDemoProject()
      return
    }
    const handle = createHandleFromDirectory(last.handle)
    await loadFromHandle(handle)
  } catch {
    await loadDemoProject()
  }
}

// ── Demo / Example Projects ──

interface ExampleProject {
  label: string
  basePath: string
}

export const exampleProjects: ExampleProject[] = [{ label: 'Demo', basePath: './demo' }]

export async function loadDemoProject(basePath = './demo') {
  if (projectState.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return
  }
  const handle = createHandleFromFetch(basePath)
  await loadFromHandle(handle)
}
