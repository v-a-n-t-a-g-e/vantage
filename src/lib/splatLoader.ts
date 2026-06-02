import type { Object3D } from 'three'
import { POINT_CLOUD_DEFAULTS } from '@/lib/constants.ts'

const SPARK_MISSING_MESSAGE =
  'Gaussian splat support requires the optional "@sparkjsdev/spark" package. ' +
  'Install it (npm install @sparkjsdev/spark) to import or open Gaussian splat files. ' +
  'Plain point-cloud .ply files work without it.'

let sparkModule: Promise<typeof import('@sparkjsdev/spark')> | null = null

/**
 * Lazily import `@sparkjsdev/spark`. It is an optional dependency, so this is
 * only resolved when a Gaussian splat is actually imported or opened. A missing
 * package is surfaced as a clear, actionable error instead of a raw
 * module-not-found.
 */
export function loadSparkModule(): Promise<typeof import('@sparkjsdev/spark')> {
  if (!sparkModule) {
    sparkModule = import('@sparkjsdev/spark').catch(() => {
      throw new Error(SPARK_MISSING_MESSAGE)
    })
  }
  return sparkModule
}

// SplatFileType enum values match the file extension (e.g. "ply", "spz").
const EXTENSION_TO_TYPE: Record<string, string> = {
  ply: 'ply',
  spz: 'spz',
  splat: 'splat',
  ksplat: 'ksplat',
}

/**
 * Load a Gaussian splat file into a `SplatMesh` (a THREE.Object3D subclass),
 * mirroring `loadGLTF`. Supports `.ply` (Gaussian-splat convention), `.spz`,
 * `.splat` and `.ksplat`. Plain point clouds are handled separately by
 * `loadPointCloud` and do not require Spark. The mesh is marked `raycastable`
 * so it can be picked and `userData.isSplat` is set so the renderer can detect
 * splats.
 */
export async function loadSplat(file: File): Promise<{ object: Object3D; blob: Blob }> {
  const spark = await loadSparkModule()
  const fileBytes = new Uint8Array(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fileType = EXTENSION_TO_TYPE[ext] as
    | import('@sparkjsdev/spark').SplatFileType
    | undefined

  const mesh = new spark.SplatMesh({ fileBytes, fileType, raycastable: true })

  try {
    await mesh.initialized
  } catch (cause) {
    // Spark can reject initialization with no reason (e.g. a malformed file).
    throw new Error(`Could not load "${file.name}" as a Gaussian splat.`, { cause })
  }
  mesh.userData.isSplat = true
  // Default display settings, used if the splat is toggled to point-cloud rendering.
  mesh.userData.display = { renderAs: 'splat', ...POINT_CLOUD_DEFAULTS }

  return { object: mesh, blob: file }
}
