---
name: postprocessing
description: "Finish a 3D scene's look with the postprocessing library — a tasteful pass (ambient occlusion, subtle bloom, tone mapping, color grading) plus the correct WebGLRenderer attributes. Use to make a scene read as a polished game rather than a raw render, or for any screen-space image effect."
---

# Post Processing via `postprocessing`

A correct render of good geometry still looks unfinished without a finishing pass — that flat, raw look. A light, tasteful pass is part of a polished game's look, not an optional extra: **ambient occlusion** to ground objects in contact shadow, a **subtle bloom** so emissive and bright things glow, and **tone mapping + a gentle color grade** to set mood. Add it once the scene reads correctly, and keep it restrained — heavy bloom or crushed grading looks worse than none.

Post processing introduces the concept of passes and effects to extend the common rendering workflow with fullscreen image manipulation tools. The following WebGL attributes should be used for an optimal post processing workflow:

```js
import { WebGLRenderer } from 'three'

const renderer = new WebGLRenderer({
  powerPreference: 'high-performance',
  antialias: false,
  stencil: false,
  depth: false,
})
```

The `EffectComposer` manages and runs passes. It is common practice to use a `RenderPass` as the first pass to automatically clear the buffers and render a scene for further processing. Fullscreen image effects are rendered via the `EffectPass`.

A single `EffectPass` merges any number of effects into one shader, so group the finishing effects into it. The full tasteful pass — ambient occlusion, subtle bloom, then tone mapping last — wires up like this:

```js
import {
  EffectComposer, EffectPass, RenderPass, NormalPass,
  SSAOEffect, BloomEffect, ToneMappingEffect, ToneMappingMode,
} from 'postprocessing'
import { HalfFloatType } from 'three'

const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType })
composer.addPass(new RenderPass(scene, camera))

// Ambient occlusion needs scene normals: add a NormalPass and feed its texture to SSAOEffect.
// new SSAOEffect(camera) alone (no normal buffer) renders nothing — this is the usual AO mistake.
const normalPass = new NormalPass(scene, camera)
composer.addPass(normalPass) // but hide transparent VFX for this pass — see "SSAO and transparent objects" below
const ssao = new SSAOEffect(camera, normalPass.texture, { worldDistanceThreshold: 20, worldDistanceFalloff: 5, radius: 0.1, intensity: 2 })

const bloom = new BloomEffect({ intensity: 0.4, luminanceThreshold: 0.85 }) // subtle — see below
const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })

// Tone mapping goes LAST. Effects in one EffectPass apply in array order.
composer.addPass(new EffectPass(camera, ssao, bloom, toneMapping))

renderer.setAnimationLoop(() => composer.render())
```

For a gentle color grade, add a grading effect into the same `EffectPass` (before tone mapping): `BrightnessContrastEffect`, `HueSaturationEffect`, or `LUT3DEffect` for a film LUT. Keep it restrained — a few points of contrast and saturation, not a heavy wash.

## SSAO and transparent objects (dark halos around VFX)

The `NormalPass` renders the whole scene into a normal buffer with an override material, transparent objects included. But transparent VFX — additive muzzle flashes, particles, tracers, beams, UI planes — render with `depthWrite: false`, so they never enter the depth buffer SSAO also samples. SSAO then finds a normal with no matching depth and carves an occlusion halo around each one: faint dark quads that track your particles, most visible when shooting. (This is a *different* bug from CSM rendering VFX as solid dark quads by splicing shadow code into their shaders — see the `lights` skill.)

Keep transparent objects out of the `NormalPass` so its normals match the depth buffer. The reliable, general fix is to hide every transparent object just for that pass and restore it after — a pair of no-op passes bracketing the `NormalPass`:

```ts
import { Pass } from 'postprocessing'

// Hides (or restores) every transparent object so the NormalPass sees only opaque geometry.
class TransparentToggle extends Pass {
  constructor(scene, hidden, hide) { super('TransparentToggle'); this.scene = scene; this.hidden = hidden; this.hide = hide; this.needsSwap = false }
  render() {
    if (this.hide) this.scene.traverse((o) => { if (o.visible && o.material?.transparent) { this.hidden.push(o); o.visible = false } })
    else { for (const o of this.hidden) o.visible = true; this.hidden.length = 0 }
  }
}

const hidden = []
composer.addPass(new TransparentToggle(scene, hidden, true)) // hide for the normal pass
composer.addPass(normalPass)
composer.addPass(new TransparentToggle(null, hidden, false)) // restore before the effect pass draws the lit color buffer
```

Opaque AO surfaces are unaffected — they still ground objects with contact shadow.

## Output Color Space

New applications should follow a linear workflow for color management and postprocessing supports this automatically. Simply set `WebGLRenderer.outputColorSpace` to `SRGBColorSpace` and postprocessing will follow suit.

Postprocessing uses `UnsignedByteType` sRGB frame buffers to store intermediate results. This is a trade-off between hardware support, efficiency and quality since linear results normally require at least 12 bits per color channel to prevent color degradation and banding. With low precision sRGB buffers, colors will be clamped to `[0.0, 1.0]` and information loss will shift to the darker spectrum which leads to noticable banding in dark scenes. Linear, high precision `HalfFloatType` buffers don't have these issues and are the preferred option for HDR-like workflows on desktop devices. You can enable high precision frame buffers as follows:

```ts
import { HalfFloatType } from 'three'

const composer = new EffectComposer(renderer, {
  frameBufferType: HalfFloatType,
})
```

## Tone Mapping

Tone mapping is the process of converting HDR colors to LDR output colors. When using postprocessing, the `toneMapping` setting on the renderer should be set to `NoToneMapping` (default) and high precision frame buffers should be enabled. Otherwise, colors will be mapped to `[0.0, 1.0]` at the start of the pipeline. To enable tone mapping, use a `ToneMappingEffect` at the end of the pipeline.

Note that tone mapping is not applied to the clear color when using only the renderer because clearing doesn't involve shaders. Postprocessing applies to the full input image which means that tone mapping will also be applied uniformly. Consequently, the results of tone mapping a clear color background with and without postprocessing will be different, with the postprocessing approach being correct.

## Performance

This library provides an `EffectPass` which automatically organizes and merges any given combination of effects. This minimizes the amount of render operations and makes it possible to combine many effects without the performance penalties of traditional pass chaining. Additionally, every effect can choose its own blend function.

All fullscreen render operations also use a single triangle that fills the screen. Compared to using a quad, this approach harmonizes with modern GPU rasterization patterns and eliminates unnecessary fragment calculations along the screen diagonal. This is especially beneficial for GPGPU passes and effects that use complex fragment shaders.

## Reaching for other effects

The library ships many more effects than the tasteful-pass set above — depth of field, vignette, outline (for selection/highlight), god rays, chromatic aberration, glitch, pixelation, shock wave, and more. Add them the same way: construct the effect and drop it into an `EffectPass`. Browse the package's exports for the current set and each effect's options rather than guessing names — but stay restrained: a game's finish is a few well-judged effects, not every one available.
