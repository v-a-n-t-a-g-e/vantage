# Vantage

A 3D scene editor for projection mapping. Import models, position cameras, and project images onto geometry with depth-aware materials.

Built with Svelte 5, Three.js, and TypeScript.

## Library

The projection system, scene serialization, and theme are published as `@krisenstab/vantage` on npm. Three.js is a peer dependency — install it alongside the package.

```sh
npm i @krisenstab/vantage three
```

### Exports

Import from `@krisenstab/vantage`:

| Export                   | Description                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| `VantageProjection`      | Camera that projects a texture onto scene geometry. Extends `PerspectiveCamera`. |
| `ProjectionMaterial`     | Custom shader material used internally by `VantageProjection`.                   |
| `ProjectionHelper`       | Frustum and near/far plane visualizer for a projection.                          |
| `loadTexture`            | Async texture loader returning a Three.js `Texture`.                             |
| `serializeScene`         | Converts scene objects and projections into a `SceneManifest`.                   |
| `deserializeScene`       | Reconstructs `SceneObject[]` from a manifest and a file reader.                  |
| `deserializeProjections` | Reconstructs `ProjectionItem[]` from manifest entries and a file reader.         |
| `themeColors`            | Live CSS-backed `{ axisX, axisY, axisZ, brand }` as `THREE.Color` getters.       |
| `themeColorDefaults`     | Hardcoded fallback colors (no DOM required).                                     |
| `UI_LAYER`               | Three.js layer index used for non-pickable UI geometry.                          |

Types are included: `SceneManifest`, `SceneObject`, `ProjectionItem`, `ProjectionEntry`, `SceneObjectEntry`, `CameraState`, `Tool`, `TransformTool`, and more.

### Example

```js
import { VantageProjection, loadTexture } from '@krisenstab/vantage'
import * as THREE from 'three'

const projection = new VantageProjection({ fov: 60, near: 5, far: 1000 })
projection.position.set(10, 8, 10)
projection.lookAt(0, 0, 0)

const texture = await loadTexture(imageUrl)
projection.setTexture(texture)

// Apply the projection to a mesh — adds a depth-aware shader overlay
projection.project(mesh)

// In render loop: update depth maps, then render the scene
projection.update(renderer, scene)
renderer.render(scene, camera)
```

### Theme CSS

Import `@krisenstab/vantage/theme.css` to get Tailwind v4 theme variables, custom utilities, and the Space Grotesk font:

```css
@import '@krisenstab/vantage/theme.css';
```

This provides:

**Colors** (as Tailwind `@theme` variables):

| Variable                 | Value                        |
| ------------------------ | ---------------------------- |
| `--color-vantage-green`  | `#01ff00`                    |
| `--color-vantage-blue`   | `#41b8ff`                    |
| `--color-vantage-red`    | `#ff7704`                    |
| `--color-vantage-brand`  | `var(--color-vantage-green)` |
| `--color-vantage-axis-x` | `var(--color-vantage-red)`   |
| `--color-vantage-axis-y` | `var(--color-vantage-blue)`  |
| `--color-vantage-axis-z` | `var(--color-vantage-green)` |

**Utilities:**

| Class          | Effect                                                     |
| -------------- | ---------------------------------------------------------- |
| `ui-container` | `pointer-events-auto`, white background, black border      |
| `ui-button`    | Flex row, 40px height, horizontal padding, hover highlight |
| `tnum`         | Tabular number font features                               |

## Development

### Prerequisites

Node.js 24+

### Setup

```sh
npm install
npm run dev
```

### Scripts

| Script              | Description                                    |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start dev server with HMR                      |
| `npm run build`     | Build the app for production                   |
| `npm run build:lib` | Build the library bundle and type declarations |
| `npm run preview`   | Preview the production build locally           |
| `npm test`          | Run tests (Vitest)                             |
| `npm run lint`      | Lint with ESLint                               |
| `npm run format`    | Format with Prettier                           |

### Tech stack

|           |                |
| --------- | -------------- |
| Framework | Svelte 5       |
| 3D        | Three.js r183  |
| Bundler   | Vite 8         |
| CSS       | Tailwind CSS 4 |
| Language  | TypeScript 5.9 |
| Tests     | Vitest         |

### Publish to npm

```
npm version patch
git push && git push --tags
```
