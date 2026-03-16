import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import type { Object3D } from 'three'

const exporter = new GLTFExporter()

export async function exportToGLB(object: Object3D): Promise<Blob> {
  // Save current transform
  const pos = object.position.clone()
  const rot = object.rotation.clone()
  const scl = object.scale.clone()

  // Reset to identity so GLB contains only geometry
  object.position.set(0, 0, 0)
  object.rotation.set(0, 0, 0)
  object.scale.set(1, 1, 1)

  try {
    const result = await exporter.parseAsync(object, { binary: true })
    return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
  } finally {
    // Restore transform
    object.position.copy(pos)
    object.rotation.copy(rot)
    object.scale.copy(scl)
  }
}
