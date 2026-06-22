---
name: lights
description: "Set up lighting for Three.js scenes — choosing light combinations, shadows, and look. Use when configuring scene lighting, fixing flat or harsh lighting, or adding shadows."
---

# Lights

A believable lit scene is a fixed three-part rig decided once at startup: image-based fill (an HDR on `scene.environment`, the dominant fill source) plus one "sun" — a directional light, here a CSM cascaded shadow map, that gives surfaces their shape and casts the shadows — plus a little ambient. The balance principle: all fill (the IBL first, then ambient) must be turned down clearly below the sun, or the shadowed side of every surface floods and cast shadows wash out. The sections below cover the available **light combinations**, **the recipe** (IBL fill + one sun + low ambient), **the sun with shadows (CSM)**, the **environment and the visible sky**, **balancing fill vs sun so shadows read**, an **intensity reference**, and why you **keep the light set fixed** at runtime.

## Light combinations

The common rigs and what each produces:

| Setup                            | Result                                      |
| -------------------------------- | ------------------------------------------- |
| AmbientLight only                | Flat uniform lighting, no shadows           |
| DirectionalLight only            | Harsh contrast, pure black shadows          |
| Ambient + Directional            | Realistic outdoor lighting (sun + sky fill) |
| Ambient + PointLights/SpotLights | Indoor scenes with local light sources      |

Ambient light controls how shadows appear — without it, shadows are pure black. Even in nighttime scenes, keep enough light (for example an `AmbientLight`) that the viewer can still see the environment.

## The recipe: IBL fill + one sun + low ambient

Ambient-only or hemisphere-only lighting looks flat and gray because nothing gives surfaces form. What reads as "a real place" is image-based fill + a sun + textured materials:

- Set `scene.environment` from an HDR (Market `environment` assets ship one) so materials pick up real image-based reflections and fill light.
- Add one directional/CSM "sun" for shape and shadows.
- Keep ambient low (`0.2–0.4` or none).

Balance the fill against the sun, or shadows wash out (see "Balancing fill vs sun so shadows read" below). Flat ambient light plus solid-color (untextured) materials is exactly the "gray clay" look — fix it with IBL, a sun, and real textures (see the `materials` skill).

## The sun with shadows (CSM)

Recommended for the sun: CSM (Cascading Shadow Maps). CSM replaces `DirectionalLight` with superior shadow quality out of the box — no need to manually configure shadow camera bounds. A lone `DirectionalLight` has a single shadow map covering one fixed frustum: over a large outdoor map its shadows are either blurry (one map stretched across hundreds of meters) or simply missing past a short range. **For any outdoor or large scene, use CSM** — its cascades keep shadows crisp from right next to the camera out to the horizon. A lone `DirectionalLight` with a small shadow frustum on a big map is wrong.

CSM looks like a lot of setup, but it is **paste-once boilerplate** — drop this helper in unchanged, then call `createCsmSun(...)` once and `csm.update()` every frame. That is the whole cost; don't trade it for a plain `DirectionalLight`.

```typescript
import { CSM } from 'three/examples/jsm/csm/CSM.js'
import { Material, MeshStandardMaterial, Vector3 } from 'three'

// Paste-once: an outdoor sun with cascaded shadows. Returns the csm; call csm.update() each frame.
function createCsmSun(scene, camera, renderer, lightDirection = new Vector3(-1, -2, -1), intensity = 2, maxFar = 200) {
  renderer.shadowMap.enabled = true // do NOT also set shadowMap.type = PCFSoftShadowMap with CSM

  const csm = new CSM({
    cascades: 4, lightDirection: lightDirection.clone().normalize(),
    camera, parent: scene, lightIntensity: intensity, maxFar, mode: 'practical',
  })
  // fade is ignored by the constructor and only takes effect after a frustum rebuild,
  // so set it then rebuild — otherwise cascade seams stay hard.
  csm.fade = true
  csm.updateFrustums()

  const biases = [-0.00001, -0.0001, -0.0003, -0.0006]
  const normalBiases = [0.02, 0.06, 0.16, 0.3]
  csm.lights.forEach((light, i) => {
    light.shadow.bias = biases[i] ?? -0.0006
    light.shadow.normalBias = normalBiases[i] ?? 0.3
  })

  // CSM injects its shader chunks into materials lazily at render time. Apply it ONLY to the lit
  // PBR materials that actually receive shadows (MeshStandardMaterial — terrain, characters, props).
  // Splicing CSM's shadow chunks into materials with no lighting pipeline — additive sprites, points,
  // MeshBasicMaterial, and other transparent VFX/UI — breaks their shaders so they render as dark
  // quads (the classic "dark planes" over muzzle flashes and particles); those never receive shadows
  // anyway. setupMaterial OVERWRITES material.onBeforeCompile, so only re-chain a material's existing
  // hook when it actually has one — stock materials don't, and calling .apply on a missing prior hook
  // would throw.
  const done = new WeakSet<Material>()
  const original = renderer.renderBufferDirect.bind(renderer)
  renderer.renderBufferDirect = function (cam, sc, geom, material, object, group) {
    if (material instanceof MeshStandardMaterial && !done.has(material)) {
      done.add(material)
      const prev = material.onBeforeCompile
      csm.setupMaterial(material)
      const csmHook = material.onBeforeCompile
      if (typeof prev === 'function' && prev !== csmHook) {
        material.onBeforeCompile = (...args) => { prev.apply(material, args); csmHook.apply(material, args) }
      }
    }
    return original(cam, sc, geom, material, object, group)
  }
  return csm
}
```

