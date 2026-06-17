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

Creating a character controller

```ts
import { BvhCharacterPhysics, type BvhCharacterPhysicsOptions } from '@pmndrs/viverse'

const characterPhysics = new BvhCharacterPhysics(world)
```

Applying velocity

```ts
characterPhysics.applyVelocity(vec3) // once (e.g. jumping)
characterPhysics.inputVelocity.set(0, 0, 0) // continuous (e.g. walking)
```

> For animated humanoid characters, do NOT set `inputVelocity` directly!
> Use the `applyMove` callback pattern instead — see [character.md](./character.md).
> Direct velocity setting causes characters to slide during idle/attack animations.

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
