import type { ProjectHandle } from '@/lib/project/projectHandle.ts'
import type { RecentProject } from '@/lib/project/handleStore.ts'

type ProjectState = {
  handle: ProjectHandle | null
  projectName: string | null
  dirty: boolean
  busy: boolean
  recentProjects: RecentProject[]
}

export const projectState: ProjectState = $state({
  handle: null,
  projectName: null,
  dirty: false,
  busy: false,
  recentProjects: [],
})
