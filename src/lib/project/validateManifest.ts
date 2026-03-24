import type { SceneManifest, SceneObjectEntry, ProjectionEntry } from './types.ts'

export class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestValidationError'
  }
}

function assertType(value: unknown, type: string, path: string): void {
  if (typeof value !== type) {
    throw new ManifestValidationError(
      `Expected ${path} to be ${type}, got ${typeof value}`
    )
  }
}

function assertArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new ManifestValidationError(
      `Expected ${path} to be an array, got ${typeof value}`
    )
  }
}

function assertVec3(value: unknown, path: string): asserts value is [number, number, number] {
  assertArray(value, path)
  if (value.length !== 3 || !value.every((v) => typeof v === 'number')) {
    throw new ManifestValidationError(
      `Expected ${path} to be [number, number, number]`
    )
  }
}

function validateTransform(
  transform: unknown,
  path: string,
  includeScale: boolean
): void {
  if (!transform || typeof transform !== 'object') {
    throw new ManifestValidationError(`Expected ${path} to be an object`)
  }
  const t = transform as Record<string, unknown>
  assertVec3(t.position, `${path}.position`)
  assertVec3(t.rotation, `${path}.rotation`)
  if (includeScale) assertVec3(t.scale, `${path}.scale`)
}

function validateObjectEntry(entry: unknown, index: number): asserts entry is SceneObjectEntry {
  const path = `objects[${index}]`
  if (!entry || typeof entry !== 'object') {
    throw new ManifestValidationError(`Expected ${path} to be an object`)
  }
  const e = entry as Record<string, unknown>

  assertType(e.id, 'string', `${path}.id`)
  assertType(e.name, 'string', `${path}.name`)
  assertType(e.visible, 'boolean', `${path}.visible`)

  if (!e.source || typeof e.source !== 'object') {
    throw new ManifestValidationError(`Expected ${path}.source to be an object`)
  }
  const source = e.source as Record<string, unknown>
  if (source.kind !== 'primitive' && source.kind !== 'imported') {
    throw new ManifestValidationError(
      `Expected ${path}.source.kind to be 'primitive' or 'imported', got '${source.kind}'`
    )
  }

  validateTransform(e.transform, `${path}.transform`, true)
}

function validateProjectionEntry(
  entry: unknown,
  index: number
): asserts entry is ProjectionEntry {
  const path = `projections[${index}]`
  if (!entry || typeof entry !== 'object') {
    throw new ManifestValidationError(`Expected ${path} to be an object`)
  }
  const e = entry as Record<string, unknown>

  assertType(e.id, 'string', `${path}.id`)
  assertType(e.name, 'string', `${path}.name`)
  assertType(e.imagePath, 'string', `${path}.imagePath`)
  assertType(e.fov, 'number', `${path}.fov`)
  assertType(e.near, 'number', `${path}.near`)
  assertType(e.far, 'number', `${path}.far`)
  assertType(e.visible, 'boolean', `${path}.visible`)

  validateTransform(e.transform, `${path}.transform`, false)
}

/**
 * Validate a parsed JSON object against the SceneManifest schema.
 * Throws ManifestValidationError with a descriptive message on failure.
 */
export function validateManifest(data: unknown): SceneManifest {
  if (!data || typeof data !== 'object') {
    throw new ManifestValidationError('Manifest must be a JSON object')
  }
  const d = data as Record<string, unknown>

  if (d.version !== 1) {
    throw new ManifestValidationError(
      `Unsupported manifest version: ${d.version} (expected 1)`
    )
  }

  assertArray(d.objects, 'objects')
  for (let i = 0; i < d.objects.length; i++) {
    validateObjectEntry(d.objects[i], i)
  }

  if (d.projections !== undefined) {
    assertArray(d.projections, 'projections')
    for (let i = 0; i < d.projections.length; i++) {
      validateProjectionEntry(d.projections[i], i)
    }
  }

  if (d.camera !== undefined) {
    if (!d.camera || typeof d.camera !== 'object') {
      throw new ManifestValidationError('Expected camera to be an object')
    }
    const cam = d.camera as Record<string, unknown>
    assertVec3(cam.position, 'camera.position')
    assertVec3(cam.target, 'camera.target')
    assertType(cam.fov, 'number', 'camera.fov')
  }

  return data as SceneManifest
}
