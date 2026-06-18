# Animated character: physics + camera + Acta

A controllable humanoid composes three pieces — do **not** use `SimpleCharacter` (its bundled animation fights Acta and hides the movement/camera you need to control):

- **Movement & collision** — `BvhCharacterPhysics` (this skill)
- **Camera** — `CharacterCameraBehavior` (the `camera` skill): third-person orbit, pitch + yaw, collision, zoom
- **All animation _and the motion it produces_** — Acta (the `acta` skill)

Information flows one way: **input → Acta → physics → camera**. You give Acta a movement _intent_; Acta picks the animation, derives the desired velocity from it, and hands it back through its motion hook, where you drive the physics controller. You never compute the character's velocity from raw input, and you never move the character root anywhere else.

## Per frame

```typescript
// 1) Movement INTENT, relative to the camera — a direction whose length (0..1) is the amount,
//    NOT a velocity. Acta turns it into the real velocity (the animation decides the speed).
const forward = camera.getWorldDirection(new Vector3()); forward.y = 0; forward.normalize()
const right = new Vector3().crossVectors(forward, camera.up).normalize() // press D → +right
const moveDirection = new Vector3()
if (input.forward) moveDirection.add(forward)
if (input.right) moveDirection.add(right) // if A/D feel swapped, flip this cross product's arg order

// 2) Drive Acta with the intent + aim. Acta advances the animation, derives the desired velocity,
//    and calls your motion hook (applyMotionOutput) — that hook is where you set
//    physics.inputVelocity and step physics. One-shot actions are requestAction, not raw input.
character.update(delta, { moveDirection, aimDirection, facingDirection, grounded: physics.isGrounded })
if (firedThisFrame) character.requestAction('fire')

// 3) Camera, with world collision so it never clips through geometry.
cameraBehavior.update(camera, model.scene, delta, (ray, far) => world.raycast(ray, far)?.distance)

// NEVER call model.mixer.update(delta). Acta advances the mixer; calling it double-advances and
// corrupts both the pose and the motion. (See the acta skill.)
```

The Acta wiring itself — `acta convert`, the generated character class, and the `applyMotionOutput` / `applyJumpOutput` / effect hooks that connect Acta's motion and timed events to `BvhCharacterPhysics` and gameplay — lives in the **acta** skill. Aiming and shooting use the camera's full world direction (so aim includes pitch); raycast from screen center and hit the collider the ray intersects.
