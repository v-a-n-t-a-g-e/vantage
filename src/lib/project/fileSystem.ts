export interface ProjectFS {
  readFile(path: string): Promise<File>
  writeFile(path: string, data: Blob | string): Promise<void>
  mkdir(path: string): Promise<void>
}

export function createProjectFS(root: FileSystemDirectoryHandle): ProjectFS {
  async function getNestedDir(
    path: string,
    create: boolean,
  ): Promise<FileSystemDirectoryHandle> {
    const parts = path.split('/').filter(Boolean)
    let dir = root
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create })
    }
    return dir
  }

  return {
    async readFile(path: string): Promise<File> {
      const parts = path.split('/')
      const fileName = parts.pop()!
      const dirPath = parts.join('/')
      const dir = dirPath ? await getNestedDir(dirPath, false) : root
      const fileHandle = await dir.getFileHandle(fileName)
      return fileHandle.getFile()
    },

    async writeFile(path: string, data: Blob | string): Promise<void> {
      const parts = path.split('/')
      const fileName = parts.pop()!
      const dirPath = parts.join('/')
      const dir = dirPath ? await getNestedDir(dirPath, true) : root
      const fileHandle = await dir.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(data)
      await writable.close()
    },

    async mkdir(path: string): Promise<void> {
      await getNestedDir(path, true)
    },
  }
}
