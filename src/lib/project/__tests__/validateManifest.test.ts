import { describe, it, expect } from 'vitest'
import { validateManifest, ManifestValidationError } from '@/lib/project/validateManifest.ts'

function makeValidManifest() {
  return {
    version: 1,
    objects: [
      {
        id: 'abc-123',
        name: 'Box',
        type: 'mesh',
        source: { kind: 'primitive', geometryType: 'box' },
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        visible: true,
      },
    ],
    camera: {
      position: [18, 14, 18],
      target: [0, 0, 0],
      fov: 60,
    },
    projections: [
      {
        id: 'proj-1',
        name: 'Photo',
        imagePath: 'projections/photo.jpg',
        transform: {
          position: [0, 1.5, 0],
          rotation: [0, 0, 0],
        },
        fov: 60,
        near: 1,
        far: 200,
        visible: true,
      },
    ],
    showGrid: true,
    clearColor: '#f3e7fd',
  }
}

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const manifest = makeValidManifest()
    const result = validateManifest(manifest)
    expect(result.version).toBe(1)
    expect(result.objects).toHaveLength(1)
    expect(result.projections).toHaveLength(1)
  })

  it('accepts a minimal manifest (no camera, no projections)', () => {
    const manifest = {
      version: 1,
      objects: [],
    }
    const result = validateManifest(manifest)
    expect(result.objects).toHaveLength(0)
  })

  it('rejects null', () => {
    expect(() => validateManifest(null)).toThrow(ManifestValidationError)
  })

  it('rejects non-object', () => {
    expect(() => validateManifest('hello')).toThrow(ManifestValidationError)
  })

  it('rejects wrong version', () => {
    expect(() => validateManifest({ version: 2, objects: [] })).toThrow(
      /Unsupported manifest version: 2/
    )
  })

  it('rejects missing objects array', () => {
    expect(() => validateManifest({ version: 1 })).toThrow(/objects.*array/)
  })

  it('rejects object entry with missing id', () => {
    const manifest = {
      version: 1,
      objects: [
        {
          name: 'Box',
          visible: true,
          source: { kind: 'primitive' },
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        },
      ],
    }
    expect(() => validateManifest(manifest)).toThrow(/objects\[0\]\.id/)
  })

  it('rejects object entry with invalid transform', () => {
    const manifest = makeValidManifest()
    manifest.objects[0].transform.position = [0, 0] as any
    expect(() => validateManifest(manifest)).toThrow(/position.*\[number, number, number\]/)
  })

  it('rejects object entry with invalid source kind', () => {
    const manifest = makeValidManifest()
    ;(manifest.objects[0].source as any).kind = 'unknown'
    expect(() => validateManifest(manifest)).toThrow(/source\.kind/)
  })

  it('rejects projection entry with missing fov', () => {
    const manifest = makeValidManifest()
    delete (manifest.projections![0] as any).fov
    expect(() => validateManifest(manifest)).toThrow(/projections\[0\]\.fov/)
  })

  it('rejects projection entry with invalid transform', () => {
    const manifest = makeValidManifest()
    ;(manifest.projections![0].transform as any).position = 'not an array'
    expect(() => validateManifest(manifest)).toThrow(/position.*array/)
  })

  it('rejects camera with missing fov', () => {
    const manifest = makeValidManifest()
    delete (manifest.camera as any).fov
    expect(() => validateManifest(manifest)).toThrow(/camera\.fov/)
  })

  it('rejects camera with invalid position', () => {
    const manifest = makeValidManifest()
    ;(manifest.camera as any).position = [1, 2]
    expect(() => validateManifest(manifest)).toThrow(/camera\.position/)
  })
})
