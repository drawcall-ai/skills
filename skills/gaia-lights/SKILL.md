---
name: gaia-lights
description: "Set up lighting for Three.js scenes — choosing light combinations, shadows, and look. Use when configuring scene lighting, fixing flat or harsh lighting, or adding shadows."
---

# Lights

## Light Setups

| Setup                            | Result                                      |
| -------------------------------- | ------------------------------------------- |
| AmbientLight only                | Flat uniform lighting, no shadows           |
| DirectionalLight only            | Harsh contrast, pure black shadows          |
| Ambient + Directional            | Realistic outdoor lighting (sun + sky fill) |
| Ambient + PointLights/SpotLights | Indoor scenes with local light sources      |

Ambient light controls shadow appearance—without it, shadows are pure black. Even in nighttime scenes, keep enough light (e.g. AmbientLight) for the viewer to see the environment.

## Recommended Setup

Use AmbientLight + CSM (Cascading Shadow Maps). CSM replaces DirectionalLight with superior shadow quality out of the box—no need to manually configure shadow camera bounds.

```typescript
import { CSM } from 'three/examples/jsm/csm/CSM.js'
import { Material } from 'three'

// Required to enable shadows
renderer.shadowMap.enabled = true

//DO NOT use this with csm: renderer.shadowMap.type = THREE.PCFSoftShadowMap

const ambient = new THREE.AmbientLight(0xffffff, 0.4)
scene.add(ambient)

const sunPosition = new THREE.Vector3(10, 20, 10)

const csm = new CSM({
  cascades: 4,
  lightDirection: sunPosition.clone().negate(),
  camera: camera,
  parent: scene,
  lightIntensity: 2,
  maxFar: 200,
  mode: 'practical',
})
csm.fade = true

// Required to prevent shadow acne
const biases = [-0.00001, -0.0001, -0.0003, -0.0006]
const normalBiases = [0.02, 0.06, 0.16, 0.3]
csm.lights.forEach((light, i) => {
  light.shadow.bias = biases[i] ?? biases.at(-1)!
  light.shadow.normalBias = normalBiases[i] ?? normalBiases.at(-1)!
})

// Required to setup CSM for any material at render time
const csmMaterials = new WeakSet<Material>()
const originalRenderBufferDirect = renderer.renderBufferDirect.bind(renderer)
renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
  if (material && !csmMaterials.has(material)) {
    csmMaterials.add(material)
    const originalOnBeforeCompile = material.onBeforeCompile
    csm.setupMaterial(material)
    // Chain CSM's onBeforeCompile with any existing one
    if (material.onBeforeCompile !== originalOnBeforeCompile) {
      const csmOnBeforeCompile = material.onBeforeCompile
      material.onBeforeCompile = function (...args) {
        originalOnBeforeCompile.apply(this, args)
        csmOnBeforeCompile.apply(this, args)
      }
    }
  }
  return originalRenderBufferDirect(camera, scene, geometry, material, object, group)
}
```

Make sure to enable the shadow map, do not use `PCFSoftShadowMap`, set the biases to prevent shadow acne, and setup the `renderBufferDirect` to prepare the materials for CSM.
Additionally, make sure to call `csm.update()` in your render loop to keep shadows aligned with the camera.

## Intensity

- **AmbientLight**: `0.3–0.6` (fill light)
- **CSM lightIntensity**: `1–3` (sun-like, affects entire scene)
- **PointLight / SpotLight**: `1–5` with reasonable `distance` (e.g. `10–50`)
