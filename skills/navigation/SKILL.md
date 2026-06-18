---
name: navigation
description: "Generate navigation meshes and find paths for AI agents with navcat and navcat/three, including all generation parameters and the recast-style pipeline. Use when adding pathfinding or AI navigation over Three.js geometry."
---

# Navgiation with `navcat`

What is a navigation mesh? A navigation mesh (or navmesh) is a simplified representation of a 3D environment used for pathfinding and AI navigation. It consists of interconnected polygons that define walkable areas. These polygons are connected by edges and off-mesh connections, allowing agents to move from one polygon to another.

## Quick Start with Three.js

The `navcat/three` entrypoint provides utilities to integrate navcat with Three.js. Here's a complete example of generating a navmesh from Three.js geometry and visualizing paths:

```ts
import { DEFAULT_QUERY_FILTER, findPath, type Vec3 } from 'navcat'
import { generateSoloNavMesh, type SoloNavMeshInput, type SoloNavMeshOptions } from 'navcat/blocks'
import { createNavMeshHelper, createSearchNodesHelper, getPositionsAndIndices } from 'navcat/three'
import { BoxGeometry, Mesh, MeshStandardMaterial, PlaneGeometry, Scene, SphereGeometry } from 'three'

// create a simple threejs scene
const floor = new Mesh(new PlaneGeometry(10, 10), new MeshStandardMaterial({ color: 0x808080 }))
floor.rotation.x = -Math.PI / 2

const box = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x8080ff }))
box.position.set(0, 0.5, 0)

const scene = new Scene()
scene.add(floor)
scene.add(box)

// extract geometry for navmesh generation
const [positions, indices] = getPositionsAndIndices([floor, box])

const input: SoloNavMeshInput = {
  positions,
  indices,
}

// generation options for a human-sized agent
const cellSize = 0.15
const cellHeight = 0.15

const walkableRadiusWorld = 0.1
const walkableRadiusVoxels = Math.ceil(walkableRadiusWorld / cellSize)
const walkableClimbWorld = 0.5
const walkableClimbVoxels = Math.ceil(walkableClimbWorld / cellHeight)
const walkableHeightWorld = 0.25
const walkableHeightVoxels = Math.ceil(walkableHeightWorld / cellHeight)
const walkableSlopeAngleDegrees = 45

const borderSize = 0
const minRegionArea = 8
const mergeRegionArea = 20

const maxSimplificationError = 1.3
const maxEdgeLength = 12
const maxVerticesPerPoly = 5

const detailSampleDistanceVoxels = 6
const detailSampleDistance = detailSampleDistanceVoxels < 0.9 ? 0 : cellSize * detailSampleDistanceVoxels
const detailSampleMaxErrorVoxels = 1
const detailSampleMaxError = cellHeight * detailSampleMaxErrorVoxels

const options: SoloNavMeshOptions = {
  cellSize,
  cellHeight,
  walkableRadiusWorld,
  walkableRadiusVoxels,
  walkableClimbWorld,
  walkableClimbVoxels,
  walkableHeightWorld,
  walkableHeightVoxels,
  walkableSlopeAngleDegrees,
  borderSize,
  minRegionArea,
  mergeRegionArea,
  maxSimplificationError,
  maxEdgeLength,
  maxVerticesPerPoly,
  detailSampleDistance,
  detailSampleMaxError,
}

// generate the navmesh
const result = generateSoloNavMesh(input, options)

const navMesh = result.navMesh
const intermediates = result.intermediates // for debugging

// visualize the navmesh in threejs
const navMeshHelper = createNavMeshHelper(navMesh)
scene.add(navMeshHelper.object)

// find a path
const start: Vec3 = [-4, 0, -4]
const end: Vec3 = [4, 0, 4]
const halfExtents: Vec3 = [0.5, 0.5, 0.5]

const path = findPath(navMesh, start, end, halfExtents, DEFAULT_QUERY_FILTER)

console.log(
  'path:',
  path.path.map((p) => p.position),
)

// visualise the path points
for (const point of path.path) {
  const sphere = new Mesh(new SphereGeometry(0.1), new MeshStandardMaterial({ color: 0xff0000 }))
  sphere.position.set(point.position[0], point.position[1], point.position[2])
  scene.add(sphere)
}

// visualise the A* search nodes
if (path.nodePath) {
  const searchNodesHelper = createSearchNodesHelper(path.nodePath.nodes)
  scene.add(searchNodesHelper.object)
}
```

