---
name: world
description: "Make a 3D game world feel large and real — world scale, draw distance, fog and horizon, level-of-detail, and consistent prop/character scale. Use when a map feels small, empty, or ends abruptly, or when building open or outdoor scenes."
---

# World Scale & Distance

A world feels small for three fixable reasons: it is physically small, it ends at a visible edge, or there is nothing in the distance. A "big map" means hundreds of meters with something on every horizon — not a 150m patch with empty space past it.

## Size to the experience
Pick the world size from how the player moves. A third-person shooter map you sprint across for a minute is roughly 300–1000m wide, not ~150m. Place points of interest far enough apart that traveling between them takes real seconds.

## Shape the ground
Outdoor ground is almost never flat — a flat plane is the clearest "unfinished prototype" tell after untextured gray. Give the terrain real shape: displace a subdivided plane's vertices with layered noise (a few octaves of value/simplex noise) for hills, slopes, and valleys, or drive it from a heightmap. Carve in readable landmarks — a ridge, a basin, some high ground — so the space has tactical variety, then call `geometry.computeVertexNormals()` so lighting follows the shape. Keep collision and the navmesh aligned to the *shaped* terrain, not a separate flat floor underneath.

The terrain is a surface like any other — it needs a real material, not a solid color (see the `materials` skill). Apply a tiled ground texture, and for a large map blend it by slope and height (grass on flat ground, rock/cliff on steep slopes, sand at the shoreline) so the whole map doesn't read as one flat green sheet.

## Give the world distance
The eye reads scale from depth cues — provide all three so the world has a horizon instead of an edge:
- **Horizon:** a skybox / environment background or a distant terrain silhouette, so the ground never ends at a hard line.
- **Fog:** `scene.fog = new Fog(skyColor, near, far)`, tuned so far geometry fades into the sky. This adds depth *and* hides the draw-distance edge. Match the fog color to the sky color.
- **Distant detail:** large background landforms, ridgelines, or structures the player can see but may never reach.

Set the camera `far` plane past the fog's far distance so nothing pops in, and keep `near` reasonable (e.g. 0.1) for depth precision.

## Fill it without tanking the framerate
Density is what makes a world believable; an empty ground between a handful of props reads as a prototype. Scatter dense detail — grass tufts, rocks, bushes, debris — across the terrain, and cluster props into *places* (an outpost, a copse of trees) rather than dotting them evenly. Naive copies kill the framerate, so use `InstancedMesh` for the repeated detail and skip or simplify (LOD) distant instances.

## Keep scale consistent
Author everything in meters against the character's height (~1.8m). A tree the size of the player, or a crate the size of a house, breaks the sense of place faster than anything else.

## Finish the image
A raw render of correct geometry still looks flat. A light postprocessing pass — subtle bloom, ambient occlusion to ground objects, and gentle color grading (see the `postprocessing` skill) — is often what separates "a polished game" from "a tech demo". Add it once the scene reads correctly, not before.
