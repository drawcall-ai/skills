---
name: third-person
description: "Get the fundamentals of a third-person character right — camera-relative movement, an orbit camera with pitch and yaw, aiming and shooting from the screen-center crosshair, holding a weapon/tool in the hand, and playing use animations. Use when building a third-person player, especially a shooter."
---

# Third-Person Character & Aiming

Most third-person bugs come from **hand-rolling** the controller and getting a convention backwards. The turnkey path is `@pmndrs/viverse` `SimpleCharacter`, which already gives a correct orbit camera (yaw **and** pitch), camera-relative locomotion, and input bindings — prefer it for the player base and add aiming/shooting on top. If you do hand-roll, the four things below are where it goes wrong.

## Camera-relative movement (or A/D inverts)
Movement is relative to where the camera faces. Derive the basis from the camera, not from yaw alone:

```typescript
const forward = new Vector3()
camera.getWorldDirection(forward)
forward.y = 0
forward.normalize()
const right = new Vector3().crossVectors(forward, camera.up).normalize() // forward × up

const move = new Vector3()
if (input.forward) move.add(forward)
if (input.right) move.add(right)   // D = +right; if A/D feel swapped, your right vector has the wrong sign
```

`crossVectors(forward, up)` and `crossVectors(up, forward)` point opposite ways — pick the one where pressing D visibly goes right. This is the usual cause of inverted strafing.

## Orbit camera: yaw and pitch
A third-person camera orbits the character on **both** axes — yaw (turn) and pitch (look up/down) — clamped so you can't flip over. Accumulate both from the mouse and build the look direction from both; aim and shooting must use that full direction, **not yaw only** (yaw-only aim means you can never shoot up or down). See the `camera` skill for the orbit rig.

## Aim and shoot from the crosshair — hit what you point at
A shooter hits the thing under the center reticle. Raycast from the camera through screen center and take the **collider the ray actually intersects**, nearest first:

```typescript
raycaster.setFromCamera(new Vector2(0, 0), camera) // screen center
const hit = raycaster.intersectObjects(enemyColliders, true)[0]
if (hit) damage(hit.object)
```

Do **not** select the enemy whose direction is "most aligned" with the aim by a dot-product score — that hits enemies you aren't pointing at (a too-wide aim-assist cone). If you want a little forgiveness, use a small cone or a thicker ray/spherecast, not "nearest to aim".

## Hold the weapon in the hand, animate the use
- **Attach to the hand bone**, not the camera or the character root, so the weapon moves with the animated hand. Use `getBone(model, 'rightHand')` and fall back to common rig names (`mixamorig:RightHand`, `hand_r`, …) since rigs differ; parent the weapon to that bone.
- **Play fire/reload through the character's animation** (an Acta upper-body action via `requestAction('reload')`/`'fire'`), not by nudging the weapon mesh's rotation. A reload with no character animation reads as broken. See the `acta` skill for the `bodySplit` upper-body graph.
