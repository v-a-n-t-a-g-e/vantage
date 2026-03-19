import * as THREE from 'three'

/**
 * Mesh-based infinite grid on the XZ plane with adaptive LOD.
 *
 * Uses a real PlaneGeometry that follows the camera (Fyrestar approach)
 * instead of ray-plane intersection. World positions come from standard
 * vertex interpolation, which is numerically stable at any distance.
 *
 * Grid spacing adapts to camera distance from origin:
 *   close:  0.1 / 1 unit lines
 *   mid:    1 / 10
 *   far:    10 / 100
 *   etc.
 */
export class InfiniteGrid extends THREE.Mesh {
  constructor() {
    const geometry = new THREE.PlaneGeometry(2, 2, 1, 1)

    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,

      uniforms: {
        uColor: { value: new THREE.Color(0.45, 0.45, 0.45) },
        uDistance: { value: 200.0 },
        uCamPos: { value: new THREE.Vector3() },
      },

      vertexShader: /* glsl */ `
        uniform float uDistance;

        varying vec3 vWorldPos;

        void main() {
          // Orient the XY plane to XZ, scale by uDistance, follow camera
          vec3 pos = position.xzy * uDistance;
          pos.xz += cameraPosition.xz;

          vWorldPos = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uDistance;
        uniform vec3 uCamPos;

        varying vec3 vWorldPos;

        float gridLine(float scale) {
          vec2 r = vWorldPos.xz / scale;
          vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
          float line = min(grid.x, grid.y);
          return 1.0 - min(line, 1.0);
        }

        void main() {
          // LOD based on camera distance from origin
          float camDist = max(length(uCamPos), 1.0);
          float logDist = log2(camDist) / log2(10.0);
          float level = logDist - 0.5;
          float levelFloor = floor(level);
          float levelFract = level - levelFloor;

          float minorA = pow(10.0, levelFloor);
          float majorA = pow(10.0, levelFloor + 1.0);
          float minorB = pow(10.0, levelFloor + 1.0);
          float majorB = pow(10.0, levelFloor + 2.0);

          float gMinorA = gridLine(minorA);
          float gMajorA = gridLine(majorA);
          float gMinorB = gridLine(minorB);
          float gMajorB = gridLine(majorB);

          float lineA = gMinorA * 0.15 + gMajorA * 0.4;
          float lineB = gMinorB * 0.15 + gMajorB * 0.4;
          float line = mix(lineA, lineB, levelFract);

          // Distance-adaptive fade
          float fadeRadius = camDist * 6.0;
          float dist = distance(cameraPosition.xz, vWorldPos.xz);
          float fade = 1.0 - smoothstep(fadeRadius * 0.4, fadeRadius, dist);

          float alpha = line * fade;
          if (alpha < 0.001) discard;

          gl_FragColor = vec4(uColor, alpha);
        }
      `,

      extensions: {
        derivatives: true,
      } as any,
    })

    super(geometry, material)
    this.frustumCulled = false
    this.renderOrder = -1
  }

  /** Call each frame to sync uniforms. */
  update(camera: THREE.Camera) {
    const mat = this.material as THREE.ShaderMaterial
    const camPos = camera.position
    mat.uniforms.uCamPos.value.copy(camPos)
    // Scale mesh to always cover the visible area
    const camDist = Math.max(camPos.length(), 1)
    mat.uniforms.uDistance.value = Math.max(camDist * 8, 200)
  }
}
