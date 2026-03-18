import type { MemoryFS } from '@/lib/project/memoryFS.ts'
import type { RecentProject } from '@/lib/project/handleStore.ts'

type ProjectState = {
  directoryHandle: FileSystemDirectoryHandle | null
  memoryFS: MemoryFS | null
  projectName: string | null
  dirty: boolean
  busy: boolean
  recentProjects: RecentProject[]
}

export const projectState: ProjectState = $state({
  directoryHandle: null,
  memoryFS: null,
  projectName: null,
  dirty: false,
  busy: false,
  recentProjects: [],
})
