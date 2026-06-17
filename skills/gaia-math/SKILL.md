---
name: gaia-math
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