## Generation Parameters

| Parameter                   | Description                                                                                                       | Range / Heuristic for 1 = 1m humanoid agents |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `cellSize`                  | Horizontal voxel size (XZ). Smaller = finer detail, slower generation.                                            | ≈ `walkableRadiusWorld / 3`                  |
| `cellHeight`                | Vertical voxel size (Y). Controls height resolution.                                                              | ≈ `walkableClimbWorld / 2`                   |
| `walkableRadiusWorld`       | Agent radius (half-width). Determines clearance around walls.                                                     | 0.2–0.5 m                                    |
| `walkableHeightWorld`       | Agent height. Areas with ceilings lower than this are excluded.                                                   | 1.6–2.0 m                                    |
| `walkableSlopeAngleDegrees` | Max slope angle the agent can walk. This filters out input triangles at the very beginning of navmesh generation. | 35–50°                                       |
| `walkableClimbWorld`        | Max step height. Allows stepping up/down small edges.                                                             | 0.3–0.5 m                                    |
| `minRegionArea`             | Smallest isolated region kept.                                                                                    | 4–16 voxels                                  |
| `mergeRegionArea`           | Regions smaller than this merge into neighbors.                                                                   | 8–32 voxels                                  |
| `maxSimplificationError`    | Edge simplification tolerance (higher = simpler mesh).                                                            | 1–2                                          |
| `maxEdgeLength`             | Max polygon edge length before splitting.                                                                         | 8–24                                         |
| `maxVerticesPerPoly`        | Max vertices per polygon.                                                                                         | 3–6                                          |
| `detailSampleDistance`      | Distance between height samples (affects vertical detail).                                                        | `cellSize * 4–8`, e.g. `0.9`                 |
| `detailSampleMaxError`      | Allowed height deviation when simplifying detail mesh.                                                            | `cellHeight * 1–2`, e.g. `0.25`              |

## Navigation Mesh Generation: Deep Dive

