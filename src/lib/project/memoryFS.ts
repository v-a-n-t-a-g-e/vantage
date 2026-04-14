import { zipSync, unzipSync } from 'fflate'
import type { ProjectFS } from '@/lib/project/fileSystem.ts'

export function createMemoryFS(files?: File[]): MemoryFS {
  const store = new Map<string, Blob>()

  if (files) {
    for (const file of files) {
      // webkitRelativePath is "dirName/sub/file.ext" — strip the root directory
      const rel = file.webkitRelativePath
      const firstSlash = rel.indexOf('/')
      const path = firstSlash >= 0 ? rel.slice(firstSlash + 1) : rel
      if (path) store.set(path, file)
    }
  }

  return memoryFSFromStore(store)
}

function memoryFSFromStore(store: Map<string, Blob>): MemoryFS {
  const fs: MemoryFS = {
    store,

    async readFile(path: string): Promise<File> {
      const blob = store.get(path)
      if (!blob) throw new Error(`File not found: ${path}`)
      if (blob instanceof File) return blob
      return new File([blob], path.split('/').pop()!)
    },

    async writeFile(path: string, data: Blob | string): Promise<void> {
      store.set(path, typeof data === 'string' ? new Blob([data], { type: 'text/plain' }) : data)
    },

    async mkdir(): Promise<void> {
      // no-op — paths are implicit in the flat map
    },
  }

  return fs
}

/**
 * Create a MemoryFS from a ZIP file.
 * If the ZIP contains a single root directory, it is automatically stripped
 * so that paths match the expected project layout (e.g. `scene.json` at the root).
 */
export function loadZip(data: ArrayBuffer): MemoryFS {
  const unzipped = unzipSync(new Uint8Array(data))
  const store = new Map<string, Blob>()

  const paths = Object.keys(unzipped).filter((p) => !p.endsWith('/'))

  // Detect a common single-directory prefix (e.g. "myproject/scene.json" → strip "myproject/")
  let prefix = ''
  if (paths.length > 0) {
    const firstSlash = paths[0].indexOf('/')
    if (firstSlash >= 0) {
      const candidate = paths[0].slice(0, firstSlash + 1)
      if (paths.every((p) => p.startsWith(candidate))) {
        prefix = candidate
      }
    }
  }

  for (const [path, content] of Object.entries(unzipped)) {
    if (path.endsWith('/')) continue // skip directory entries
    const stripped = prefix ? path.slice(prefix.length) : path
    if (stripped) store.set(stripped, new Blob([content.buffer as ArrayBuffer]))
  }

  return memoryFSFromStore(store)
}

export interface MemoryFS extends ProjectFS {
  store: Map<string, Blob>
}

export async function exportAsZip(fs: MemoryFS): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {}

  for (const [path, blob] of fs.store) {
    const buf = await blob.arrayBuffer()
    entries[path] = new Uint8Array(buf)
  }

  const zipped = zipSync(entries)
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
