---
name: postprocessing
description: "Finish a 3D scene's look with the postprocessing library — a tasteful pass (ambient occlusion, subtle bloom, tone mapping, color grading) plus the correct WebGLRenderer attributes. Use to make a scene read as a polished game rather than a raw render, or for any screen-space image effect."
---

# Post Processing via `postprocessing`

A correct render of good geometry still looks unfinished — flat, raw — without a finishing pass. A light, tasteful pass is part of a polished game's look, not an optional extra. It has three parts: ambient occlusion to ground objects in contact shadow, a subtle bloom so emissive and bright things glow, and tone mapping plus a gentle color grade to set mood. Add it once the scene already reads correctly, and keep it restrained — heavy bloom or crushed grading looks worse than none.

Post processing introduces the concepts of passes and effects to extend the common rendering workflow with fullscreen image-manipulation tools. The sections below cover the tasteful pass itself, the HDR and color-space setup it depends on, the two failure modes that break it (dark halos around transparent VFX, and a single bad fragment smeared into a full-screen white flash), and how to reach for the library's other effects.

## The tasteful pass

The finish is a single restrained `EffectPass` over a correctly configured renderer and composer. Start with the renderer attributes, then wire the composer, then add a gentle grade if wanted.

The `WebGLRenderer` for a post processing workflow needs no on-screen depth or stencil buffer and benefits from preferring the discrete GPU. Antialiasing is left off here because it is handled inside the pipeline.

```js
import { WebGLRenderer } from 'three'

const renderer = new WebGLRenderer({
  powerPreference: 'high-performance',
  antialias: false,
  stencil: false,
  depth: false,
})
```

The `EffectComposer` manages and runs the passes. Use a `RenderPass` as the *first* pass to clear the buffers and render the scene for further processing. Fullscreen image effects are then rendered via an `EffectPass`. A single `EffectPass` merges any number of effects into one shader, so group the finishing effects into one pass rather than chaining a pass per effect.

Ambient occlusion needs scene normals: add a `NormalPass` and feed its `.texture` to `SSAOEffect`. Constructing `new SSAOEffect(camera)` alone, with no normal buffer, renders nothing — this is the usual AO mistake. Tone mapping goes LAST; effects in one `EffectPass` apply in array order, so it is the final argument.

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

For a gentle color grade, add a grading effect into the *same* `EffectPass`, *before* tone mapping: `BrightnessContrastEffect`, `HueSaturationEffect`, or `LUT3DEffect` for a film LUT. Keep grading restrained — a few points of contrast or saturation, not a heavy wash.

## HDR & color-space setup it needs

The tasteful pass assumes an HDR linear workflow: high-precision buffers, an sRGB output color space, and tone mapping done inside the pipeline rather than by the renderer.

New applications should follow a linear workflow for color management, and postprocessing supports this automatically. Set `WebGLRenderer.outputColorSpace` to `SRGBColorSpace` and postprocessing will follow suit.

By default postprocessing uses `UnsignedByteType` sRGB frame buffers to store intermediate results — a trade-off between hardware support, efficiency, and quality, since linear results normally require at least 12 bits per color channel to prevent degradation. With those low-precision sRGB buffers, colors clamp to `[0.0, 1.0]` and the information loss shifts to the darker spectrum, which leads to noticeable banding in dark scenes. Linear, high-precision `HalfFloatType` buffers don't have these issues and are the preferred option for HDR-like workflows on desktop devices.

Enable high-precision frame buffers when constructing the composer:

```ts
import { HalfFloatType } from 'three'

const composer = new EffectComposer(renderer, {
  frameBufferType: HalfFloatType,
})
```

Tone mapping is the process of converting HDR colors to LDR output colors. When using postprocessing, the renderer's `toneMapping` must be set to `NoToneMapping` (the default) *and* high-precision frame buffers must be enabled — otherwise colors map to `[0.0, 1.0]` at the very start of the pipeline, before tone mapping can do its work. To enable tone mapping, use a `ToneMappingEffect` at the end of the pipeline.

A note on the clear color: with the renderer alone, tone mapping is *not* applied to the clear color, because clearing doesn't involve shaders. Postprocessing applies to the full input image, so tone mapping is applied uniformly across it. Consequently, tone mapping a clear-color background differs with versus without postprocessing — and the postprocessing approach is the correct one.

