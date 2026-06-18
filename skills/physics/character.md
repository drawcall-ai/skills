# Animated character: physics + camera + Acta

A controllable humanoid is **three composable pieces**. Do **not** use `SimpleCharacter`: it bundles its own animation that fights Acta and hides the movement and camera you need to control.

- **Movement & collision** — `BvhCharacterPhysics` (this skill).
- **Camera** — `CharacterCameraBehavior` (see the `camera` skill): third-person orbit, pitch + yaw, collision, zoom.
- **All animation _and the motion it produces_** — Acta `CharacterBehaviorInterpreter` (see the `acta` skill).

The key idea: **Acta drives the physics, not the other way around.** You give Acta a movement _intent_ (which way the player wants to go, and how much, 0–1); the active animation decides the actual speed; Acta hands you that desired velocity through its `motion` callback, and you apply it to the physics controller _there_. You never compute the character's velocity from raw input yourself, and you never run the model's mixer.

## Setup

```typescript
import { BvhCharacterPhysics, CharacterCameraBehavior, getBone } from '@pmndrs/viverse'

const physics = new BvhCharacterPhysics(world)
const cameraBehavior = new CharacterCameraBehavior()

const interpreter = await CharacterBehaviorInterpreter.create(behavior, model, {
  // Acta's animation-derived velocity → physics. This is the ONLY place the character moves.
  motion: (desiredVelocity, delta) => {
    physics.inputVelocity.copy(desiredVelocity)
    physics.update(model.scene, delta, physicsOptions)
  },
  jump: (jumpVelocity = 8) => physics.applyVelocity(new Vector3(0, jumpVelocity, 0)),
  effects: { fire: () => shoot(), reloadCommit: () => commitReload(), footstep: () => playStep() },
})

getBone(model, 'rightHand')?.add(weapon) // held items follow the animated hand
```

## Per frame

```typescript
// 1) Movement INTENT, relative to the camera — a direction + amount, NOT a velocity.
//    Acta turns this into the real velocity (the animation's movement decides the speed).
const forward = camera.getWorldDirection(new Vector3()); forward.y = 0; forward.normalize()
const right = new Vector3().crossVectors(forward, camera.up).normalize() // press D → +right
const moveDirection = new Vector3()
if (input.forward) moveDirection.add(forward)
if (input.right) moveDirection.add(right) // if A/D feel swapped, flip this cross product's argument order
const moving = moveDirection.lengthSq() > 0

// 2) Drive Acta. It advances the animation, computes motion, and calls the `motion` callback
//    above (which steps physics). One-shot actions are requestAction, not raw input events.
interpreter.update(delta, {
  moveDirection: moving ? moveDirection.normalize() : null,
  moveAmount: moving ? 1 : 0,
  aimDirection, // the camera's full direction, so aim includes pitch
  facingDirection,
})
if (firedThisFrame) interpreter.requestAction('fire')
if (reloadStarted) interpreter.requestAction('reload')

// 3) Camera, with world collision so it never clips through geometry.
cameraBehavior.update(camera, model.scene, delta, (ray, far) => world.raycast(ray, far)?.distance)

// NEVER call model.mixer.update(delta). The model exposes a .mixer, but Acta advances it;
// calling it yourself double-advances the animation and corrupts both the pose and Acta's motion.
```

Aiming and shooting use the camera's full world direction (so the player can aim up and down); raycast from screen center and hit the collider the ray actually intersects — see the `acta` and `camera` skills.
