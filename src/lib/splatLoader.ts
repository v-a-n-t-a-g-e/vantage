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

  // Build the scale filter BEFORE constructing SplatMesh so the modifier is
  // passed as a constructor option. This is critical: SplatMesh compiles its
  // shader graph in the constructor and again at the end of asyncInitialize()
  // (when `initialized` resolves). Passing objectModifier upfront ensures the
  // modifier is included in both compilations — setting it after the fact and
  // calling updateGenerator() is unreliable due to spark's internal init order.
  const { buildScaleFilter } = await import('./splatScaleFilter.ts')
  const { modifier, filter } = await buildScaleFilter()

  const mesh = new SplatMesh({ fileBytes, fileType, objectModifier: modifier as any })
  await mesh.initialized

  // Store the filter interface on userData for the Inspector and serializer
  mesh.userData ??= {}
  mesh.userData.splatScaleFilter = filter

  return { splatMesh: mesh as unknown as Object3D, blob: file }
}
