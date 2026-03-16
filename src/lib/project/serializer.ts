import type { SceneObject, SceneObjectSource, ProjectionItem } from '@/lib/sceneState.svelte.ts'
import type { SceneManifest, SceneObjectEntry, ProjectionEntry } from '@/lib/project/types.ts'
import { loadGLTF } from '@/lib/gltfLoader.ts'
import { VantageProjection, loadTexture } from 'vantage-renderer'

export function serializeScene(
  objects: SceneObject[],
  camera?: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    fov: number
  },
  projections?: ProjectionItem[]
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

  if (projections && projections.length > 0) {
    manifest.projections = projections.map((item) => {
      const p = item.projection
      return {
        id: item.id,
        name: item.name,
        imagePath: item.imagePath,
        transform: {
          position: [p.position.x, p.position.y, p.position.z],
          rotation: [p.rotation.x, p.rotation.y, p.rotation.z],
        },
        fov: p.fov,
        near: p.near,
        far: p.far,
        visible: item.visible,
      }
    })
  }

  return manifest
}

export async function deserializeScene(
  manifest: SceneManifest,
  readFile: (path: string) => Promise<File>
): Promise<
  {
    name: string
    object: import('three').Object3D
    source: SceneObjectSource
    id: string
    visible: boolean
  }[]
> {
  const results: {
    name: string
    object: import('three').Object3D
    source: SceneObjectSource
    id: string
    visible: boolean
  }[] = []

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

export async function deserializeProjections(
  entries: ProjectionEntry[],
  readFile: (path: string) => Promise<File>
): Promise<
  {
    id: string
    name: string
    projection: VantageProjection
    visible: boolean
    imagePath: string
  }[]
> {
  const results: {
    id: string
    name: string
    projection: VantageProjection
    visible: boolean
    imagePath: string
  }[] = []

  for (const entry of entries) {
    const file = await readFile(entry.imagePath)
    const url = URL.createObjectURL(file)
    try {
      const texture = await loadTexture(url)
      const projection = new VantageProjection({
        texture,
        fov: entry.fov,
        near: entry.near,
        far: entry.far,
      })
      projection.position.set(...entry.transform.position)
      projection.rotation.set(...entry.transform.rotation)

      results.push({
        id: entry.id,
        name: entry.name,
        projection,
        visible: entry.visible,
        imagePath: entry.imagePath,
      })
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return results
}
