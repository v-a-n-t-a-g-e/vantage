import * as THREE from 'three'

/**
 * Resolves a CSS custom property to a THREE.Color by temporarily applying
 * it as an element's color and reading back the computed rgb() value.
 * This correctly handles var() references like --color-brand: var(--color-green).
 */
function resolveColor(varName: string): THREE.Color {
  const el = document.createElement('div')
  document.body.appendChild(el)
  el.style.color = `var(${varName})`
  const rgb = getComputedStyle(el).color
  document.body.removeChild(el)
  return new THREE.Color(rgb)
}

export const themeColors = {
  get axisX() { return resolveColor('--color-axis-x') },
  get axisY() { return resolveColor('--color-axis-y') },
  get axisZ() { return resolveColor('--color-axis-z') },
  get brand() { return resolveColor('--color-brand') },
}
