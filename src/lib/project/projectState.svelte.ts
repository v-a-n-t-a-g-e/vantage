type ProjectState = {
  directoryHandle: FileSystemDirectoryHandle | null
  projectName: string | null
  dirty: boolean
  busy: boolean
}

export const projectState: ProjectState = $state({
  directoryHandle: null,
  projectName: null,
  dirty: false,
  busy: false,
})
