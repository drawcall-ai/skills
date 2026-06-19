---
name: physics
description: "Add BVH-based physics for static/kinematic geometry with @pmndrs/viverse — physics worlds, character controllers, ground detection, and sensor volumes. Use when a game needs collision, a character controller, or enter/exit trigger volumes."
---

# Physics

Physics using BVH (Bounding Volume Hierarchy) for static/kinematic geometry. Dynamic bodies cannot interact with each other yet.

## Physics World

Creating a physics world

```ts
import { BvhPhysicsWorld } from '@pmndrs/viverse'

const world = new BvhPhysicsWorld()
```

`addBody(object, kinematic)` — the second argument is whether the body is **kinematic** (script-moved, like a platform or train), not whether it is static. Pass `false` for static world geometry (ground, walls), `true` for things you move yourself.

```ts
world.addBody(ground, false) // static
world.addBody(train, true)   // kinematic (you move it each frame)
```

> Watch the inversion: `addBody`'s flag is `kinematic`, but `addSensor`'s second flag below is `isStatic` — the booleans mean opposite things.

## Character Controller

`BvhCharacterPhysics` is the character controller — it moves and collides the character body. It does **not** animate the character and is not a camera. For a full controllable humanoid, compose it with `CharacterCameraBehavior` (camera) and Acta for **all** animation and the motion it produces (see the **acta** skill). Do not use `SimpleCharacter` — it bundles its own animation that conflicts with Acta.

Creating a character controller

```ts
import { BvhCharacterPhysics, type BvhCharacterPhysicsOptions } from '@pmndrs/viverse'

const characterPhysics = new BvhCharacterPhysics(world)
```

The controller assumes the character object's **origin sits at its feet** (the bottom of the capsule). If your model's origin is at its center or head, the character floats or sinks — wrap it in a `Group` whose origin is at the feet. Tuning lives in the optional `BvhCharacterPhysicsOptions` (third arg to `update`): `capsuleRadius`, `capsuleHeight`, `gravity`, `maxGroundSlope`, `updatesPerSecond`, `linearDamping`.

Driving it

```ts
characterPhysics.inputVelocity.copy(velocity) // continuous (walking) — set each frame
characterPhysics.applyVelocity(jumpImpulse) // one-off impulse (e.g. jumping)
```

> For an Acta character the path of information is **input → Acta → physics**: you pass Acta a movement *intent* (a camera-relative `moveDirection`, length 0..1), Acta turns the active animation into a desired velocity and hands it to you in its `motion` callback, and you set `inputVelocity` from that velocity and step the controller there. **Do not set `inputVelocity` from raw input**, and do not move the character anywhere else. See the **acta** skill.

### Updating the controller

Call every frame after setting velocity:

```ts
characterPhysics.update(character, delta) // pass a BvhCharacterPhysicsOptions third arg to tune
```

### Ground State

```ts
characterPhysics.isGrounded // true when character is on the ground
```

### What the controller does not do — build these yourself

The controller gives you exactly two primitives — `inputVelocity` (continuous) and `applyVelocity` (impulse) — plus `isGrounded`. The rules a specific game layers on top are yours to write:

- **Multi-jump / double-jump, coyote-time, jump buffering:** there is no jump counter — gate the first `applyVelocity` on `isGrounded`, track your own air-jump count, and reset it when grounded.
- **Wall-jump / wall-slide:** `isGrounded` reports ground only, not walls. Detect a wall with a horizontal `world.raycast(ray, far)` from the capsule — the returned intersection gives the hit distance and surface normal — then `applyVelocity` away-from-wall + up.
- **Moving-platform ride-along:** standing on a kinematic platform does not carry the character. Add the platform's per-frame delta to the character yourself while it stands on it.

These are gameplay rules, not missing features — the controller stays deliberately minimal so each game tunes its own feel.

## Sensors

Sensors detect when the character enters or exits a volume.

Adding a sensor

```ts
world.addSensor(object, isStatic, (intersected) => {
  if (intersected) {
    // character entered the sensor
  } else {
    // character exited the sensor
  }
})
```

Removing a sensor

```ts
world.removeSensor(object)
```

If you prefer a single callback that provides the sensor object that the character entered, do the following

```ts
function onEnter(object: Object3D) {}

world.addSensor(obj1, isStatic, (intersected) => intersected && onEnter(obj1))
world.addSensor(obj2, isStatic, (intersected) => intersected && onEnter(obj2))
```
