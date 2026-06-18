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

Adding a static body

```ts
world.addBody(ground, false)
```

Adding a kinematic body

```ts
world.addBody(train, true)
```

## Character Controller

`BvhCharacterPhysics` is the character controller — it moves and collides the character body. It does **not** animate the character and is not a camera. For a full controllable humanoid, compose it with `CharacterCameraBehavior` (camera) and Acta for **all** animation and the motion it produces (see the **acta** skill). Do not use `SimpleCharacter` — it bundles its own animation that conflicts with Acta.

Creating a character controller

```ts
import { BvhCharacterPhysics, type BvhCharacterPhysicsOptions } from '@pmndrs/viverse'

const characterPhysics = new BvhCharacterPhysics(world)
```

Driving it

```ts
characterPhysics.inputVelocity.copy(velocity) // continuous (walking) — set each frame
characterPhysics.applyVelocity(jumpImpulse) // one-off impulse (e.g. jumping)
```

> For an Acta character the path of information is **input → Acta → physics**: you pass Acta a movement *intent* (a camera-relative `moveDirection`, length 0..1), Acta turns the active animation into a desired velocity and hands it to you in its `motion` callback, and you set `inputVelocity` from that velocity and step the controller there. **Do not set `inputVelocity` from raw input**, and do not move the character anywhere else. See the **acta** skill.

### Updating the controller

Call every frame after setting velocity:

```ts
characterPhysics.update(character, delta, {} satisfies BvhCharacterPhysicsOptions)
```

### Ground State

```ts
characterPhysics.isGrounded // true when character is on the ground
```

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
