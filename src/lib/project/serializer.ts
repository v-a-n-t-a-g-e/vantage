import type { SceneObject, SceneObjectSource, ProjectionItem } from '../types.ts'
import type { SceneManifest, SceneObjectEntry, ProjectionEntry } from './types.ts'
import type { SplatScaleFilter } from '../splatScaleFilter.ts'
import { loadGLTF } from '../gltfLoader.ts'
import { VantageProjection, loadTexture } from '../scene/projection'
import * as THREE from 'three'

export function serializeScene(
  objects: SceneObject[],
  camera?: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    fov: number
  },
  projections?: ProjectionItem[],
  options?: { showGrid?: boolean; clearColor?: string }
): SceneManifest {
  const entries: SceneObjectEntry[] = objects.map((item) => {
    const obj = item.object
    let source: SceneObjectEntry['source']
    if (item.source.kind === 'primitive') {
      source = { kind: 'primitive', geometryType: item.source.geometryType }
    } else {
      source = { kind: 'imported', path: item.source.relativePath }
    }

    let type: SceneObjectEntry['type'] = 'mesh'
    if (item.source.kind === 'imported') {
      if (item.source.objectType === 'pointcloud') type = 'pointcloud'
      else if (item.source.objectType === 'splat') type = 'splat'
    }

    // Persist splat scale filter threshold when it has been changed from the
    // default (1e9 = "unlimited"). Skipping it keeps scene.json clean.
    let metadata: Record<string, unknown> | undefined
    if (type === 'splat') {
      const filter = (obj as any).userData?.splatScaleFilter as SplatScaleFilter | undefined
      const maxSplatScale = filter?.getMaxScale()
      if (maxSplatScale !== undefined && maxSplatScale < 1e9) {
        metadata = { maxSplatScale }
      }
    }

    return {
      id: item.id,
      name: item.name,
      type,
      source,
      transform: {
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      },
      visible: item.visible,
      ...(metadata ? { metadata } : {}),
    }
  })

  const manifest: SceneManifest = {
    version: 1,
    objects: entries,
    showGrid: options?.showGrid,
    clearColor: options?.clearColor,
  }

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
    let object: import('three').Object3D
    let source: SceneObjectSource

    if (entry.source.kind === 'primitive') {
      object = new THREE.Mesh(
        new THREE.BoxGeometry(10, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
      )
      source = { kind: 'primitive', geometryType: entry.source.geometryType }
    } else if (entry.type === 'pointcloud') {
      const file = await readFile(entry.source.path)
      const { loadPLY } = await import('../plyLoader.ts')
      const { points } = await loadPLY(file)
      object = points
      source = { kind: 'imported', relativePath: entry.source.path, objectType: 'pointcloud' }
    } else if (entry.type === 'splat') {
      const file = await readFile(entry.source.path)
      const { loadSplat } = await import('../splatLoader.ts')
      const ext = file.name.split('.').pop()?.toLowerCase() as import('../splatLoader.ts').SplatExtension
      const { splatMesh } = await loadSplat(file, ext ?? 'splat')
      object = splatMesh
      source = { kind: 'imported', relativePath: entry.source.path, objectType: 'splat' }
      // Restore persisted filter threshold if one was saved.
      // attachScaleFilter is called inside loadSplat, so the filter is already
      // present on userData by the time we get here.
      if (entry.metadata?.maxSplatScale !== undefined) {
        const filter = (splatMesh as any).userData?.splatScaleFilter as SplatScaleFilter | undefined
        filter?.setMaxScale(entry.metadata.maxSplatScale as number)
      }
    } else {
      const file = await readFile(entry.source.path)
      const { group } = await loadGLTF(file)
      object = group
      source = { kind: 'imported', relativePath: entry.source.path }
    }

    // Apply stored transform
    object.position.set(...entry.transform.position)
    object.rotation.set(...entry.transform.rotation)
    object.scale.set(...entry.transform.scale)
    object.visible = entry.visible

    results.push({
      id: entry.id,
      name: entry.name,
      object,
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
