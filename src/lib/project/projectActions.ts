import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
import { projectState } from '@/lib/project/projectState.svelte.ts'
import { serializeScene, deserializeScene } from '@/lib/project/serializer.ts'
import { exportToGLB } from '@/lib/project/glbExporter.ts'
import { createProjectFS, supportsNativeFS } from '@/lib/project/fileSystem.ts'
import type { ProjectFS } from '@/lib/project/fileSystem.ts'
import { createMemoryFS, exportAsZip, downloadBlob } from '@/lib/project/memoryFS.ts'
import { storeHandle, getStoredHandle, clearStoredHandle } from '@/lib/project/handleStore.ts'

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

const PROJECT_DIRS = [
  'geometry',
  'cameras',
  'cameras/frames',
  'colmap',
  'pointcloud',
  'splat',
  'segmentation',
  'video',
]

async function ensureDirectories(fs: ProjectFS) {
  for (const dir of PROJECT_DIRS) {
    await fs.mkdir(dir)
  }
}

async function writeProjectFiles(fs: ProjectFS) {
  await ensureDirectories(fs)

  for (const item of sceneState.objects) {
    if (item.source.kind === 'imported') {
      if (item.source.originalBlob) {
        await fs.writeFile(item.source.relativePath, item.source.originalBlob)
        item.source.originalBlob = undefined
      }
    } else {
      const glb = await exportToGLB(item.object)
      await fs.writeFile(`geometry/${item.id}.glb`, glb)
    }
  }

  const manifest = serializeScene(sceneState.objects, getCameraState?.())
  await fs.writeFile('scene.json', JSON.stringify(manifest, null, 2))
}

// ── Save ──

export async function saveProject() {
  if (supportsNativeFS()) {
    if (!projectState.directoryHandle) return saveProjectAs()
    projectState.busy = true
    try {
      const fs = createProjectFS(projectState.directoryHandle)
      await writeProjectFiles(fs)
      await storeHandle(projectState.directoryHandle)
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
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
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
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
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

async function loadFromFiles(files: File[]) {
  projectState.busy = true
  try {
    const fs = createMemoryFS(files)
    const sceneFile = await fs.readFile('scene.json')
    const manifest = JSON.parse(await sceneFile.text())

    sceneActions.value?.clearScene()

    const objects = await deserializeScene(manifest, (path) => fs.readFile(path))
    for (const obj of objects) {
      const item = sceneActions.value?.addObjectSilent(obj.name, obj.object, obj.source)
      if (item) {
        item.id = obj.id
        item.visible = obj.visible
        item.object.visible = obj.visible
      }
    }

    // Derive project name from the root directory in webkitRelativePath
    const firstFile = files[0]
    const rootDir = firstFile?.webkitRelativePath.split('/')[0]

    projectState.memoryFS = fs
    projectState.directoryHandle = null
    projectState.projectName = rootDir ?? 'project'
    projectState.dirty = false
  } finally {
    projectState.busy = false
  }
}

// ── Resume (Chromium only) ──

export async function resumeProject(handle: FileSystemDirectoryHandle) {
  const perm = await handle.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') {
    await clearStoredHandle()
    throw new Error('Permission denied')
  }
  await loadFromHandle(handle)
}

async function loadFromHandle(handle: FileSystemDirectoryHandle) {
  projectState.busy = true
  try {
    const fs = createProjectFS(handle)
    const sceneFile = await fs.readFile('scene.json')
    const manifest = JSON.parse(await sceneFile.text())

    sceneActions.value?.clearScene()

    const objects = await deserializeScene(manifest, (path) => fs.readFile(path))
    for (const obj of objects) {
      const item = sceneActions.value?.addObjectSilent(obj.name, obj.object, obj.source)
      if (item) {
        item.id = obj.id
        item.visible = obj.visible
        item.object.visible = obj.visible
      }
    }

    projectState.directoryHandle = handle
    projectState.memoryFS = null
    projectState.projectName = handle.name
    projectState.dirty = false
    await storeHandle(handle)
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
  projectState.directoryHandle = null
  projectState.memoryFS = null
  projectState.projectName = null
  projectState.dirty = false
  await clearStoredHandle()
}

// ── Resume check ──

export async function checkForStoredProject(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsNativeFS()) return null
  return getStoredHandle()
}
