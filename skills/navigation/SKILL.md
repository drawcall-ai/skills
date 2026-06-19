---
name: navigation
description: "Route AI/agent pathfinding to navcat — when to use a navmesh, how to generate one from Three.js geometry, query paths, and move agents (single agent or crowds). Use when adding pathfinding, enemy/NPC navigation, or patrol/spawn logic over Three.js geometry."
---

# Navigation with `navcat`

`navcat` builds a **navmesh** (the interconnected walkable polygons of your level) from raw geometry and answers pathfinding queries over it. Reach for it when something needs to *move intelligently through* the world — enemies routing around obstacles, NPCs patrolling, units ordered to a point, agents that must avoid walls and gaps. It is rendering-agnostic; `navcat/three` adapts it to Three.js.

> Do you even need a navmesh? For "walk straight at the target on open, flat ground," a navmesh is overkill — steer directly. A navmesh earns its place once agents must route *around* obstacles, across uneven or multi-level terrain, or as a coordinated crowd. If your case is simpler, implementing your own steering is the right call.

## Versions move — read the installed types

This skill routes you to the right capability and decision; it does **not** pin exact signatures, because navcat's API (export names, option fields, return shapes) shifts between versions. Before calling into it, read the installed package's exports/types (`navcat`, `navcat/blocks`, `navcat/three`) to confirm current names and fields. Treat the code below as shape, not contract.

## The pipeline at a glance

1. **Extract geometry** — turn your walkable Three.js meshes (floor, terrain, obstacles) into `positions`/`indices` with `getPositionsAndIndices(meshes)` from `navcat/three`.
2. **Generate the navmesh** — one call: `generateSoloNavMesh(input, options)` from `navcat/blocks` for a single area (the default), or `generateTiledNavMesh` for large worlds and partial rebuilds.
3. **Query** — paths, nearest walkable point, random points, line-of-sight, over the generated navmesh.
4. **Move agents** — follow the path yourself each frame, or hand many agents to the `crowd` block.

```ts
import { findPath, DEFAULT_QUERY_FILTER } from 'navcat'
import { generateSoloNavMesh } from 'navcat/blocks'
import { getPositionsAndIndices, createNavMeshHelper } from 'navcat/three'

const [positions, indices] = getPositionsAndIndices([floor, ...obstacles])
const { navMesh } = generateSoloNavMesh({ positions, indices }, options) // see options below

scene.add(createNavMeshHelper(navMesh).object) // debug: see the walkable surface

const result = findPath(navMesh, start, end, halfExtents, DEFAULT_QUERY_FILTER)
const waypoints = result.path.map((p) => p.position) // [x,y,z][]
```

`halfExtents` is the search box used to snap `start`/`end` onto the mesh; if a query fails, your points are likely off the navmesh — widen it or snap first with the nearest-poly query.

## Tuning generation

The generation options size the navmesh to your agent and trade detail against speed. You don't need to memorize the field list (read it from the installed `SoloNavMeshOptions`); you need the intuition for the few that matter:

- **Agent size** — walkable *radius* (clearance kept from walls), *height* (low ceilings excluded), *climb* (max step-up), and max walkable *slope angle*. Set these to your character.
- **Resolution** — cell size/height (voxel grid): smaller is finer but slower. A common start is cell size ≈ agent radius / 3.
- **Simplification** — region/edge/error limits control how blocky vs. smooth the polygons come out.

To customize an individual generation stage (tag areas, inject regions), navcat exposes the lower-level recast-style steps the one-call generators are built from — reach for those only when the generator can't express what you need.

## Querying the navmesh

All queries take the navmesh and a query filter (`DEFAULT_QUERY_FILTER` unless you mark area costs/flags). The capabilities to route to:

- **`findPath`** — full path between two points as waypoints. `findSmoothPath` for corner-free paths along the surface. (For cached/dynamic movement, the node-path + straight-path pair gives finer control.)
- **Nearest walkable point** — snap a world position onto the mesh; the basis for "is this reachable" and for fixing failed queries.
- **Random walkable point** (anywhere, or within a radius of a center) — spawns, patrol destinations, wander targets.
- **`raycast` along the surface** — line-of-sight between two points on the mesh. Mind the no-hit convention: a clear ray reports its hit parameter as the package's "no wall" sentinel (a max-value, not `1.0` or `0`) — confirm it in the installed type rather than assuming.
- **`moveAlongSurface`** — slide a position toward a target while staying on walkable area; a simple controller without full repathing.
- **Off-mesh connections** — explicit links across gaps the mesh can't (jumps, ladders, teleports).

## Following a path each frame

`findPath` gives waypoints; moving the agent is your loop's job. Walk toward the current waypoint, advance when you reach it, re-path when the destination changes or the agent drifts off:

```ts
let waypoints = result.path.map((p) => p.position)
let i = 0

function updateAgent(pos, speed, delta) {
  if (i >= waypoints.length) return // arrived
  const t = waypoints[i]
  const dx = t[0] - pos[0], dz = t[2] - pos[2]
  const dist = Math.hypot(dx, dz)
  if (dist < 0.2) { i++; return }
  pos[0] += (dx / dist) * speed * delta
  pos[2] += (dz / dist) * speed * delta
}
```

## Many agents → the `crowd` block

For groups (enemies swarming, units moving together), use the `crowd` API in `navcat/blocks` instead of hand-following paths — it does frame-distributed pathfinding, agent-to-agent and wall avoidance, and spacing for you. Keep a crowd from clumping into one overlapping blob:

- Give each agent a **radius** matching its body and let avoidance hold spacing. Do **not** hand-set every agent's velocity straight at the same point each frame — that overrides avoidance and stacks them.
- To swarm a target, give each agent a goal **offset on a ring** around it (spread by index/angle) so they surround it rather than fighting for its center.
- Tune avoidance strength and max acceleration so agents slide around each other instead of jittering or interpenetrating.

For advanced needs, copy the crowd block into your project and modify it.

## Limitations — know when to fill the gap yourself

- **The navmesh is static.** It reflects the geometry at generation time. When walkable geometry changes (a door opens, terrain deforms), you must regenerate — `generateSoloNavMesh` rebuilds the whole area; tiled navmeshes rebuild only affected tiles. For a few moving obstacles, your own local steering/avoidance on top is often cheaper than constant rebuilds.
- **Conventions:** navcat follows OpenGL conventions (right-handed, counter-clockwise winding). If your data differs, transform coordinates in and out. Imported external navmeshes must share/index vertices between adjacent polygons.
- **Keep collision and the navmesh aligned** to the *same* shaped terrain — not a flat floor under sculpted ground (see the `world` skill), or agents will path through visible hills.
- Navmeshes are plain JSON — serialize a generated one to skip regeneration at load.
