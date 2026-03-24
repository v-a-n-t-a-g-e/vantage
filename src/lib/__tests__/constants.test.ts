import { describe, it, expect } from 'vitest'
import {
  HISTORY_MAX_COMMANDS,
  CAMERA_DEFAULTS,
  DRAG_PIXEL_THRESHOLD,
  CLICK_PIXEL_THRESHOLD,
  FILE_PATTERNS,
  PROJECT_DIRS,
} from '@/lib/constants.ts'

describe('constants', () => {
  it('HISTORY_MAX_COMMANDS is a positive integer', () => {
    expect(HISTORY_MAX_COMMANDS).toBeGreaterThan(0)
    expect(Number.isInteger(HISTORY_MAX_COMMANDS)).toBe(true)
  })

  it('CAMERA_DEFAULTS has reasonable values', () => {
    expect(CAMERA_DEFAULTS.fov).toBeGreaterThan(0)
    expect(CAMERA_DEFAULTS.near).toBeGreaterThan(0)
    expect(CAMERA_DEFAULTS.far).toBeGreaterThan(CAMERA_DEFAULTS.near)
    expect(CAMERA_DEFAULTS.position).toHaveLength(3)
  })

  it('thresholds are positive numbers', () => {
    expect(DRAG_PIXEL_THRESHOLD).toBeGreaterThan(0)
    expect(CLICK_PIXEL_THRESHOLD).toBeGreaterThan(0)
  })

  it('FILE_PATTERNS.MODEL matches gltf/glb files', () => {
    expect(FILE_PATTERNS.MODEL.test('model.gltf')).toBe(true)
    expect(FILE_PATTERNS.MODEL.test('model.glb')).toBe(true)
    expect(FILE_PATTERNS.MODEL.test('model.GLB')).toBe(true)
    expect(FILE_PATTERNS.MODEL.test('model.png')).toBe(false)
    expect(FILE_PATTERNS.MODEL.test('model.txt')).toBe(false)
  })

  it('FILE_PATTERNS.IMAGE matches image files', () => {
    expect(FILE_PATTERNS.IMAGE.test('photo.jpg')).toBe(true)
    expect(FILE_PATTERNS.IMAGE.test('photo.jpeg')).toBe(true)
    expect(FILE_PATTERNS.IMAGE.test('photo.png')).toBe(true)
    expect(FILE_PATTERNS.IMAGE.test('photo.webp')).toBe(true)
    expect(FILE_PATTERNS.IMAGE.test('photo.JPEG')).toBe(true)
    expect(FILE_PATTERNS.IMAGE.test('model.glb')).toBe(false)
  })

  it('PROJECT_DIRS contains required directories', () => {
    expect(PROJECT_DIRS).toContain('models')
    expect(PROJECT_DIRS).toContain('projections')
  })
})
