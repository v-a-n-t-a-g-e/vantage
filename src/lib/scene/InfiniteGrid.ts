import * as THREE from 'three'

/**
 * Shader-based infinite grid on the XZ plane.
 *
 * Uses a full-screen triangle and reconstructs world-space positions
 * by intersecting view rays with the Y = 0 plane in the fragment shader.
 */
export class InfiniteGrid extends THREE.Mesh {
  constructor() {
    // Full-screen triangle (3 verts in NDC, covers entire viewport)
    // Using 3-component positions so Three.js boundingSphere doesn't NaN
    const geometry = new THREE.BufferGeometry()
    const vertices = new Float32Array([
      -1, -1, 0,
       3, -1, 0,
      -1,  3, 0,
    ])
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))

    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,

      uniforms: {
        uScale1: { value: 10.0 },
        uScale2: { value: 100.0 },
        uFade: { value: 2000.0 },
        uColor: { value: new THREE.Color(0.45, 0.45, 0.45) },
        uViewProj: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
      },

      // NOTE: projectionMatrix / viewMatrix / cameraPosition are only
      // auto-injected into the VERTEX shader, not fragment.
      // We pass a combined uViewProj + uCamPos uniform for the fragment.

      vertexShader: /* glsl */ `
        varying vec3 vNearPoint;
        varying vec3 vFarPoint;

        vec3 unprojectPoint(vec2 p, float z) {
          mat4 viewInv = inverse(viewMatrix);
          mat4 projInv = inverse(projectionMatrix);
          vec4 unprojected = viewInv * projInv * vec4(p, z, 1.0);
          return unprojected.xyz / unprojected.w;
        }

        void main() {
          vec2 p = position.xy;
          vNearPoint = unprojectPoint(p, -1.0);
          vFarPoint  = unprojectPoint(p,  1.0);
          gl_Position = vec4(p, 0.0, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        uniform float uScale1;
        uniform float uScale2;
        uniform float uFade;
        uniform vec3 uColor;
        uniform mat4 uViewProj;
        uniform vec3 uCamPos;

        varying vec3 vNearPoint;
        varying vec3 vFarPoint;

        float gridLine(vec2 coord, float scale) {
          vec2 derivative = fwidth(coord);
          vec2 grid = abs(fract(coord / scale - 0.5) - 0.5) / derivative * scale;
          float line = min(grid.x, grid.y);
          return 1.0 - min(line, 1.0);
        }

        float computeDepth(vec3 pos) {
          vec4 clip = uViewProj * vec4(pos, 1.0);
          return (clip.z / clip.w) * 0.5 + 0.5;
        }

        void main() {
          // Ray-plane intersection: find t where ray hits Y = 0
          float t = -vNearPoint.y / (vFarPoint.y - vNearPoint.y);

          // Discard fragments above/behind the horizon
          if (t < 0.0 || t > 1.0) discard;

          vec3 worldPos = vNearPoint + t * (vFarPoint - vNearPoint);

          // Grid lines at two scales
          float g1 = gridLine(worldPos.xz, uScale1);
          float g2 = gridLine(worldPos.xz, uScale2);

          // Light lines (minor), darker lines (major)
          float line = g1 * 0.15 + g2 * 0.4;

          // Distance fade
          float dist = length(worldPos - uCamPos);
          float fade = 1.0 - smoothstep(uFade * 0.3, uFade, dist);

          float alpha = line * fade;
          if (alpha < 0.001) discard;

          // Write proper depth so the grid is occluded by scene objects
          gl_FragDepth = computeDepth(worldPos);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    super(geometry, material)
    this.frustumCulled = false
    this.renderOrder = -1
  }

  /** Call each frame to sync the view-projection matrix uniform. */
  update(camera: THREE.Camera) {
    const mat = this.material as THREE.ShaderMaterial
    mat.uniforms.uViewProj.value
      .copy(camera.projectionMatrix)
      .multiply(camera.matrixWorldInverse)
    mat.uniforms.uCamPos.value.copy(camera.position)
  }
}
