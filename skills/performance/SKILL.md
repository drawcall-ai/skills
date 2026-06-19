---
name: performance
description: "Keep a Three.js game at a smooth framerate as it grows — instancing, level-of-detail, object pooling, culling, draw-call and allocation discipline, and profiling with vitexec. Use when a game stutters or drops frames, or proactively when a scene has many objects, enemies, particles, or lights."
---

# Performance

A scene that runs fine with a few objects stutters once it has crowds, particles, and a big map. The framerate is set by three budgets — **draw calls**, **GPU work**, and **per-frame CPU/allocations** — and the levers below each target one. Measure first, then fix the actual bottleneck.

## Measure first
Don't guess. Profile the running game with `vitexec --performance-trace` (and `--cpu-profile` for hot functions). Read the verdict from where the frame time goes: long scripting/JS time per frame and a busy main thread mean **CPU-bound** (apply "less per-frame CPU"); a cheap main thread but high GPU/render time, many draw calls, or large overdraw mean **GPU-bound** (apply "less GPU work" / "fewer draw calls"). Fix the budget the trace actually points to, not the one you assumed.

## Fewer draw calls
Each distinct mesh is roughly one draw call; thousands of them stall the CPU submitting work.
- **Instancing**: render many copies of the same geometry (trees, rocks, grass, bullets, identical enemies) as one `InstancedMesh`. Position each copy with `mesh.setMatrixAt(i, matrix)` and then set `mesh.instanceMatrix.needsUpdate = true` — omit that flag and instances never move.
- **Merge static geometry**: combine non-moving meshes that share a material into one buffer geometry. The tradeoff: a merged mesh is culled all-or-nothing, so don't merge geometry spread across a large area that benefits from per-object frustum culling.
- **Share materials/textures**: reuse material and texture instances; an atlas lets different props share one draw call.

## Less GPU work
- **Cull**: leave `frustumCulled = true` (the default) so off-screen objects are skipped; for huge worlds, also cull by distance.
- **LOD**: swap distant objects for cheaper versions (`THREE.LOD`), or hide small distant detail entirely.
- **Overdraw**: cap large transparent/additive particles and full-screen effects; bound shadow-map size and the number of shadow-casting lights.

## Less per-frame CPU
- **Pool, don't allocate**: reuse objects, and reuse scratch `Vector3`/`Quaternion`/`Matrix4` instances instead of `new`-ing them inside the update loop — per-frame allocation causes GC hitches.
- **Cap dynamic counts**: bound the number of live enemies, particles, and projectiles; recycle from a pool rather than creating/destroying.
- **Don't trigger recompiles**: changing the light count or a material's defines at runtime recompiles shaders (see the `lights` skill). Keep them fixed.
- **Spread work**: amortize expensive systems (pathfinding, AI re-planning) across frames instead of doing all of it every frame.
