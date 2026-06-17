---
name: gaia-map
description: "Create static 3D maps (terrain, rooms, villages, dungeons) with @drawcall/charta via the createMap/editMap natural-language tools, then load locations, placed objects, physics, and navigation from them. Use when building pre-authored environments."
---

# Map using `@drawcall/charta`

Charta is a language to build static 3D maps for three.js.

**Important**: Use the `createMap` and `editMap` tools with **natural language prompts**. Describe what you want in plain English with specific dimensions in meters.

Examples:

- `createMap`: "A 100x100m grassy field with a medieval castle (50m tall) in the center, surrounded by a water moat with a stone bridge on the south side. Include locations: spawn (near bridge), castle_entrance (at gate)"
- `editMap`: "Add a forest of pine trees along the northern edge, and a small village with 5 houses east of the castle"

**Important**: You cannot provide texture assets. The charta tool uses textures from its own library.

**Avoid hardcoding positions** — use named locations defined in the map.

## Quick Start

```typescript
import { Map } from './map.charta.ts'

const map = await Map.load()
scene.add(map)

// Locations are directly available as Vector3 properties
character.position.copy(map.spawn)
```

**Locations**: Named locations (e.g., `spawn`, `castle_entrance`) are available as `Vector3` properties on the map instance.

**Placed Objects**: Models placed with `place()` or `scatter()` are available as properties on the map instance. Single instances are `Object3D`, multiple instances use `InstancedMeshGroup`.

```typescript
// Access placed objects directly
map.treeInstance // Object3D (single instance)
map.rockIntances // InstancedMeshGroup (multiple instances)
```

**Physics & Navigation**: Use `map.tiles`, `map.walls`, `map.pillars` meshes directly. Access placed object meshes via their properties.

```typescript
// Physics: add as static bodies (BvhPhysicsWorld, see physics.md)
world.addBody(map.tiles, false)
world.addBody(map.walls, false)
world.addBody(map.pillars, false)
world.addBody(map.scatters, false)
world.addBody(map.treeInstance, false)
world.addBody(map.rockIntances, false)

// Navigation: generate navmesh (navcat, see navigation.md)
import { getPositionsAndIndices } from 'navcat/three'
const [positions, indices] = getPositionsAndIndices([
  map.tiles,
  map.walls,
  map.pillars,
  map.rockIntances,
  map.treeInstace,
])
```

## Map Properties

| Property      | Type                           | Description                                      |
| ------------- | ------------------------------ | ------------------------------------------------ |
| `tiles`       | `TilesMesh`                    | Ground and ceiling geometry (physics/navigation) |
| `walls`       | `WallMesh`                     | Wall geometry with cutouts                       |
| `pillars`     | `PillarMesh`                   | Corner pillar instances                          |
| `grass`       | `GrassMesh`                    | Procedural grass blades                          |
| `water`       | `WaterMesh`                    | Animated water surfaces                          |
| `scatters`    | `PlaceGroup`                   | Scatter model instances                          |
| `interpreter` | `Interpreter`                  | Grid data, assets, and coordinate queries        |
| `<location>`  | `Vector3`                      | Named locations (e.g., `spawn`, `entrance`)      |
| `<object>`    | `Object3D\|InstancedMeshGroup` | Models instances                                 |

## Placing Objects on the Terrain

Use `map.getHeightAt(x, z)` to query terrain height at any world position:

```typescript
// Place an object at correct terrain height
const x = 10,
  z = 15
const y = map.getHeightAt(x, z)
if (y != null) {
  model.position.set(x, y, z)
}
```

By default, `getHeightAt` returns the maximum of terrain and water height. To get terrain height only (ignoring water), pass `{ includeWater: false }`:

```typescript
// Get terrain height, ignoring water surfaces
const terrainY = map.getHeightAt(x, z, { includeWater: false })
```

---

# Charta Syntax Reference

The generated `.charta.ts` files use a grid-based DSL. You don't write this directly — use `createMap`/`editMap` with natural language. This reference helps you understand the generated code.

**Structure**: Line 1 is config (cellSize, assets). Lines 2+ define grid cells separated by `|`, from north→south, west→east. Maps are centered at origin.

**Key functions**: `ground(texture, y)`, `water(y)`, `wall(dir, texture)`, `door()`, `window()`, `place(model)`, `scatter(model, density)`, `grass()`, `location(name)`
