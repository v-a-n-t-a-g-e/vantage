export type PlyKind = 'splat' | 'pointcloud'

// The PLY header is always ASCII and small; this is enough to cover even
// Gaussian files with many spherical-harmonic properties.
const HEADER_SCAN_BYTES = 65536

/**
 * Decide whether a `.ply` file is a Gaussian splat or a plain point cloud by
 * inspecting its header — without loading the optional Spark dependency.
 *
 * Gaussian-splat PLYs (the INRIA 3DGS convention) carry `scale_*`, `rot_*` and
 * `f_dc_*` per-vertex properties; plain point clouds do not.
 */
export async function detectPlyKind(file: File): Promise<PlyKind> {
  const head = await file.slice(0, HEADER_SCAN_BYTES).text()
  const end = head.indexOf('end_header')
  const header = end >= 0 ? head.slice(0, end) : head
  const has = (name: string) => new RegExp(`property\\s+\\S+\\s+${name}\\b`).test(header)
  const isGaussian = has('scale_0') && has('rot_0') && has('f_dc_0')
  return isGaussian ? 'splat' : 'pointcloud'
}
