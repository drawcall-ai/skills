---
name: math
description: "Use Three.js math classes (Vector3, Euler, Quaternion, Matrix4, Spherical) correctly instead of hand-rolled trigonometry, including when to pick Euler vs Quaternion. Use when doing rotations, orbit positioning, or any vector/angle math in a Three.js game."
---

# Math

Prefer Three.js math classes (`Vector3`, `Euler`, `Quaternion`, `Matrix4`) over custom implementations. They are well-tested, handle edge cases, and integrate seamlessly with Three.js objects.

## Spherical Coordinates and Trigonometry

For spherical coordinates or anything involving sin/cos, use `Euler`, `Vector3`, and `Quaternion` rather than manual trigonometry:

```typescript
// Instead of manual sin/cos for orbit position:
const spherical = new Spherical(radius, polarAngle, azimuthalAngle)
position.setFromSpherical(spherical)

// For direction from angles:
const euler = new Euler(pitch, yaw, 0, 'YXZ')
const direction = new Vector3(0, 0, -1).applyEuler(euler)
```

## Rotations

Rotations need to be carefully handled and their representation (Quaternion vs Euler) should be chosen based on the use case:

- **Euler with 'YXZ' order** — for orbital/FPS cameras where pitch and yaw are accumulated separately
- **Quaternion** — for general rotations, interpolation (slerp), and avoiding gimbal lock

When converting between representations, consider the Euler order. Staying in one representation reduces bugs. Three.js objects expose both `.rotation` (Euler) and `.quaternion` (Quaternion) — they stay synced automatically.

## Billboards (labels, health bars, icons that face the camera)

A quad that should always face the camera must be oriented in **world** space. If it is a child of a rotating object (an enemy, a turret), copying the camera's orientation into its **local** rotation is wrong — the parent's world rotation is still applied on top, so the billboard tilts and spins with the parent. This is the usual cause of a health bar that is rotated incorrectly. Two correct options:

```typescript
// A — orient in world space, compensating for the parent's world rotation:
mesh.quaternion.copy(camera.quaternion) // desired WORLD rotation
const parentWorld = mesh.parent.getWorldQuaternion(new Quaternion())
mesh.quaternion.premultiply(parentWorld.invert()) // local = parentWorld⁻¹ · desiredWorld

// B (simpler) — don't parent it to the moving object; keep it in world space:
scene.add(label)
label.position.copy(targetWorldPosition).add(offset)
label.quaternion.copy(camera.quaternion)
```

`THREE.Sprite` always faces the camera automatically and avoids this entirely — prefer it for simple health bars and icons.

## Measuring an object's size (`Box3`) — beware skinned/rigged meshes

`new Box3().setFromObject(object)` is correct for **static** meshes, but it gives a wrong, unstable answer for **skinned/rigged/animated** objects (characters). It unions every descendant — including the **skeleton bones** (which sit far outside the visible body) and any reference/clone sub-objects a character system keeps — and it expands to the mesh's **bind-pose** geometry, so the box also **changes every frame** as the animation poses the bones. The result is routinely 2–3× (or more) the visible body height.

This silently breaks anything sized from that number — the classic case is scaling one character to match another's measured height and getting a giant: the measured one was live/animating (inflated) while the other was measured fresh (clean). To get a character's real size:

- measure the **`SkinnedMesh`'s `geometry.boundingBox`** (the stable bind-pose mesh extent: `mesh.geometry.computeBoundingBox()`, then read `mesh.geometry.boundingBox`), or
- measure the **raw model once on load**, before it is rigged/animated/wrapped, or
- avoid measuring entirely and size against a **known constant** (a target character height you decide).

Don't `setFromObject` a live character every frame and trust the height.
