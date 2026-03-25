/**
 * A live filter attached to a SplatMesh that zeroes out the opacity of any
 * Gaussian splat whose largest scale component exceeds a threshold.
 *
 * Mutating `setMaxScale` updates the GPU shader uniform on the next frame
 * without recompiling the shader (via spark's DynoFloat live uniform).
 */
export interface SplatScaleFilter {
  getMaxScale(): number
  setMaxScale(value: number): void
}

/**
 * Builds a scale-filter GsplatModifier and its JS-side control interface.
 * The modifier must be passed as `objectModifier` in the SplatMesh constructor
 * options — setting it after initialization requires a manual updateGenerator()
 * call which is unreliable due to spark's internal double-init sequence.
 *
 * Returns `{ modifier, filter }`. Store `filter` on `mesh.userData.splatScaleFilter`
 * after awaiting `mesh.initialized`.
 */
export async function buildScaleFilter(): Promise<{
  modifier: unknown // GsplatModifier — typed as unknown to avoid hard dep
  filter: SplatScaleFilter
}> {
  // All shader-graph utilities live under the `dyno` namespace export
  const { dyno } = await import('@sparkjsdev/spark')
  const {
    dynoFloat,
    dynoBlock,
    splitGsplat,
    combineGsplat,
    Gsplat,
    greaterThan,
    select,
    max,
    split,
  } = dyno

  // Live-updatable GLSL float uniform. Permissive start: show all splats.
  // Mutating .value propagates to the GPU on the next frame without shader
  // recompile — this is what makes real-time slider updates efficient.
  const threshold = dynoFloat(1e9)

  // Build a GsplatModifier: a Dyno graph node that accepts {gsplat} and
  // emits a modified {gsplat} with filtered opacity.
  const modifier = dynoBlock(
    { gsplat: Gsplat },
    { gsplat: Gsplat },
    (inputs) => {
      // Decompose the packed gsplat into individual scalar/vector fields
      const gsplatFields = splitGsplat(inputs.gsplat!).outputs

      // Split scales vec3 → individual float DynoVals (x, y, z)
      const scaleAxes = split(gsplatFields.scales!)
      const { x: sx, y: sy, z: sz } = scaleAxes.outputs

      // Compute the largest scale component: max(max(sx, sy), sz)
      const maxScale = max(max(sx, sy), sz)

      // Compare against the live threshold uniform.
      // greaterThan(float, float) → bool; use .dynoOut() for clean type inference.
      const tooLarge = greaterThan(maxScale, threshold.dynoOut())

      // select(cond, trueVal, falseVal): zero opacity for oversized splats,
      // keep original opacity for everything else.
      const filteredOpacity = select(tooLarge, dynoFloat(0).dynoOut(), gsplatFields.opacity!)

      return {
        gsplat: combineGsplat({ gsplat: inputs.gsplat, opacity: filteredOpacity }),
      }
    }
  )

  const filter: SplatScaleFilter = {
    getMaxScale: () => threshold.value,
    setMaxScale: (v) => {
      threshold.value = v
    },
  }

  return { modifier, filter }
}
