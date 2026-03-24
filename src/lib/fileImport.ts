import { sceneActions } from '@/lib/sceneState.svelte.ts'
import { loadGLTF } from '@/lib/gltfLoader.ts'
import { VantageProjection, loadTexture } from '@/lib/scene/projection'
import { FILE_PATTERNS } from '@/lib/constants.ts'

export type ImportErrorHandler = (file: File, error: Error) => void

const defaultOnError: ImportErrorHandler = (file, error) => {
  console.error(`Failed to import ${file.name}:`, error)
}

export async function importModelFiles(
  files: FileList | File[],
  onError: ImportErrorHandler = defaultOnError
) {
  for (const file of files) {
    if (!FILE_PATTERNS.MODEL.test(file.name)) continue
    try {
      const { group, blob } = await loadGLTF(file)
      const name = file.name.replace(FILE_PATTERNS.MODEL, '')
      sceneActions.value?.addObject(name, group, {
        kind: 'imported',
        relativePath: `models/${file.name}`,
        originalBlob: blob,
      })
    } catch (err) {
      onError(file, err instanceof Error ? err : new Error(String(err)))
    }
  }
}

export async function importImageFiles(
  files: FileList | File[],
  onError: ImportErrorHandler = defaultOnError
) {
  for (const file of files) {
    if (!FILE_PATTERNS.IMAGE.test(file.name)) continue
    const url = URL.createObjectURL(file)
    try {
      const texture = await loadTexture(url)
      const projection = new VantageProjection({ texture })
      projection.position.y = 1.5
      const name = file.name.replace(FILE_PATTERNS.IMAGE, '')
      const imagePath = `projections/${file.name}`
      sceneActions.value?.addProjection(name, projection, file, imagePath)
    } catch (err) {
      onError(file, err instanceof Error ? err : new Error(String(err)))
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export async function importFiles(
  files: FileList | null | undefined,
  onError: ImportErrorHandler = defaultOnError
) {
  if (!files) return
  await importModelFiles(files, onError)
  await importImageFiles(files, onError)
}
