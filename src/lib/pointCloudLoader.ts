import * as THREE from 'three'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'

const loader = new PLYLoader()

/**
 * Load a plain (non-Gaussian) point-cloud PLY into a `THREE.Points` object.
 * Unlike Gaussian splats, this needs no optional dependency — it renders with
 * core Three.js, and supports both ASCII and binary PLY. Point colours (if
 * present) are shown via `vertexColors`; the point size is derived from the
 * cloud's extent so it is visible regardless of scale.
 */
export async function loadPointCloud(file: File): Promise<{ object: THREE.Points; blob: Blob }> {
  const geometry = loader.parse(await file.arrayBuffer())

  geometry.computeBoundingBox()
  const size = new THREE.Vector3()
  geometry.boundingBox?.getSize(size)
  const count = geometry.getAttribute('position')?.count ?? 0
  const diagonal = size.length() || 1
  const pointSize = Math.max((diagonal / Math.cbrt(count || 1)) * 0.5, diagonal * 1e-4)

  const hasColor = geometry.hasAttribute('color')
  const material = new THREE.PointsMaterial({
    size: pointSize,
    sizeAttenuation: true,
    vertexColors: hasColor,
    // color: hasColor ? 0xffffff : 0x808080,
  })

  const points = new THREE.Points(geometry, material)
  points.userData.isPointCloud = true

  return { object: points, blob: file }
}