The core of navmesh generation is based on the [recastnavigation library](https://github.com/recastnavigation/recastnavigation)'s voxelization approach:

1. Input triangles are rasterized into voxels / heightfield
2. Voxels where agents can't move are filtered out
3. Walkable areas are divided into polygonal regions
4. Navigation mesh polygons are created by triangulating the regions

### Single-Tile vs Tiled Navigation Meshes

Most projects should start with a **single-tile navmesh** - it's simpler and covers the majority of use cases.

Consider **tiled navmeshes** when you need:

- Dynamic updates (rebuild only affected tiles when geometry changes)
- Memory management (stream tiles in/out based on player location)
- Parallel generation (generate tiles independently)
- Large worlds (tiled navmesh generation can give better results over large areas)

### Step-by-Step Generation Process

#### 1. Mark walkable triangles

Filter input triangles by slope angle. Triangles that are walkable are marked with the `WALKABLE_AREA` area type.

```ts
import * as Nav from 'navcat'

const positions: number[] = [
  /* flat array of vertex positions */
]
const indices: number[] = [
  /* flat array of triangle vertex indices */
]

const ctx = Nav.BuildContext.create()

const walkableSlopeAngleDegrees = 45
const triAreaIds = new Uint8Array(indices.length / 3).fill(0)

Nav.markWalkableTriangles(positions, indices, triAreaIds, walkableSlopeAngleDegrees)
```

#### 2. Rasterize into heightfield and filter

The walkable triangles are voxelized into a heightfield, then filtered to remove spans where agents cannot stand.

```ts
const cellSize = 0.2
const cellHeight = 0.2

const walkableClimbWorld = 0.5
const walkableClimbVoxels = Math.ceil(walkableClimbWorld / cellHeight)

const walkableHeightWorld = 1.0
const walkableHeightVoxels = Math.ceil(walkableHeightWorld / cellHeight)

// calculate bounds and grid size
const bounds: Nav.Box3 = [
  [0, 0, 0],
  [0, 0, 0],
]
Nav.calculateMeshBounds(bounds, positions, indices)

const [heightfieldWidth, heightfieldHeight] = Nav.calculateGridSize([0, 0], bounds, cellSize)

// create and populate the heightfield
const heightfield = Nav.createHeightfield(heightfieldWidth, heightfieldHeight, bounds, cellSize, cellHeight)

Nav.rasterizeTriangles(ctx, heightfield, positions, indices, triAreaIds, walkableClimbVoxels)

// filter walkable surfaces
Nav.filterLowHangingWalkableObstacles(heightfield, walkableClimbVoxels)
Nav.filterLedgeSpans(heightfield, walkableHeightVoxels, walkableClimbVoxels)
Nav.filterWalkableLowHeightSpans(heightfield, walkableHeightVoxels)
```

#### 3. Build compact heightfield and erode by agent radius

The heightfield is compacted to represent only walkable surfaces, then eroded by the agent radius.

```ts
const compactHeightfield = Nav.buildCompactHeightfield(ctx, walkableHeightVoxels, walkableClimbVoxels, heightfield)

const walkableRadiusWorld = 0.6
const walkableRadiusVoxels = Math.ceil(walkableRadiusWorld / cellSize)

Nav.erodeWalkableArea(walkableRadiusVoxels, compactHeightfield)
```

#### 4. Build regions

The compact heightfield is analyzed to identify distinct walkable regions.

```ts
Nav.buildDistanceField(compactHeightfield)

const borderSize = 0
const minRegionArea = 8
const mergeRegionArea = 20

Nav.buildRegions(ctx, compactHeightfield, borderSize, minRegionArea, mergeRegionArea)
```

#### 5. Build contours

Contours are generated around region edges and simplified.

```ts
const maxSimplificationError = 1.3
const maxEdgeLength = 6.0

const contourSet = Nav.buildContours(
  ctx,
  compactHeightfield,
  maxSimplificationError,
  maxEdgeLength,
  Nav.ContourBuildFlags.CONTOUR_TESS_WALL_EDGES,
)
```

#### 6. Build polygon mesh and detail mesh

From contours, create the polygon mesh and a detail mesh for accurate height data.

```ts
const maxVerticesPerPoly = 5
const polyMesh = Nav.buildPolyMesh(ctx, contourSet, maxVerticesPerPoly)

// set up area and flags
for (let polyIndex = 0; polyIndex < polyMesh.nPolys; polyIndex++) {
  if (polyMesh.areas[polyIndex] === Nav.WALKABLE_AREA) {
    polyMesh.areas[polyIndex] = 0
  }
  if (polyMesh.areas[polyIndex] === 0) {
    polyMesh.flags[polyIndex] = 1
  }
}

const sampleDist = 1.0
const sampleMaxError = 1.0
const polyMeshDetail = Nav.buildPolyMeshDetail(ctx, polyMesh, compactHeightfield, sampleDist, sampleMaxError)
```

#### 7. Convert to runtime format

Post-process the poly mesh for runtime use.

```ts
const tilePolys = Nav.polyMeshToTilePolys(polyMesh)
const tileDetailMesh = Nav.polyMeshDetailToTileDetailMesh(tilePolys.polys, polyMeshDetail)
```

#### 8. Assemble the navigation mesh

Combine everything into the final navigation mesh.

```ts
const navMesh = Nav.createNavMesh()

navMesh.tileWidth = polyMesh.bounds[1][0] - polyMesh.bounds[0][0]
navMesh.tileHeight = polyMesh.bounds[1][2] - polyMesh.bounds[0][2]
navMesh.origin[0] = polyMesh.bounds[0][0]
navMesh.origin[1] = polyMesh.bounds[0][1]
navMesh.origin[2] = polyMesh.bounds[0][2]

const tileParams: Nav.NavMeshTileParams = {
  bounds: polyMesh.bounds,
  vertices: tilePolys.vertices,
  polys: tilePolys.polys,
  detailMeshes: tileDetailMesh.detailMeshes,
  detailVertices: tileDetailMesh.detailVertices,
  detailTriangles: tileDetailMesh.detailTriangles,
  tileX: 0,
  tileY: 0,
  tileLayer: 0,
  cellSize,
  cellHeight,
  walkableHeight: walkableHeightWorld,
  walkableRadius: walkableRadiusWorld,
  walkableClimb: walkableClimbWorld,
}

const tile = Nav.buildTile(tileParams)
Nav.addTile(navMesh, tile)
```

## Navigation Mesh Querying

### `findPath`

The simplest way to find a complete path between two points:

```ts
const start: Nav.Vec3 = [1, 0, 1]
const end: Nav.Vec3 = [8, 0, 8]
const halfExtents: Nav.Vec3 = [0.5, 0.5, 0.5]

const findPathResult = Nav.findPath(navMesh, start, end, halfExtents, Nav.DEFAULT_QUERY_FILTER)

if (findPathResult.success) {
  const points = findPathResult.path.map((p) => p.position)
  console.log('path points:', points)
}
```

### `findSmoothPath`

For smooth paths that follow the navmesh surface without sharp corners:

```ts
const smoothPath = Nav.findSmoothPath(
  navMesh,
  start,
  end,
  halfExtents,
  Nav.DEFAULT_QUERY_FILTER,
  stepSize,
  slop,
  maxPoints,
)
```

### `findNodePath` and `findStraightPath`

For more control, find a node path first then calculate waypoints. Useful when caching paths for dynamic agent movement.

```ts
const startNode = Nav.findNearestPoly(
  Nav.createFindNearestPolyResult(),
  navMesh,
  start,
  halfExtents,
  Nav.DEFAULT_QUERY_FILTER,
)
const endNode = Nav.findNearestPoly(
  Nav.createFindNearestPolyResult(),
  navMesh,
  end,
  halfExtents,
  Nav.DEFAULT_QUERY_FILTER,
)

if (startNode.success && endNode.success) {
  const nodePath = Nav.findNodePath(
    navMesh,
    startNode.nodeRef,
    endNode.nodeRef,
    startNode.position,
    endNode.position,
    Nav.DEFAULT_QUERY_FILTER,
  )

  const straightPath = Nav.findStraightPath(navMesh, start, end, nodePath.path)
  console.log(straightPath.path)
}
```

### `moveAlongSurface`

Move along the navmesh surface, constrained to walkable areas. Perfect for simple character controllers:

```ts
const startNode = Nav.findNearestPoly(
  Nav.createFindNearestPolyResult(),
  navMesh,
  start,
  halfExtents,
  Nav.DEFAULT_QUERY_FILTER,
)

const moveResult = Nav.moveAlongSurface(navMesh, startNode.nodeRef, start, end, Nav.DEFAULT_QUERY_FILTER)

console.log(moveResult.position) // resulting position after the move
```

### `raycast`

Cast a ray along the navmesh surface for line-of-sight checks:

```ts
const startNode = Nav.findNearestPoly(
  Nav.createFindNearestPolyResult(),
  navMesh,
  start,
  halfExtents,
  Nav.DEFAULT_QUERY_FILTER,
)

const raycastResult = Nav.raycast(navMesh, startNode.nodeRef, start, end, Nav.DEFAULT_QUERY_FILTER)

console.log(raycastResult.t) // 1.0 if no obstruction, otherwise distance to hit
console.log(raycastResult.hitNormal) // normal of hit surface
```

### `findNearestPoly`

Snap world positions onto the navmesh:

```ts
const position: Nav.Vec3 = [1, 0, 1]
const halfExtents: Nav.Vec3 = [0.5, 0.5, 0.5]

const result = Nav.createFindNearestPolyResult()
Nav.findNearestPoly(result, navMesh, position, halfExtents, Nav.DEFAULT_QUERY_FILTER)

console.log(result.success)
console.log(result.position) // nearest point on navmesh
console.log(result.nodeRef) // polygon reference
```

### `findRandomPoint` and `findRandomPointAroundCircle`

Find random walkable positions for spawning, patrol destinations, etc:

```ts
// random point anywhere on navmesh
const randomPoint = Nav.findRandomPoint(navMesh, Nav.DEFAULT_QUERY_FILTER, Math.random)
console.log(randomPoint.position)

// random point within radius of a center
const center: Nav.Vec3 = [5, 0, 5]
const radius = 3.0
const centerNode = Nav.findNearestPoly(
  Nav.createFindNearestPolyResult(),
  navMesh,
  center,
  halfExtents,
  Nav.DEFAULT_QUERY_FILTER,
)

if (centerNode.success) {
  const randomNearby = Nav.findRandomPointAroundCircle(
    navMesh,
    centerNode.nodeRef,
    center,
    radius,
    Nav.DEFAULT_QUERY_FILTER,
    Math.random,
  )
  console.log(randomNearby.position)
}
```

## Off-Mesh Connections

Off-mesh connections enable navigation between non-adjacent areas (jumping gaps, climbing ladders, teleporting):

```ts
const jumpConnection: Nav.OffMeshConnectionParams = {
  start: [0, 0, 0],
  end: [1, 0, 1],
  radius: 0.5,
  direction: Nav.OffMeshConnectionDirection.BIDIRECTIONAL,
  flags: 1,
  area: 0,
}

const connectionId = Nav.addOffMeshConnection(navMesh, jumpConnection)

// check if connected
console.log(Nav.isOffMeshConnectionConnected(navMesh, connectionId))

// remove when no longer needed
Nav.removeOffMeshConnection(navMesh, connectionId)
```

## Crowd Simulation

The `crowd` API in `navcat/blocks` provides high-level agent simulation:

- Agent management: add/remove agents, set targets
- Frame-distributed pathfinding for performance
- Agent-to-agent and wall avoidance
- Off-mesh connection support with animation hooks

For simple use cases, use it directly. For advanced use cases, copy it into your project and modify as needed.

### Keep a crowd from clumping

When many agents chase one target (enemies swarming the player, units ordered to a point), they pile into a single overlapping blob unless you let the crowd hold them apart:

- Give each agent a **radius** matching its body and let the crowd's agent-to-agent avoidance maintain spacing. Do **not** hand-set every agent's velocity straight at the same point each frame — that overrides avoidance and stacks them on top of each other.
- For a natural look, make a group **surround** the target instead of converging on its exact center: give each agent a goal offset on a ring around the target (spread by index/angle), so they encircle it rather than fighting for one spot.
- Tune avoidance strength and max acceleration so agents slide around each other smoothly rather than jittering or interpenetrating.

## Debug Visualization with Three.js

The `navcat/three` entrypoint provides helpers for visualizing navmesh data:

```ts
import { createNavMeshHelper, createSearchNodesHelper, getPositionsAndIndices } from 'navcat/three'

// visualize the navmesh
const navMeshHelper = createNavMeshHelper(navMesh)
scene.add(navMeshHelper.object)

// visualize A* search nodes after pathfinding
if (path.nodePath) {
  const searchNodesHelper = createSearchNodesHelper(path.nodePath.nodes)
  scene.add(searchNodesHelper.object)
}
```

For other libraries, use the graphics-agnostic debug drawing functions and implement your own visualization.

## Saving and Loading

Navigation meshes are JSON-serializable:

```ts
// save
const navMeshJson = JSON.stringify(navMesh)

// load
const loadedNavMesh = JSON.parse(navMeshJsonString)
```

## Integration Notes

navcat is agnostic of rendering or game engine library. It adheres to OpenGL conventions:

- Right-handed coordinate system
- Counter-clockwise winding order for indices

If your environment uses a different coordinate system, transform coordinates going into and out of navcat.

Navmesh poly vertices must be indexed / must share vertices between adjacent polygons when importing external navmeshes.
