import type { MemoryFS } from '@/lib/project/memoryFS.ts'

type ProjectState = {
  directoryHandle: FileSystemDirectoryHandle | null
  memoryFS: MemoryFS | null
  projectName: string | null
  dirty: boolean
  busy: boolean
}

export const projectState: ProjectState = $state({
  directoryHandle: null,
  memoryFS: null,
  projectName: null,
  dirty: false,
  busy: false,
})
