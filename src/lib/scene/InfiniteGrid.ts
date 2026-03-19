import * as THREE from 'three'

/**
 * Shader-based infinite grid on the XZ plane with adaptive LOD.
 *
 * Grid spacing scales with camera distance from the origin:
 *   close:  0.1 / 1 unit lines
 *   mid:    1 / 10
 *   far:    10 / 100
 *   etc.
 *
 * Two adjacent LOD levels are always blended so the transition
 * between scales is seamless. Fade distance also scales with
 * camera distance so the grid is always visible.
 */
export class InfiniteGrid extends THREE.Mesh {
  constructor() {
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
        uColor: { value: new THREE.Color(0.45, 0.45, 0.45) },
        uViewProj: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
      },

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
          if (t < 0.0 || t > 1.0) discard;

          vec3 worldPos = vNearPoint + t * (vFarPoint - vNearPoint);

          // Camera distance from origin drives LOD
          float camDist = length(uCamPos);
          // Clamp to a minimum so we don't get degenerate scales at origin
          camDist = max(camDist, 1.0);

          // Compute the current LOD level (log10 of distance)
          // Each LOD level is a power of 10: 0.1, 1, 10, 100, ...
          float logDist = log2(camDist) / log2(10.0);
          // Shift so the transition happens at sensible distances
          // At distance ~3 we see 0.1/1, at ~30 we see 1/10, at ~300 we see 10/100
          float level = logDist - 0.5;
          float levelFloor = floor(level);
          float levelFract = level - levelFloor;

          // Two adjacent LOD scales (minor / major)
          // Each LOD: minor = 10^levelFloor, major = 10^(levelFloor+1)
          float minorA = pow(10.0, levelFloor);
          float majorA = pow(10.0, levelFloor + 1.0);
          float minorB = pow(10.0, levelFloor + 1.0);
          float majorB = pow(10.0, levelFloor + 2.0);

          // Grid lines for both LOD levels
          float gMinorA = gridLine(worldPos.xz, minorA);
          float gMajorA = gridLine(worldPos.xz, majorA);
          float gMinorB = gridLine(worldPos.xz, minorB);
          float gMajorB = gridLine(worldPos.xz, majorB);

          // Compose each level: light minor + darker major
          float lineA = gMinorA * 0.15 + gMajorA * 0.4;
          float lineB = gMinorB * 0.15 + gMajorB * 0.4;

          // Cross-fade: fade out level A's minor lines, fade in level B
          float line = mix(lineA, lineB, levelFract);

          // Distance-adaptive fade: scales with camera distance
          float fadeRadius = camDist * 6.0;
          float dist = length(worldPos - uCamPos);
          float fade = 1.0 - smoothstep(fadeRadius * 0.4, fadeRadius, dist);

          float alpha = line * fade;
          if (alpha < 0.001) discard;

          gl_FragDepth = computeDepth(worldPos);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    super(geometry, material)
    this.frustumCulled = false
    this.renderOrder = -1
  }

  /** Call each frame to sync uniforms. */
  update(camera: THREE.Camera) {
    const mat = this.material as THREE.ShaderMaterial
    mat.uniforms.uViewProj.value
      .copy(camera.projectionMatrix)
      .multiply(camera.matrixWorldInverse)
    mat.uniforms.uCamPos.value.copy(camera.position)
  }
}
