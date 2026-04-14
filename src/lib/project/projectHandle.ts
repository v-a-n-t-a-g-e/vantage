import { createProjectFS, supportsNativeFS, type ProjectFS } from '@/lib/project/fileSystem.ts'
import { createMemoryFS, loadZip, exportAsZip, downloadBlob, type MemoryFS } from '@/lib/project/memoryFS.ts'
import { loadGLTF } from '@/lib/gltfLoader.ts'
import { serializeScene } from '@/lib/project/serializer.ts'
import { FILE_PATTERNS, PROJECT_DIRS } from '@/lib/constants.ts'

export interface ProjectHandle {
  /** Filesystem for reading and writing project files. */
  fs: ProjectFS
  /** Display name for the project (directory name, zip filename, or model filename). */
  name: string
  /** Whether `save()` writes in-place. False for ZIP and model imports. */
  canSaveInPlace: boolean
  /**
   * Save project data. If the project was opened from a native directory,
   * writes in-place. Otherwise exports and downloads as a ZIP.
   */
  save(): Promise<void>
  /** Export the project as a ZIP download regardless of how it was opened. */
  export(filename?: string): Promise<void>
}

/**
 * Open a vantage project from a native directory picker.
 * Requires browser support for the File System Access API.
 * Returns `null` if the user cancels the picker.
 */
export async function openProject(): Promise<ProjectHandle | null> {
  if (!supportsNativeFS()) {
    throw new Error('Native filesystem access is not supported in this browser')
  }

  let handle: FileSystemDirectoryHandle
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null
    throw err
  }

  const fs = createProjectFS(handle)
  return createNativeHandle(fs, handle.name)
}

/**
 * Import a vantage project from a file — either a `.zip` containing a project
 * or a `.glb`/`.gltf` model file (which scaffolds a minimal project around it).
 * Returns `null` if the user cancels the picker.
 */
export async function importProject(): Promise<ProjectHandle | null> {
  const file = await pickFile('.zip,.glb,.gltf')
  if (!file) return null
  return importProjectFile(file)
}

/**
 * Process a dropped file or directory into a ProjectHandle.
 * Handles directories (native FS), `.zip` files, and `.glb`/`.gltf` model files.
 *
 * Usage:
 * ```ts
 * element.addEventListener('drop', async (e) => {
 *   e.preventDefault()
 *   const handle = await onProjectDrop(e)
 *   if (handle) {
 *     await viewer.openProject(handle.fs.readFile)
 *   }
 * })
 * ```
 */
export async function onProjectDrop(event: DragEvent): Promise<ProjectHandle | null> {
  const items = event.dataTransfer?.items
  if (!items || items.length === 0) return null

  const firstItem = items[0]

  // Check for directory drop (File System Access API)
  if ('getAsFileSystemHandle' in firstItem) {
    try {
      const handle = await (firstItem as DataTransferItem & { getAsFileSystemHandle(): Promise<FileSystemHandle> }).getAsFileSystemHandle()
      if (handle && handle.kind === 'directory') {
        const dirHandle = handle as FileSystemDirectoryHandle
        // Request readwrite permission
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perm = await (dirHandle as any).requestPermission({ mode: 'readwrite' })
        if (perm === 'granted') {
          const fs = createProjectFS(dirHandle)
          return createNativeHandle(fs, dirHandle.name)
        }
      }
    } catch {
      // Fall through to file handling
    }
  }

  // Handle as file (zip or model)
  const file = firstItem.getAsFile()
  if (!file) return null
  return importProjectFile(file)
}

/**
 * Save the project. If opened from a native directory, writes in-place.
 * Otherwise exports as a ZIP download.
 */
export async function saveProject(handle: ProjectHandle): Promise<void> {
  await handle.save()
}

/**
 * Export the project as a ZIP download regardless of how it was opened.
 */
export async function exportProject(handle: ProjectHandle, filename?: string): Promise<void> {
  await handle.export(filename)
}

// ── Internal helpers ──

function createNativeHandle(fs: ProjectFS, name: string): ProjectHandle {
  return {
    fs,
    name,
    canSaveInPlace: true,
    async save() {
      // Native FS writes are immediate — nothing extra to do.
      // The caller is responsible for writing their data via handle.fs.writeFile().
    },
    async export(filename?: string) {
      // To export a native FS as zip, we need to read all files into memory.
      // This reads the current state from the native directory.
      const memFS = await nativeToMemoryFS(fs, name)
      const zip = await exportAsZip(memFS)
      downloadBlob(zip, filename ?? `${name}.zip`)
    },
  }
}

function createMemoryHandle(fs: MemoryFS, name: string): ProjectHandle {
  return {
    fs,
    name,
    canSaveInPlace: false,
    async save() {
      const zip = await exportAsZip(fs)
      downloadBlob(zip, `${name}.zip`)
    },
    async export(filename?: string) {
      const zip = await exportAsZip(fs)
      downloadBlob(zip, filename ?? `${name}.zip`)
    },
  }
}

async function importProjectFile(file: File): Promise<ProjectHandle> {
  const name = file.name.replace(/\.\w+$/, '')

  if (file.name.endsWith('.zip')) {
    const buffer = await file.arrayBuffer()
    const fs = loadZip(buffer)
    return createMemoryHandle(fs, name)
  }

  if (FILE_PATTERNS.MODEL.test(file.name)) {
    const fs = await scaffoldFromModel(file)
    return createMemoryHandle(fs, name)
  }

  throw new Error(`Unsupported file type: ${file.name}. Expected .zip, .glb, or .gltf`)
}

async function scaffoldFromModel(file: File): Promise<MemoryFS> {
  const { group, blob } = await loadGLTF(file)
  const modelPath = `models/${file.name}`
  const name = file.name.replace(/\.\w+$/, '')

  const objects = [
    {
      kind: 'object' as const,
      id: crypto.randomUUID(),
      name,
      object: group,
      visible: true,
      locked: false,
      source: { kind: 'imported' as const, relativePath: modelPath },
    },
  ]

  const manifest = serializeScene(objects)
  const fs = createMemoryFS()

  for (const dir of PROJECT_DIRS) {
    await fs.mkdir(dir)
  }

  await fs.writeFile(modelPath, blob)
  await fs.writeFile('scene.json', JSON.stringify(manifest, null, 2))

  return fs
}

async function nativeToMemoryFS(fs: ProjectFS, name: string): Promise<MemoryFS> {
  // Read scene.json to discover all referenced files
  const sceneFile = await fs.readFile('scene.json')
  const manifest = JSON.parse(await sceneFile.text())
  const memFS = createMemoryFS()

  await memFS.writeFile('scene.json', sceneFile)

  // Copy referenced model files
  if (manifest.objects) {
    for (const obj of manifest.objects) {
      if (obj.source?.kind === 'imported' && obj.source.path) {
        try {
          const file = await fs.readFile(obj.source.path)
          await memFS.writeFile(obj.source.path, file)
        } catch {
          // File may not exist if it was deleted
        }
      }
    }
  }

  // Copy referenced projection images
  if (manifest.projections) {
    for (const proj of manifest.projections) {
      if (proj.imagePath) {
        try {
          const file = await fs.readFile(proj.imagePath)
          await memFS.writeFile(proj.imagePath, file)
        } catch {
          // File may not exist
        }
      }
    }
  }

  // Also copy any other JSON files (auxiliary app data)
  // We can't enumerate a native FS directory easily, so we rely on the manifest
  // and any extra files the caller has written via the handle.

  return memFS
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
