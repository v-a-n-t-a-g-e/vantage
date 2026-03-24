// ── History ──
export const HISTORY_MAX_COMMANDS = 100

// ── Camera defaults ──
export const CAMERA_DEFAULTS = {
  fov: 60,
  near: 0.1,
  far: 100000,
  position: [18, 14, 18] as const,
}

// ── UI thresholds ──
export const DRAG_PIXEL_THRESHOLD = 5
export const CLICK_PIXEL_THRESHOLD = 3

// ── File patterns ──
export const FILE_PATTERNS = {
  MODEL: /\.(gltf|glb)$/i,
  IMAGE: /\.(jpe?g|png|webp)$/i,
} as const

// ── Project directories ──
export const PROJECT_DIRS = ['models', 'projections'] as const
