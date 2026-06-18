---
name: materials
description: "Give surfaces real materials and textures (PBR base-color/normal/roughness sets) in Three.js, with correct color space and tiling. Use when surfaces look flat, plastic, or gray, or when applying Market texture assets to terrain, walls, and props."
---

# Materials & Textures

A `MeshStandardMaterial` with only a `color` reads as flat, plastic, "untextured gray" — the fastest tell of an unfinished scene. A finished surface has texture maps. A surface left as a solid color is a fit-gap, not a material.

## Apply a texture set

Market `texture` assets ship a PBR set (base color + normal + roughness/metalness/ao). Load and assign the maps together:

```typescript
const loader = new TextureLoader()
const base = loader.load('/texture/grass/basecolor.jpg')
base.colorSpace = SRGBColorSpace                          // base color is sRGB
const normal = loader.load('/texture/grass/normal.jpg')  // every other map is linear (leave default)
const rough = loader.load('/texture/grass/roughness.jpg')

const material = new MeshStandardMaterial({ map: base, normalMap: normal, roughnessMap: rough })
```

## Color space — the #1 mistake
- **Base-color and emissive maps → `SRGBColorSpace`.** Forgetting this makes everything look washed-out and grayish.
- Normal / roughness / metalness / AO maps stay **linear** (the default — do not mark them sRGB).

## Tiling for large surfaces
Ground and walls must repeat the texture, not stretch one copy across the whole mesh:

```typescript
for (const t of [base, normal, rough]) {
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(surfaceMeters / tileMeters, surfaceMeters / tileMeters) // ~1 tile per few meters
}
```

Match each surface to a fitting texture — grass/ground for terrain, stone for cliffs, planks/metal for floors and walls. Pick textures from the asset survey; if none fits a surface, name the gap rather than shipping a flat color.
