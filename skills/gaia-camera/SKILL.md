---
name: gaia-camera
description: "Build first-person and third-person cameras plus effects (screen shake, FOV speed, rest smoothing) as ECS systems for Three.js games. Use when implementing or tuning camera movement and behavior."
---

# Camera

Inspiration for building camera movement and behavior. All examples use minimal ECS systems — see `/docs/entity-component-system.md` for the full pattern.

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

Uses `Spherical` for orbit positioning — see `/docs/math.md`.

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

Smoothly interpolate to rest pose when idle:

```typescript
export class CameraRestSystem extends createSystem({}) {
  private restPitch = 0
  private restYaw = 0

  update() {
    // TODO: check if player is idle
    cameraSystem.pitch = MathUtils.lerp(cameraSystem.pitch, this.restPitch, 0.05)
    cameraSystem.yaw = MathUtils.lerp(cameraSystem.yaw, this.restYaw, 0.05)
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
