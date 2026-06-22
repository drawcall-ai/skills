---
name: camera
description: "Cameras for Three.js games — viverse's ready-made character camera (third/first-person orbit, collision, zoom) and, when you need it, building cameras and effects (screen shake, FOV speed) from scratch as ECS systems. Use when implementing or tuning camera movement and behavior."
---

# Camera

A game camera follows a target with clamped pitch+yaw orbit, plus collision and zoom. There is one fork to make first: for a player character, use viverse's ready-made `CharacterCameraBehavior` out of the box; build a camera from scratch only when you need a fully custom rig. Hand-rolling a character camera tends to reproduce the same bugs — yaw-locked (can't aim up/down) or wall-clipping — which the built-in already solves.

Every custom rig shares one convention: `camera.rotation.set(pitch, yaw, 0, 'YXZ')`, where positive pitch looks up and positive yaw looks left. The `'YXZ'` Euler order is what makes pitch and yaw compose correctly, so it is stated once here and assumed throughout.

The sections below are: **Recommended: CharacterCameraBehavior** (the built-in for a character), **Building a camera from scratch** (first-person, third-person, and rest-position variants as ECS systems), and **Effects** (screen shake and FOV speed). Cross-references: `@pmndrs/viverse`, and the acta, physics, entity-component-system, and math skills.

## Recommended: CharacterCameraBehavior (for a character)

For a player character, prefer this over hand-rolling. `CharacterCameraBehavior` orbits both axes (pitch and yaw, each clamped), does camera collision against the world, and handles zoom.

```typescript
import { CharacterCameraBehavior, FirstPersonCharacterCameraBehavior } from '@pmndrs/viverse'

const cameraBehavior = new CharacterCameraBehavior() // third-person orbit + collision + zoom

// each frame, after moving the character:
cameraBehavior.update(camera, characterModel, delta, (ray, far) => world.raycast(ray, far)?.distance)
```

Call `update` each frame, after moving the character. The raycast callback `(ray, far) => world.raycast(ray, far)?.distance` is what the collision uses to keep the camera out of walls.

`update(camera, target, deltaTime, raycast?, options?)` is the whole API — there is no `setOptions` method. Tune behavior through the 5th `options` argument, passing the same shape every frame:

- `options.rotation`: `minPitch` / `maxPitch` / `minYaw` / `maxYaw` / `speed`
- `options.zoom`: `minDistance` / `maxDistance` / `speed`
- `options.collision`
- `options.characterBaseOffset`

The instance exposes `rotationPitch`, `rotationYaw`, and `zoomDistance`. Set these to seed the initial facing and zoom before the first `update`.

`FirstPersonCharacterCameraBehavior` is not a separate class — it is a ready-made options object. Pass it as the 5th argument to switch to first-person:

```typescript
cameraBehavior.update(camera, characterModel, delta, raycast, FirstPersonCharacterCameraBehavior)
```

This composes with `BvhCharacterPhysics` (movement) and Acta (animation) — see the acta and physics skills. Movement and aiming derive from the camera facing via `camera.getWorldDirection` (include pitch and strafe correctly). The information path is: input → Acta → physics.

`characterBaseOffset` is camera-relative: its horizontal part is rotated by the camera yaw. An over-the-shoulder offset like `[0.5, 1.5, 0]` therefore stays over the shoulder relative to the view as you orbit, while a purely vertical offset (the default, and the first-person case) is unaffected by yaw. The character need not face the camera for the framing to stay stable.

## Building a camera from scratch

For a fully custom rig, build first- and third-person cameras as minimal ECS systems — see the entity-component-system skill.

### First Person Camera

The first-person camera positions itself at the player's head and rotates by accumulated pitch and yaw.

