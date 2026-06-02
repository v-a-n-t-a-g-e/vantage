import * as THREE from 'three'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import { POINT_CLOUD_DEFAULTS } from '@/lib/constants.ts'
import type { PointCloudDisplay } from '@/lib/types.ts'

const loader = new PLYLoader()

/** A SplatMesh-like object: anything exposing Spark's `forEachSplat` iterator. */
interface SplatLike extends THREE.Object3D {
  forEachSplat(
    callback: (
      index: number,
      center: THREE.Vector3,
      scales: THREE.Vector3,
      quaternion: THREE.Quaternion,
      opacity: number,
      color: THREE.Color
    ) => void
  ): void
}

function defaultDisplay(): PointCloudDisplay {
  return { renderAs: 'pointcloud', ...POINT_CLOUD_DEFAULTS }
}

function makePointsMaterial(display: PointCloudDisplay, hasColor: boolean): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    size: display.pointSize,
    sizeAttenuation: display.sizeAttenuation,
    vertexColors: hasColor,
  })
}

/**
 * Load a plain (non-Gaussian) point-cloud PLY into a `THREE.Points` object.
 * Unlike Gaussian splats, this needs no optional dependency — it renders with
 * core Three.js, and supports both ASCII and binary PLY. Point colours (if
 * present) are shown via `vertexColors`; point size / attenuation come from the
 * stored display settings (or fixed defaults).
 */
export async function loadPointCloud(
  file: File,
  display: PointCloudDisplay = defaultDisplay()
): Promise<{ object: THREE.Points; blob: Blob }> {
  const geometry = loader.parse(await file.arrayBuffer())
  const hasColor = geometry.hasAttribute('color')
  const points = new THREE.Points(geometry, makePointsMaterial(display, hasColor))
  points.userData.isPointCloud = true
  points.userData.display = display
  return { object: points, blob: file }
}

/**
 * Build a `THREE.Points` representation of a Gaussian splat by sampling each
 * splat's centre and colour. Lets a splat be inspected as a plain point cloud.
 * The two objects are linked via `userData` so toggling back to splat rendering
 * needs no reload.
 */
export function splatToPoints(
  splat: SplatLike,
  display: PointCloudDisplay
): THREE.Points {
  const positions: number[] = []
  const colors: number[] = []
  splat.forEachSplat((_i, center, _scales, _quat, _opacity, color) => {
    positions.push(center.x, center.y, center.z)
    colors.push(color.r, color.g, color.b)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  const points = new THREE.Points(geometry, makePointsMaterial(display, true))
  points.userData.isPointCloud = true
  points.userData.display = display
  points.userData.sourceSplat = splat
  splat.userData.pointsVariant = points
  return points
}
