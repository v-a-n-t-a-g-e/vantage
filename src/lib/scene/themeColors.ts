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

/** Hardcoded fallbacks matching theme.css — usable without a DOM. */
export const themeColorDefaults = {
  brand: new THREE.Color('#01ff00'),
  axisX: new THREE.Color('#ff7704'),
  axisY: new THREE.Color('#41b8ff'),
  axisZ: new THREE.Color('#01ff00'),
}

/** Reads live CSS custom properties from the DOM. Requires the theme CSS to be loaded. */
export const themeColors = {
  get axisX() {
    return resolveColor('--color-vantage-axis-x')
  },
  get axisY() {
    return resolveColor('--color-vantage-axis-y')
  },
  get axisZ() {
    return resolveColor('--color-vantage-axis-z')
  },
  get brand() {
    return resolveColor('--color-vantage-brand')
  },
}
