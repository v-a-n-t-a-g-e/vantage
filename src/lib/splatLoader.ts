import type { Object3D } from 'three'

/** Extensions that @sparkjsdev/spark can load */
export type SplatExtension = 'splat' | 'spz' | 'ksplat' | 'ply'

export async function loadSplat(
  file: File,
  extension: SplatExtension
): Promise<{ splatMesh: Object3D; blob: Blob }> {
  let SparkModule: typeof import('@sparkjsdev/spark')
  try {
    SparkModule = await import('@sparkjsdev/spark')
  } catch {
    throw new Error('@sparkjsdev/spark is not installed. Run: npm install @sparkjsdev/spark')
  }

  const { SplatMesh, SplatFileType } = SparkModule
  const fileBytes = new Uint8Array(await file.arrayBuffer())

  // Map our extension string to spark's SplatFileType enum
  const fileType = SplatFileType[extension.toUpperCase() as keyof typeof SplatFileType]

  const mesh = new SplatMesh({ fileBytes, fileType })
  await mesh.initialized

  return { splatMesh: mesh as unknown as Object3D, blob: file }
}