## Failure modes

Two failures break the tasteful pass: SSAO carving dark halos around transparent VFX, and a single `NaN` or `Inf` fragment exploding into a full-screen white flash through bloom.

### SSAO and transparent objects (dark halos around VFX)

The `NormalPass` renders the whole scene into a normal buffer with an override material — transparent objects included. But transparent VFX — additive muzzle flashes, particles, tracers, beams, UI planes — render with `depthWrite: false`, so they never enter the depth buffer that SSAO samples. SSAO then finds a normal with no matching depth and carves an occlusion halo around each one: faint dark quads that track your particles, most visible when shooting.

This is a *different* bug from CSM rendering VFX as solid dark quads by splicing shadow code into their shaders — see the `lights` skill.

The fix is to keep transparent objects out of the `NormalPass` so its normals match the depth buffer. The reliable, general fix is to hide every transparent object just for that pass and restore it after — a pair of no-op passes bracketing the `NormalPass`. `TransparentToggle` extends `Pass` and sets `this.needsSwap = false`; its hide branch traverses the scene, pushing visible transparent objects into `hidden` and setting them invisible, and its restore branch makes them visible again and clears `hidden`.

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

### Shader NaN through bloom (full-screen white flash)

One fragment that writes `NaN` (or `Inf`) into the HDR buffer becomes a full-screen white flash once bloom runs. The mechanism: bloom's mipmap downsample averages that fragment into every coarser mip, so a single poisoned pixel spreads across the whole bloom texture and is then added over the entire frame.

The signature is distinctive: the flash **disappears without post processing** — with no bloom the bad value stays on its few source pixels and is usually invisible — it is a hard-edged, fully opaque white showing no background, and it appears only at certain camera angles or positions because the source is view-dependent.

The common source is a GLSL `pow()` whose base is mathematically non-negative but float-rounds just below zero. `pow(x, y)` for `x < 0` is undefined: it returns `NaN` on drivers that implement it as `exp(y * log(x))` and `0` on others — so the flash is **GPU/driver-dependent and may not reproduce on your machine**. A fresnel/rim term is the classic case: facing the surface head-on, `abs(dot(...))` of two normalized vectors rounds to `~1.0000001`, so the base goes negative.

```glsl
float fres = pow(1.0 - abs(dot(normalize(n), normalize(v))), 1.4);  // NaN risk: base can be < 0

float ndv  = clamp(abs(dot(normalize(n), normalize(v))), 0.0, 1.0); // clamp the base ≥ 0 first
float fres = pow(1.0 - ndv, 1.4);                                   // safe
```

Guard every `pow` base with `max(0.0, base)` (or clamp), and guard any `normalize()` whose input can be the zero vector. Non-NaN overflow smears identically: a value above `HalfFloat`'s max (~65504) becomes `Inf` in the composer's buffer and spreads the same way, so keep emissive/additive output bounded.

To find the source when it won't reproduce locally, render the scene to a `FloatType` render target and scan `readRenderTargetPixels` for `NaN`/`Inf`/huge values. To confirm a suspected material, write `NaN` into one of its color uniforms and verify the whole screen washes white.

## Reaching for other effects

The library ships many more effects than the tasteful-pass set, and they all attach the same way — but a game's finish is a few well-judged effects, not every one available.

The catalog includes depth of field, vignette, outline (for selection/highlight), god rays, chromatic aberration, glitch, pixelation, shock wave, and more. Add any of them the same way: construct the effect and drop it into an `EffectPass`. Browse the package's exports for the current set and each effect's options rather than guessing names.

Performance favors this approach. The `EffectPass` automatically organizes and merges any given combination of effects into one shader, minimizing render operations and making it possible to combine many effects without the performance penalties of traditional pass chaining; additionally, every effect can choose its own blend function. All fullscreen render operations also use a single triangle that fills the screen — compared to a quad, this harmonizes with modern GPU rasterization patterns and eliminates unnecessary fragment calculations along the screen diagonal, which is especially beneficial for GPGPU passes and effects with complex fragment shaders.
