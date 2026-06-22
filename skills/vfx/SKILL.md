---
name: vfx
description: "Add impact and feedback effects to a Three.js game with lightweight particle bursts — muzzle flashes, hit sparks, blood/dust, explosions, pickups — using pooled additive sprites or Points. Use when actions need visible punch (firing, impacts, deaths, explosions) or for ambient effects (smoke, embers, dust)."
---

# VFX & Particles

Impactful moments need a quick burst of particles or they feel flat: a muzzle flash on firing, sparks/dust where a shot lands, a puff on a footstep, a blood or chunk burst on a hit, a flash + smoke on an explosion, a sparkle on a pickup. A single static mesh standing in for a "flash" reads as cheap; a short particle burst reads as a real effect.

## First: pre-authored effect, or procedural burst?

For a rich, art-directed effect — a billowing explosion, a flame, a magic impact — prefer a **pre-rendered sprite-sheet (flipbook) over hand-built particles**: it looks far better than code-driven quads and costs almost nothing at runtime. Market ships `flipbook` assets for exactly this, and the **`flipbook` skill** (`@drawcall/flipbook`) plays them as billboards (the `Flipbook` class loads a KTX2 sheet and you call `.update(delta)` each frame). Route there when a fitting asset exists or the effect is essentially a looping/one-shot animated billboard.

Use the procedural pattern below when the effect must be **parametric or data-driven** — sparks thrown along a surface normal, debris with physics, a count/direction that varies per event, ambient scatter — where no single sprite sheet fits. The two compose: a flipbook explosion *plus* a procedural debris burst reads better than either alone.

## The pattern: pooled, additive, short-lived

A particle effect is many tiny quads that spawn together, fly outward, and fade over a fraction of a second. Build the pool once and reuse it — never allocate per event (that stutters; see the `lights` skill on per-effect cost).

- **Pool**: pre-create a fixed pool of particles (a `Points` cloud, or a set of `Sprite`s). On an event, activate N of them at the hit point with random velocities; retire them as their lifetime runs out, and recycle. `Points` is one draw call and the right default for bursts of identical billboards; reach for `Sprite`s only when a particle needs its own rotation or independent transform.
- **Additive glow**: for fire, sparks, magic, and energy, use `blending: AdditiveBlending`, `depthWrite: false`, and a soft round texture so overlaps glow. (This is also how to fake a muzzle flash or explosion light without adding a real light.)
- **Lifetime**: each particle has a short life (~0.1–0.6s); over its life move it by its velocity (add gravity for debris/blood), shrink and/or fade its opacity to zero, then free it.

The pool's whole point is **no per-event allocation**: allocate the geometry buffers once and only rewrite their contents each frame. A `Points`-based burst:

```typescript
const MAX = 200
const PARKED_Y = -1e4 // off-screen: unused and dead particles sit here so they never render
const positions = new Float32Array(MAX * 3)
for (let i = 0; i < MAX; i++) positions[i * 3 + 1] = PARKED_Y // park the whole pool until used — the buffer is zero-filled, so otherwise all MAX points render as a bright additive blob at the origin
const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

// soft round sprite, generated once — no asset needed
const c = document.createElement('canvas'); c.width = c.height = 64
const g = c.getContext('2d')!.createRadialGradient(32, 32, 0, 32, 32, 32)
g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)')
const ctx2d = c.getContext('2d')!; ctx2d.fillStyle = g; ctx2d.fillRect(0, 0, 64, 64)
const sprite = new THREE.CanvasTexture(c)

const material = new THREE.PointsMaterial({
  map: sprite, size: 0.3, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false,
})
const points = new THREE.Points(geometry, material)
points.frustumCulled = false // positions change every frame; the cached bounding sphere would cull the whole cloud wrongly

const vel = new Float32Array(MAX * 3)
const life = new Float32Array(MAX) // seconds remaining; 0 = free

function burst(at: THREE.Vector3, n: number) {
  let spawned = 0
  for (let i = 0; i < MAX && spawned < n; i++) {
    if (life[i] > 0) continue
    life[i] = 0.4
    positions.set([at.x, at.y, at.z], i * 3)
    vel.set([(Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4], i * 3)
    spawned++
  }
}

function update(delta: number) {
  for (let i = 0; i < MAX; i++) {
    if (life[i] <= 0) continue
    life[i] -= delta
    if (life[i] <= 0) { positions[i * 3 + 1] = PARKED_Y; continue } // died this frame — park it so it stops rendering
    vel[i * 3 + 1] -= 9.8 * delta // accumulate gravity into velocity so debris accelerates and arcs — folding it straight into position (`(vel - 9.8*delta)*delta`) is a constant, frame-rate-dependent nudge, not a fall
    positions[i * 3] += vel[i * 3] * delta
    positions[i * 3 + 1] += vel[i * 3 + 1] * delta
    positions[i * 3 + 2] += vel[i * 3 + 2] * delta
  }
  geometry.attributes.position.needsUpdate = true // the line agents forget — without it nothing moves
}
```

This minimal `Points` version **pops** each particle at end of life (parks it off-screen). Smooth per-particle fade or shrink isn't possible with a shared `PointsMaterial`; it needs a custom shader with a per-vertex alpha/size attribute, or `Sprite`s, which each carry their own `material.opacity` and `scale`.

## Match the effect to the event
- **Muzzle flash**: one short additive sprite at the barrel for a few frames.
- **Impact**: a small spark/dust burst at the hit point, thrown out along the surface normal — sparks for metal, dust for stone/ground, blood for flesh.
- **Death / explosion**: a bigger burst — a bright flash, outward debris, then lingering smoke (dark, non-additive, rising and fading slowly).
- **Pickup / heal**: a gentle upward sparkle.

Keep particle counts modest and pools bounded so heavy action stays smooth.
