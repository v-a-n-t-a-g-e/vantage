import {
  Group,
  LineSegments,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  BufferGeometry,
  BufferAttribute,
  Vector3,
  DoubleSide,
  type PerspectiveCamera,
} from 'three'
import { themeColors } from '../themeColors.ts'
import { UI_LAYER } from '../layers.ts'

// 4 cone lines + 12 frustum lines (near × 4 + far × 4 + sides × 4)  ×  2 verts
const LINE_VERTS = (4 + 12) * 2
// frustum mesh: 4 side quads only = 4 × 2 triangles × 3 verts
const FRUSTUM_MESH_VERTS = 4 * 2 * 3

/**
 * Scene helper for a VantageProjection.
 *   - Cone (apex → near corners) + Frustum edges: opaque LineSegments in brand color
 *   - Frustum volume: semi-transparent Mesh (side faces only) in brand color
 */
export class ProjectionHelper extends Group {
  private readonly cam: PerspectiveCamera
  private readonly lines: LineSegments
  private readonly frustumMesh: Mesh

  // Reusable vectors — avoids per-frame allocations
  private readonly _p = new Vector3()
  private readonly _n = Array.from({ length: 4 }, () => new Vector3())
  private readonly _f = Array.from({ length: 4 }, () => new Vector3())

  constructor(camera: PerspectiveCamera) {
    super()
    this.cam = camera
    const brand = themeColors.brand

    // --- Lines (cone + frustum edges) ---
    const lineGeo = new BufferGeometry()
    lineGeo.setAttribute('position', new BufferAttribute(new Float32Array(LINE_VERTS * 3), 3))
    this.lines = new LineSegments(lineGeo, new LineBasicMaterial({ color: brand }))
    this.lines.frustumCulled = false
    this.lines.layers.set(UI_LAYER)
    this.add(this.lines)

    // --- Frustum volume mesh (semi-transparent, side faces only) ---
    const frustumGeo = new BufferGeometry()
    frustumGeo.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(FRUSTUM_MESH_VERTS * 3), 3)
    )
    this.frustumMesh = new Mesh(
      frustumGeo,
      new MeshBasicMaterial({
        color: brand,
        side: DoubleSide,
        transparent: true,
        opacity: 0.025,
        depthWrite: false,
      })
    )
    this.frustumMesh.frustumCulled = false
    this.frustumMesh.layers.set(UI_LAYER)
    this.add(this.frustumMesh)

    this.update()
  }

  update(): this {
    const { cam, _p, _n, _f } = this
    const brand = themeColors.brand

    ;(this.lines.material as LineBasicMaterial).color.copy(brand)
    ;(this.frustumMesh.material as MeshBasicMaterial).color.copy(brand)

    cam.updateWorldMatrix(true, false)
    cam.getWorldPosition(_p)

    // Unproject NDC corners → world space
    // near (NDC z = -1)
    _n[0].set(-1, -1, -1).unproject(cam) // bottom-left
    _n[1].set(+1, -1, -1).unproject(cam) // bottom-right
    _n[2].set(-1, +1, -1).unproject(cam) // top-left
    _n[3].set(+1, +1, -1).unproject(cam) // top-right
    // far  (NDC z = +1)
    _f[0].set(-1, -1, +1).unproject(cam) // bottom-left
    _f[1].set(+1, -1, +1).unproject(cam) // bottom-right
    _f[2].set(-1, +1, +1).unproject(cam) // top-left
    _f[3].set(+1, +1, +1).unproject(cam) // top-right

    // Lines: cone (apex → near corners) + frustum edges
    const lPos = this.lines.geometry.getAttribute('position') as BufferAttribute
    let i = 0
    // Cone
    setLine(lPos, i, _p, _n[0])
    i += 2
    setLine(lPos, i, _p, _n[1])
    i += 2
    setLine(lPos, i, _p, _n[2])
    i += 2
    setLine(lPos, i, _p, _n[3])
    i += 2
    // Near rectangle
    setLine(lPos, i, _n[0], _n[1])
    i += 2
    setLine(lPos, i, _n[1], _n[3])
    i += 2
    setLine(lPos, i, _n[3], _n[2])
    i += 2
    setLine(lPos, i, _n[2], _n[0])
    i += 2
    // Far rectangle
    setLine(lPos, i, _f[0], _f[1])
    i += 2
    setLine(lPos, i, _f[1], _f[3])
    i += 2
    setLine(lPos, i, _f[3], _f[2])
    i += 2
    setLine(lPos, i, _f[2], _f[0])
    i += 2
    // Connecting sides
    setLine(lPos, i, _n[0], _f[0])
    i += 2
    setLine(lPos, i, _n[1], _f[1])
    i += 2
    setLine(lPos, i, _n[2], _f[2])
    i += 2
    setLine(lPos, i, _n[3], _f[3])
    lPos.needsUpdate = true

    // Frustum mesh: 4 side faces only (DoubleSide so winding is arbitrary)
    const mPos = this.frustumMesh.geometry.getAttribute('position') as BufferAttribute
    let k = 0
    // Bottom side
    setTri(mPos, k, _n[0], _f[0], _f[1])
    k += 3
    setTri(mPos, k, _n[0], _f[1], _n[1])
    k += 3
    // Right side
    setTri(mPos, k, _n[1], _f[1], _f[3])
    k += 3
    setTri(mPos, k, _n[1], _f[3], _n[3])
    k += 3
    // Top side
    setTri(mPos, k, _n[3], _f[3], _f[2])
    k += 3
    setTri(mPos, k, _n[3], _f[2], _n[2])
    k += 3
    // Left side
    setTri(mPos, k, _n[2], _f[2], _f[0])
    k += 3
    setTri(mPos, k, _n[2], _f[0], _n[0])
    mPos.needsUpdate = true

    return this
  }

  dispose() {
    this.lines.geometry.dispose()
    ;(this.lines.material as LineBasicMaterial).dispose()
    this.frustumMesh.geometry.dispose()
    ;(this.frustumMesh.material as MeshBasicMaterial).dispose()
  }
}

function setLine(attr: BufferAttribute, i: number, a: Vector3, b: Vector3) {
  attr.setXYZ(i, a.x, a.y, a.z)
  attr.setXYZ(i + 1, b.x, b.y, b.z)
}

function setTri(attr: BufferAttribute, i: number, a: Vector3, b: Vector3, c: Vector3) {
  attr.setXYZ(i, a.x, a.y, a.z)
  attr.setXYZ(i + 1, b.x, b.y, b.z)
  attr.setXYZ(i + 2, c.x, c.y, c.z)
}
