import type { SceneObject, SceneObjectSource } from '@/lib/sceneState.svelte.ts'
import type { SceneManifest, SceneObjectEntry, CameraState } from '@/lib/project/types.ts'
import { loadGLTF } from '@/lib/gltfLoader.ts'

export function serializeScene(
  objects: SceneObject[],
  camera?: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov: number },
): SceneManifest {
  const entries: SceneObjectEntry[] = objects.map((item) => {
    const obj = item.object
    let source: SceneObjectEntry['source']
    if (item.source.kind === 'primitive') {
      source = { kind: 'primitive', geometryType: item.source.geometryType }
    } else {
      source = { kind: 'imported', path: item.source.relativePath }
    }

    return {
      id: item.id,
      name: item.name,
      type: 'mesh' as const,
      source,
      transform: {
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      },
      visible: item.visible,
    }
  })

  const manifest: SceneManifest = { version: 1, objects: entries }

  if (camera) {
    manifest.camera = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [camera.target.x, camera.target.y, camera.target.z],
      fov: camera.fov,
    }
  }

  return manifest
}

export async function deserializeScene(
  manifest: SceneManifest,
  readFile: (path: string) => Promise<File>,
): Promise<{ name: string; object: import('three').Object3D; source: SceneObjectSource; id: string; visible: boolean }[]> {
  const results: { name: string; object: import('three').Object3D; source: SceneObjectSource; id: string; visible: boolean }[] = []

  for (const entry of manifest.objects) {
    let filePath: string
    if (entry.source.kind === 'imported') {
      filePath = entry.source.path
    } else {
      filePath = `geometry/${entry.id}.glb`
    }

    const file = await readFile(filePath)
    const { group } = await loadGLTF(file)

    // Apply stored transform
    group.position.set(...entry.transform.position)
    group.rotation.set(...entry.transform.rotation)
    group.scale.set(...entry.transform.scale)
    group.visible = entry.visible

    let source: SceneObjectSource
    if (entry.source.kind === 'primitive') {
      source = { kind: 'primitive', geometryType: entry.source.geometryType }
    } else {
      source = { kind: 'imported', relativePath: entry.source.path }
    }

    results.push({
      id: entry.id,
      name: entry.name,
      object: group,
      source,
      visible: entry.visible,
    })
  }

  return results
}
