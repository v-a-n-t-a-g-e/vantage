import { CameraHelper, type Camera, type BufferAttribute } from 'three'
import { themeColors } from '@/lib/scene/themeColors.ts'

/**
 * Camera helper that only renders the cone and frustum lines,
 * hiding the up indicator, target line, and crosshairs.
 * All lines use the brand color.
 */
export class ProjectionHelper extends CameraHelper {
  /** Points to collapse after each update (hides up, target, cross) */
  private static readonly HIDDEN_POINTS = [
    'u1', 'u2', 'u3',
    'c', 't',
    'cn1', 'cn2', 'cn3', 'cn4',
    'cf1', 'cf2', 'cf3', 'cf4',
  ]

  constructor(camera: Camera) {
    super(camera)
    const brand = themeColors.brand
    this.setColors(brand, brand, brand, brand, brand)
  }

  override update(): this {
    super.update()

    const position = this.geometry.getAttribute('position') as BufferAttribute
    const pIndices = this.pointMap['p']
    const px = position.getX(pIndices[0])
    const py = position.getY(pIndices[0])
    const pz = position.getZ(pIndices[0])

    for (const name of ProjectionHelper.HIDDEN_POINTS) {
      const indices = this.pointMap[name]
      if (!indices) continue
      for (const idx of indices) {
        position.setXYZ(idx, px, py, pz)
      }
    }

    position.needsUpdate = true
    return this
  }
}
