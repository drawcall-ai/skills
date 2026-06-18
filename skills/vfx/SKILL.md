---
name: vfx
description: "Add impact and feedback effects to a Three.js game with lightweight particle bursts — muzzle flashes, hit sparks, blood/dust, explosions, pickups — using pooled additive sprites or Points. Use when actions need visible punch (firing, impacts, deaths, explosions) or for ambient effects (smoke, embers, dust)."
---

# VFX & Particles

Impactful moments need a quick burst of particles or they feel flat: a muzzle flash on firing, sparks/dust where a shot lands, a puff on a footstep, a blood or chunk burst on a hit, a flash + smoke on an explosion, a sparkle on a pickup. A single static mesh standing in for a "flash" reads as cheap; a short particle burst reads as a real effect.

## The pattern: pooled, additive, short-lived

A particle effect is many tiny quads that spawn together, fly outward, and fade over a fraction of a second. Build the pool once and reuse it — never allocate per event (that stutters; see the `lights` skill on per-effect cost).

- **Pool**: pre-create a fixed pool of particles (a `Points` cloud, or a set of `Sprite`s). On an event, activate N of them at the hit point with random velocities; retire them as their lifetime runs out, and recycle.
- **Additive glow**: for fire, sparks, magic, and energy, use `blending: AdditiveBlending`, `depthWrite: false`, and a soft round texture so overlaps glow. (This is also how to fake a muzzle flash or explosion light without adding a real light.)
- **Lifetime**: each particle has a short life (~0.1–0.6s); over its life move it by its velocity (add gravity for debris/blood), shrink and/or fade its opacity to zero, then free it.

## Match the effect to the event
- **Muzzle flash**: one short additive sprite at the barrel for a few frames.
- **Impact**: a small spark/dust burst at the hit point, thrown out along the surface normal — sparks for metal, dust for stone/ground, blood for flesh.
- **Death / explosion**: a bigger burst — a bright flash, outward debris, then lingering smoke (dark, non-additive, rising and fading slowly).
- **Pickup / heal**: a gentle upward sparkle.

Keep particle counts modest and pools bounded so heavy action stays smooth.
