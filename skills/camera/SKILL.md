---
name: camera
description: "Cameras for Three.js games — viverse's ready-made character camera (third/first-person orbit, collision, zoom) and, when you need it, building cameras and effects (screen shake, FOV speed) from scratch as ECS systems. Use when implementing or tuning camera movement and behavior."
---

# Camera

## For a character: use viverse's `CharacterCameraBehavior`

For a player character (third- or first-person), prefer viverse's built-in camera behavior over hand-rolling one — it already does a correct orbit on **both** axes (pitch + yaw, clamped), camera collision against the world, and zoom. Hand-rolling is where the usual bugs come from: a camera locked to yaw so you can't aim up/down, or one that clips through walls.

```typescript
import { CharacterCameraBehavior, FirstPersonCharacterCameraBehavior } from '@pmndrs/viverse'

const cameraBehavior = new CharacterCameraBehavior() // third-person orbit + collision + zoom

// each frame, after moving the character:
cameraBehavior.update(camera, characterModel, delta, (ray, far) => world.raycast(ray, far)?.distance)
```

`update(camera, target, deltaTime, raycast?, options?)` is the whole API — there is no `setOptions`; tuning happens through the 5th `options` argument, passed the same shape every frame. It covers `rotation` (`minPitch`/`maxPitch`/`minYaw`/`maxYaw`/`speed`), `zoom` (`minDistance`/`maxDistance`/`speed`), `collision`, and `characterBaseOffset`. The instance also exposes `rotationPitch`, `rotationYaw`, and `zoomDistance` — set these to seed an initial facing or zoom before the first update.

`FirstPersonCharacterCameraBehavior` is **not a separate class** — it is a ready-made `options` object you pass as that 5th argument to switch the same behavior into a first-person rig:

```typescript
cameraBehavior.update(camera, characterModel, delta, raycast, FirstPersonCharacterCameraBehavior)
```

It composes with `BvhCharacterPhysics` (movement) and Acta (animation) — see the **acta** and **physics** skills. Movement and aiming derive from the camera's facing (`camera.getWorldDirection`), so they include pitch and strafe the correct way; the path of information is input → Acta → physics.

`characterBaseOffset` is **camera-relative**: its horizontal part is rotated by the camera yaw, so an over-the-shoulder offset like `[0.5, 1.5, 0]` stays over the shoulder *relative to the view* as you orbit, and a purely vertical offset (the default and first-person) is unaffected. You do not need the character to face the camera for the framing to be stable.

## Building a camera from scratch

If you need a fully custom rig, the patterns below build first/third-person cameras as minimal ECS systems — see the entity-component-system skill for the full pattern.

**Convention**: Positive pitch = look up, positive yaw = look left. Use `Euler(pitch, yaw, 0, 'YXZ')` order.

## First Person Camera

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

## Third Person Camera

Uses `Spherical` for orbit positioning — see the math skill.

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

## Rest Position

Smoothly interpolate to rest pose when idle. `pitch`/`yaw` are private state of the camera system above, so the rest-lerp belongs *inside* that system's `update` — a separate system can't reach in and mutate them:

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

### Screen Shake

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

### FOV Speed Effect

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
