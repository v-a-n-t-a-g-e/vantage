import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { serializeScene } from '@/lib/project/serializer.ts'
import type { SceneObject, ProjectionItem } from '@/lib/sceneState.svelte.ts'

function makeSceneObject(overrides: Partial<SceneObject> = {}): SceneObject {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 10),
    new THREE.MeshStandardMaterial()
  )
  mesh.position.set(1, 2, 3)
  mesh.rotation.set(0.1, 0.2, 0.3)
  mesh.scale.set(1, 1, 1)

  return {
    kind: 'object',
    id: 'obj-1',
    name: 'TestBox',
    object: mesh,
    visible: true,
    locked: false,
    source: { kind: 'primitive', geometryType: 'box' },
    ...overrides,
  }
}

function makeProjectionItem(overrides: Partial<ProjectionItem> = {}): ProjectionItem {
  // Create a minimal mock that satisfies the serializer's needs
  const projection = new THREE.PerspectiveCamera(60, 1, 1, 200) as any
  projection.position.set(4, 5, 6)
  projection.rotation.set(0.4, 0.5, 0)

  return {
    kind: 'projection',
    id: 'proj-1',
    name: 'TestProjection',
    projection,
    visible: true,
    locked: false,
    imagePath: 'projections/test.jpg',
    ...overrides,
  }
}

describe('serializeScene', () => {
  it('serializes scene objects with transforms', () => {
    const obj = makeSceneObject()
    const manifest = serializeScene([obj])

    expect(manifest.version).toBe(1)
    expect(manifest.objects).toHaveLength(1)

    const entry = manifest.objects[0]
    expect(entry.id).toBe('obj-1')
    expect(entry.name).toBe('TestBox')
    expect(entry.source).toEqual({ kind: 'primitive', geometryType: 'box' })
    expect(entry.transform.position[0]).toBeCloseTo(1)
    expect(entry.transform.position[1]).toBeCloseTo(2)
    expect(entry.transform.position[2]).toBeCloseTo(3)
    expect(entry.visible).toBe(true)
  })

  it('serializes imported object source', () => {
    const obj = makeSceneObject({
      source: { kind: 'imported', relativePath: 'models/test.glb' },
    })
    const manifest = serializeScene([obj])

    expect(manifest.objects[0].source).toEqual({
      kind: 'imported',
      path: 'models/test.glb',
    })
  })

  it('serializes camera state', () => {
    const camera = {
      position: { x: 10, y: 20, z: 30 },
      target: { x: 0, y: 0, z: 0 },
      fov: 75,
    }
    const manifest = serializeScene([], camera)

    expect(manifest.camera).toBeDefined()
    expect(manifest.camera!.position).toEqual([10, 20, 30])
    expect(manifest.camera!.target).toEqual([0, 0, 0])
    expect(manifest.camera!.fov).toBe(75)
  })

  it('omits camera when not provided', () => {
    const manifest = serializeScene([])
    expect(manifest.camera).toBeUndefined()
  })

  it('serializes projections', () => {
    const proj = makeProjectionItem()
    const manifest = serializeScene([], undefined, [proj])

    expect(manifest.projections).toHaveLength(1)
    const entry = manifest.projections![0]
    expect(entry.id).toBe('proj-1')
    expect(entry.name).toBe('TestProjection')
    expect(entry.imagePath).toBe('projections/test.jpg')
    expect(entry.transform.position[0]).toBeCloseTo(4)
    expect(entry.transform.position[1]).toBeCloseTo(5)
    expect(entry.transform.position[2]).toBeCloseTo(6)
    expect(entry.fov).toBe(60)
    expect(entry.near).toBe(1)
    expect(entry.far).toBe(200)
  })

  it('omits projections when empty', () => {
    const manifest = serializeScene([], undefined, [])
    expect(manifest.projections).toBeUndefined()
  })

  it('serializes scene options', () => {
    const manifest = serializeScene([], undefined, undefined, {
      showGrid: false,
      clearColor: '#000000',
    })
    expect(manifest.showGrid).toBe(false)
    expect(manifest.clearColor).toBe('#000000')
  })

  it('serializes multiple objects preserving order', () => {
    const obj1 = makeSceneObject({ id: 'a', name: 'First' })
    const obj2 = makeSceneObject({ id: 'b', name: 'Second' })
    const manifest = serializeScene([obj1, obj2])

    expect(manifest.objects).toHaveLength(2)
    expect(manifest.objects[0].name).toBe('First')
    expect(manifest.objects[1].name).toBe('Second')
  })

  it('produces valid JSON-serializable output', () => {
    const obj = makeSceneObject()
    const proj = makeProjectionItem()
    const manifest = serializeScene(
      [obj],
      { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 }, fov: 60 },
      [proj],
      { showGrid: true, clearColor: '#ffffff' }
    )

    const json = JSON.stringify(manifest)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parsed.objects).toHaveLength(1)
    expect(parsed.projections).toHaveLength(1)
    expect(parsed.camera).toBeDefined()
  })
})
