# Animated character: physics + camera + Acta

A controllable humanoid is **three composable pieces**. Use them directly — do **not** use `SimpleCharacter`: it bundles its own animation system, which fights Acta-owned animation and hides the camera/movement you need to control.

- **Movement & collision** — `BvhCharacterPhysics` (this skill).
- **Camera** — `CharacterCameraBehavior` (see the `camera` skill): third-person orbit with pitch + yaw, camera collision, and zoom.
- **All animation** — Acta `CharacterBehaviorInterpreter` (see the `acta` skill): locomotion **and** actions (fire, reload, hit, death). Acta owns every bone — never run a mixer or pose bones yourself.

## Wiring

```typescript
import { BvhCharacterPhysics, CharacterCameraBehavior, getBone } from '@pmndrs/viverse'

const physics = new BvhCharacterPhysics(world)
const cameraBehavior = new CharacterCameraBehavior()
// animation: const interpreter = await CharacterBehaviorInterpreter.create(behavior, model, { ... })

// hold a weapon/tool in the hand so it follows the animation (getBone takes a VRM bone name)
getBone(characterModel, 'rightHand')?.add(weapon)
```

## Per frame

```typescript
// 1) Movement is relative to the camera — derive it from the camera's facing, not raw keys,
//    so "forward" follows the look and strafing isn't inverted.
const forward = camera.getWorldDirection(new Vector3()); forward.y = 0; forward.normalize()
const right = new Vector3().crossVectors(forward, camera.up).normalize() // press D → +right
const wish = new Vector3()
if (input.forward) wish.add(forward)
if (input.right) wish.add(right) // if A/D feel swapped, flip this cross product's argument order
physics.inputVelocity.copy(wish.normalize().multiplyScalar(speed))
if (input.jumpPressed && physics.isGrounded) physics.applyVelocity(new Vector3(0, jumpSpeed, 0))

// 2) Step physics (moves + collides the character). Pass the model's Object3D (model.scene).
physics.update(model.scene, delta, physicsOptions)

// 3) Orbit camera, with world collision so it never clips through geometry
cameraBehavior.update(camera, model.scene, delta, (ray, far) => world.raycast(ray, far)?.distance)

// 4) Animation — Acta is the ONLY animation driver. Feed movement state + action requests.
interpreter.update(delta, { moveX, moveZ, grounded: physics.isGrounded })
if (firedThisFrame) interpreter.requestAction('fire')
if (reloadStarted) interpreter.requestAction('reload')
// Do NOT call model.mixer.update(delta) — the model has a .mixer, but Acta advances it.
// Calling it yourself double-advances the animation and breaks it.
```

Aiming and shooting use the camera's **full** world direction (`camera.getWorldDirection`), so the player can aim up and down — not yaw alone. Raycast from screen center and hit the collider the ray actually intersects (`raycaster.intersectObjects`), rather than snapping to whichever enemy is nearest the aim.
