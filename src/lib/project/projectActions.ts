import { sceneState, sceneActions, SCENE_DEFAULTS } from '@/lib/sceneState.svelte.ts'
import { projectState } from '@/lib/project/projectState.svelte.ts'
import {
  serializeScene,
  deserializeScene,
  deserializeProjections,
} from '@/lib/project/serializer.ts'
import { createProjectFS, supportsNativeFS } from '@/lib/project/fileSystem.ts'
import type { ProjectFS } from '@/lib/project/fileSystem.ts'
import { createMemoryFS, exportAsZip, downloadBlob } from '@/lib/project/memoryFS.ts'
import { addRecentHandle, getRecentHandles } from '@/lib/project/handleStore.ts'
import { validateManifest } from '@/lib/project/validateManifest.ts'
import { PROJECT_DIRS } from '@/lib/constants.ts'

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

  // Write projection images
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

async function recordRecent(handle: FileSystemDirectoryHandle) {
  await addRecentHandle(handle)
  projectState.recentProjects = await getRecentHandles()
}

// ── Save ──

export async function saveProject() {
  if (supportsNativeFS()) {
    if (!projectState.directoryHandle) return saveProjectAs()
    projectState.busy = true
    try {
      const fs = createProjectFS(projectState.directoryHandle)
      await writeProjectFiles(fs)
      await recordRecent(projectState.directoryHandle)
      projectState.dirty = false
    } finally {
      projectState.busy = false
    }
  } else {
    projectState.busy = true
    try {
      const fs = projectState.memoryFS ?? createMemoryFS()
      projectState.memoryFS = fs
      await writeProjectFiles(fs)
      const zip = await exportAsZip(fs)
      downloadBlob(zip, `${projectState.projectName ?? 'project'}.zip`)
      projectState.dirty = false
    } finally {
      projectState.busy = false
    }
  }
}

export async function saveProjectAs() {
  if (supportsNativeFS()) {
    let handle: FileSystemDirectoryHandle
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return // user cancelled
      console.error('Failed to pick directory:', err)
      return
    }
    projectState.directoryHandle = handle
    projectState.projectName = handle.name
    await saveProject()
  } else {
    // Fallback: just save as zip — user picks location via browser download
    if (!projectState.projectName) projectState.projectName = 'project'
    await saveProject()
  }
}

// ── Open ──

export async function openProject() {
  if (projectState.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return
  }

  if (supportsNativeFS()) {
    let handle: FileSystemDirectoryHandle
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return // user cancelled
      console.error('Failed to pick directory:', err)
      return
    }
    await loadFromHandle(handle)
  } else {
    const files = await pickDirectory()
    if (!files.length) return
    await loadFromFiles(files)
  }
}

function pickDirectory(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.addEventListener('change', () => {
      resolve(input.files ? Array.from(input.files) : [])
    })
    input.addEventListener('cancel', () => resolve([]))
    input.click()
  })
}

function applySceneSettings(manifest: import('@/lib/project/types.ts').SceneManifest) {
  sceneState.showGrid = manifest.showGrid ?? SCENE_DEFAULTS.showGrid
  sceneState.clearColor = manifest.clearColor ?? SCENE_DEFAULTS.clearColor
}

async function loadFromFS(readFile: (path: string) => Promise<File>, finalizeState: () => void) {
  projectState.busy = true
  try {
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
    finalizeState()
    projectState.dirty = false
  } finally {
    projectState.busy = false
  }
}

async function loadFromFiles(files: File[]) {
  const fs = createMemoryFS(files)
  const firstFile = files[0]
  const rootDir = firstFile?.webkitRelativePath.split('/')[0]

  await loadFromFS(
    (path) => fs.readFile(path),
    () => {
      projectState.memoryFS = fs
      projectState.directoryHandle = null
      projectState.projectName = rootDir ?? 'project'
    }
  )
}

async function loadFromHandle(handle: FileSystemDirectoryHandle) {
  const fs = createProjectFS(handle)

  await loadFromFS(
    (path) => fs.readFile(path),
    () => {
      projectState.directoryHandle = handle
      projectState.memoryFS = null
      projectState.projectName = handle.name
    }
  )
  await recordRecent(handle)
}

// ── New ──

export async function newProject() {
  if (projectState.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return
  }

  sceneActions.value?.clearScene()
  projectState.directoryHandle = null
  projectState.memoryFS = null
  projectState.projectName = null
  projectState.dirty = false
}

// ── Recent Projects ──

export async function loadRecentProjects() {
  projectState.recentProjects = await getRecentHandles()
}

export async function openRecentProject(handle: FileSystemDirectoryHandle) {
  if (projectState.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return
  }
  try {
    const perm = await handle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') return
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
    await loadFromHandle(last.handle)
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
  await loadExampleFromUrl(basePath)
}

async function loadExampleFromUrl(basePath: string) {
  const readFile = async (path: string): Promise<File> => {
    const r = await fetch(`${basePath}/${path}`)
    if (!r.ok) throw new Error(`Failed to fetch ${path}`)
    const blob = await r.blob()
    return new File([blob], path.split('/').pop()!)
  }

  await loadFromFS(readFile, () => {
    projectState.directoryHandle = null
    projectState.memoryFS = null
    projectState.projectName = basePath.split('/').pop() ?? 'example'
  })
}