```typescript
export class FirstPersonCameraSystem extends createSystem({}) {
  private pitch = 0
  private yaw = 0
  private headOffset = new Vector3(0, 1.7, 0)

  init() {
    RotatePitchAction.subscribe(
      (delta) => {
        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch + delta))
      },
      { signal },
    )
    RotateYawAction.subscribe(
      (delta) => {
        this.yaw += delta
      },
      { signal },
    )
  }

  update() {
    // TODO: retrieve player position
    camera.position.copy(playerPosition).add(this.headOffset)
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }
}
```

Pitch is clamped to `[-PI/2, PI/2]`; yaw is unclamped (`this.yaw += delta`). Subscriptions pass `{ signal }` for cleanup.

### Third Person Camera

The third-person camera orbits the player using a `Spherical` — see the math skill.

```typescript
export class ThirdPersonCameraSystem extends createSystem({}) {
  private pitch = 0.3
  private yaw = 0
  private radius = 5
  private headOffset = new Vector3(0, 1.7, 0)
  private spherical = new Spherical()

  init() {
    RotatePitchAction.subscribe(
      (delta) => {
        this.pitch = Math.max(0.1, Math.min(Math.PI / 2, this.pitch + delta))
      },
      { signal },
    )
    RotateYawAction.subscribe(
      (delta) => {
        this.yaw += delta
      },
      { signal },
    )
  }

  update() {
    // TODO: retrieve player position
    this.spherical.set(this.radius, this.pitch, this.yaw)
    camera.position.setFromSpherical(this.spherical).add(playerPosition).add(headOffset)
    camera.lookAt(target)
  }
}
```

Pitch is clamped to `[0.1, PI/2]` — note the lower bound differs from first-person's `-PI/2`, keeping the camera from orbiting below the ground. Yaw is unclamped, and subscriptions use the same `{ signal }` pattern.

### Rest Position

A camera can smoothly interpolate back to a rest pose when the player is idle. Because `pitch` and `yaw` are private state of the camera systems, the rest-lerp belongs inside the system that owns them — a separate system cannot reach in and mutate them.

```typescript
// add these fields to the FirstPerson/ThirdPerson camera system:
private restPitch = 0
private restYaw = 0

update() {
  // ... position the camera from this.pitch / this.yaw as above ...
  if (playerIsIdle) { // TODO: derive idle from input or velocity
    this.pitch = MathUtils.lerp(this.pitch, this.restPitch, 0.05)
    this.yaw = MathUtils.lerp(this.yaw, this.restYaw, 0.05)
  }
}
```

## Effects

Two effects layer on top of any camera: screen shake and FOV speed.

### Screen Shake

A burst of decaying random offset applied to the camera position.

```typescript
export class ScreenShakeSystem extends createSystem({}) {
  private intensity = 0
  private remaining = 0

  shake(intensity: number, duration: number) {
    this.intensity = intensity
    this.remaining = duration
  }

  update(delta: number) {
    if (this.remaining <= 0) return
    this.remaining -= delta * 1000
    const t = this.remaining / 1000
    camera.position.x += (Math.random() - 0.5) * this.intensity * t
    camera.position.y += (Math.random() - 0.5) * this.intensity * t
  }
}
```

`shake(intensity, duration)` starts a burst. Note the unit handling: `delta` arrives in seconds but `remaining` is tracked in milliseconds, so `update` subtracts `delta * 1000`. The factor `t = remaining / 1000` scales the offset on both x and y so the shake decays over its lifetime.

### FOV Speed Effect

Widen the field of view as the player moves faster to convey speed.

```typescript
export class FOVSpeedSystem extends createSystem({}) {
  private baseFOV = 75
  private maxFOV = 100
  private maxSpeed = 50

  update() {
    // TODO: compute/retrieve player speed
    camera.fov = MathUtils.lerp(this.baseFOV, this.maxFOV, Math.min(speed / this.maxSpeed, 1))
    camera.updateProjectionMatrix()
  }
}
```

Always call `camera.updateProjectionMatrix()` after changing `fov`, or the new value does not take effect.
