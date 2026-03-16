import { zipSync } from 'fflate'
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