Use it — and call `csm.update()` every frame, **before** `renderer.render(...)`. Forgetting `csm.update()` is the one easy mistake — shadows then won't follow the camera.

```typescript
scene.add(new THREE.AmbientLight(0xffffff, 0.4)) // fill, so shadows aren't pure black
const csm = createCsmSun(scene, camera, renderer)
// in the render loop, BEFORE renderer.render(...):
csm.update()
```

## Environment & the visible sky

Set `scene.environment` from an HDR for image-based fill (above); the visible sky is a separate, related step. The visible sky must be an equirectangular skybox, not a flat image. To show the sky behind the scene, assign the equirectangular panorama to `scene.background` **and set its mapping**, so Three.js wraps it around the world as a skybox that stays put as the camera turns:

```typescript
const sky = await new TextureLoader().loadAsync('/environment/<name>-background.webp')
sky.mapping = EquirectangularReflectionMapping // without this it renders as a flat 2D screen image
sky.colorSpace = SRGBColorSpace
scene.background = sky
```

Never parent a sky image to the camera — that pins a flat picture to the view instead of giving the world a real horizon.

## Balancing fill vs sun so shadows read

**Balance the fill against the sun, or the shadows wash out.** A bright IBL environment (a clear midday sky especially) plus a high `AmbientLight` floods the shadowed side of every surface, so the sun's cast shadows fade to nearly invisible even when shadow-casting is wired correctly.

The **IBL is usually the bigger fill source than `AmbientLight`** — a bright sky env at full strength washes shadows on its own — so balancing only `AmbientLight` is not enough: also turn `scene.environmentIntensity` down (often `~0.3–0.6`) and keep the sun clearly brighter than both, or shadows stay flat. Keep ambient low (`0.2–0.4` or none) too, then confirm by eye that objects drop a readable shadow.

A correctly set-up CSM showing *no* shadows on screen is almost always drowned by fill, not broken — turn the fill (IBL first) down before suspecting the shadow pipeline. Flat ambient light plus untextured materials is the "gray clay" look — fix it with IBL, a sun, and real textures (see the `materials` skill).

## Intensity reference

- **AmbientLight**: `0.3–0.6` (fill light)
- **CSM lightIntensity**: `1–3` (sun-like, affects entire scene)
- **PointLight / SpotLight**: `1–5` with reasonable `distance` (e.g. `10–50`)

Tone-map the HDR range with `renderer.toneMapping = ACESFilmicToneMapping` and exposure ~1.

## Keep the light set fixed (runtime cost)

Three.js bakes the **number** of lights (and of shadow-casting lights) into every material's shader. Adding or removing a light — or toggling a light's `castShadow` — at runtime forces a **recompile of all materials**, which stalls the frame. Spawning a light per effect (a muzzle flash, an explosion) produces a visible hitch on every shot.

- Decide the light rig once at startup and keep the count fixed.
- For muzzle flashes, explosions, and pulses, **do not add a light**. Animate the `intensity`/`color` of one pre-created, normally-dim light, or fake the glow with an emissive material or an additive sprite. If you genuinely need moving light sources, pool a few reusable ones created up front.
- The same applies to materials: changing a material's *defines* (e.g. adding/removing a map) recompiles too — prefer animating a uniform or `color`.
