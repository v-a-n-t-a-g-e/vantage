import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
import { projectState } from '@/lib/project/projectState.svelte.ts'
import { serializeScene, deserializeScene } from '@/lib/project/serializer.ts'
import { exportToGLB } from '@/lib/project/glbExporter.ts'
import { createProjectFS } from '@/lib/project/fileSystem.ts'
import { storeHandle, getStoredHandle, clearStoredHandle } from '@/lib/project/handleStore.ts'
import type { ProjectFS } from '@/lib/project/fileSystem.ts'

let getCameraState: (() => { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov: number }) | null = null

export function setGetCameraState(fn: typeof getCameraState) {
  getCameraState = fn
}

const PROJECT_DIRS = ['geometry', 'cameras', 'cameras/frames', 'colmap', 'pointcloud', 'splat', 'segmentation', 'video']

async function ensureDirectories(fs: ProjectFS) {
  for (const dir of PROJECT_DIRS) {
    await fs.mkdir(dir)
  }
}

export async function saveProject() {
  if (!projectState.directoryHandle) {
    return saveProjectAs()
  }

  projectState.busy = true
  try {
    const fs = createProjectFS(projectState.directoryHandle)
    await ensureDirectories(fs)

    // Write geometry files
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

    // Write scene.json
    const manifest = serializeScene(sceneState.objects, getCameraState?.())
    await fs.writeFile('scene.json', JSON.stringify(manifest, null, 2))

    await storeHandle(projectState.directoryHandle)
    projectState.dirty = false
  } finally {
    projectState.busy = false
  }
}

export async function saveProjectAs() {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  projectState.directoryHandle = handle
  projectState.projectName = handle.name
  await saveProject()
}

export async function openProject() {
  if (projectState.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return
  }

  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  await loadFromHandle(handle)
}

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
        // Preserve original id from manifest
        item.id = obj.id
        item.visible = obj.visible
        item.object.visible = obj.visible
      }
    }

    projectState.directoryHandle = handle
    projectState.projectName = handle.name
    projectState.dirty = false
    await storeHandle(handle)
  } finally {
    projectState.busy = false
  }
}

export async function newProject() {
  if (projectState.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return
  }

  sceneActions.value?.clearScene()
  projectState.directoryHandle = null
  projectState.projectName = null
  projectState.dirty = false
  await clearStoredHandle()
}

export async function checkForStoredProject(): Promise<FileSystemDirectoryHandle | null> {
  return getStoredHandle()
}
