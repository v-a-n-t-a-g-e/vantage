import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import * as THREE from 'three'

const loader = new PLYLoader()

/**
 * Sniffs the PLY header (always ASCII text) to determine if the file contains
 * Gaussian splat data. Gaussian splat PLYs always have spherical-harmonic
 * properties like `f_dc_0` and `scale_0`; regular point clouds only have
 * `x, y, z, r, g, b`.
 */
export async function detectPLYType(file: File): Promise<'splat' | 'pointcloud'> {
  const text = await file.slice(0, 4096).text()
  if (text.includes('f_dc_') || (text.includes('opacity') && text.includes('scale_'))) {
    return 'splat'
  }
  return 'pointcloud'
}

export async function loadPLY(file: File): Promise<{ points: THREE.Points; blob: Blob }> {
  const url = URL.createObjectURL(file)
  try {
    const geometry = await loader.loadAsync(url)
    geometry.computeVertexNormals()
    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: geometry.hasAttribute('color'),
    })
    return { points: new THREE.Points(geometry, material), blob: file }
  } finally {
    URL.revokeObjectURL(url)
  }
}
