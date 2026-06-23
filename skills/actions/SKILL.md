---
name: actions
description: "Map player input (keyboard, mouse, touch, gamepad) to game logic with the @pmndrs/viverse action/binding system. Use when building movement controls, input handling, or custom state/event actions for a Three.js game, or when controls must change across game modes (menu, play, pause, cutscene) — e.g. pointer-lock controls wrongly stay live during a menu and a button click locks the pointer."
---

# Actions and Action Bindings with `@pmndrs/viverse`

Actions decouple inputs from game logic. Bindings translate hardware events into actions that systems consume each frame.

**Input → Binding → Action → Game Logic**

This skill covers only the input layer. For a moving character, that intent flows on: **input → Acta → physics** — your system reads these actions and hands a move *intent* to Acta (animation), which produces the velocity for `BvhCharacterPhysics`. Don't drive the physics controller straight from raw input. See the **acta**, **physics**, and **camera** skills.

## Action Types

- **StateAction** – Persistent state (movement, running). Multiple writers merge into one value via `.get()`.
- **EventAction** – One-shot events (jump, fire). Emitted via `.emit()`, consumed via `.subscribe()`.

## Built-in Actions

| Action                                                                         | Type  | Purpose                                                                                   |
| ------------------------------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------- |
| `MoveForwardAction`, `MoveBackwardAction`, `MoveLeftAction`, `MoveRightAction` | State | Movement (0–1) — read with `.get()` each frame                                            |
| `RunAction`                                                                    | State | Sprint toggle — read with `.get()` each frame                                             |
| `JumpAction`                                                                   | Event | Jump trigger — use `.subscribe()` |
| `RotateYawAction`, `RotatePitchAction`                                         | Event | Ready-to-use rotation delta (radians) — use `.subscribe()` and accumulate                 |
| `ZoomAction`                                                                   | Event | Camera zoom delta — use `.subscribe()`                                                    |

> **State vs Event**: State actions persist until changed — poll with `.get()`. Event actions fire once — capture with `.subscribe()` or values are lost.

## Using Actions in Systems

The examples below assume one `const abortController = new AbortController()` created at setup; its `.signal` is passed to every binding and subscription so they all clean up together (see [Lifecycle](#lifecycle) at the end).

Poll **StateAction** with `.get()` each frame. Subscribe to **EventAction** once at init — never in the update loop.

```typescript
class PlayerSystem extends createSystem(query) {
  private isJumping = false

  init() {
    // ✅ Subscribe to events ONCE
    JumpAction.subscribe(
      () => {
        this.isJumping = true
      },
      { signal: abortController.signal },
    )
  }

  update(delta: number) {
    // ✅ Poll state each frame
    const forward = MoveForwardAction.get()

    // ❌ NEVER subscribe here — creates duplicate listeners every frame
  }
}
```

## Built-in Bindings

All built-in bindings take `(domElement, abortSignal)` and clean up automatically when aborted.

### Keyboard

```typescript
import { KeyboardLocomotionActionBindings } from '@pmndrs/viverse'

const keyboard = new KeyboardLocomotionActionBindings(document.body, abortController.signal)

// Optional: require pointer lock for movement
keyboard.moveForwardBinding.requiresPointerLock = true

// Optional: customize keys (defaults: WASD, Shift, Space)
keyboard.moveForwardBinding.keys = ['KeyW', 'ArrowUp']
```

### Mouse (Pointer Lock)

```typescript
import { PointerLockRotateZoomActionBindings } from '@pmndrs/viverse'

const mouse = new PointerLockRotateZoomActionBindings(document.body, abortController.signal)
mouse.lockOnClick = true
```

With `lockOnClick`, a click anywhere on the target locks the pointer — so this binding must not be live while the player needs the cursor for menus or HUD buttons, or the menu becomes unusable. See [Scope controls to the active mode](#scope-controls-to-the-active-mode).

#### Consuming Rotation Deltas

`RotateYawAction` and `RotatePitchAction` emit ready-to-use rotation deltas (radians) on mouse move. Subscribe and accumulate them:

```typescript
import { RotateYawAction, RotatePitchAction } from '@pmndrs/viverse'
import { Euler } from 'three'

let pitch = 0,
  yaw = 0
RotatePitchAction.subscribe(
  (delta) => {
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + delta))
  },
  { signal: abortController.signal },
)
RotateYawAction.subscribe(
  (delta) => {
    yaw += delta
  },
  { signal: abortController.signal },
)

// Apply to camera: positive pitch = look up, positive yaw = look left
camera.rotation.copy(new Euler(pitch, yaw, 0, 'YXZ'))
```

> **Convention**: Positive pitch rotates up, positive yaw rotates left. Use `Euler(pitch, yaw, 0, 'YXZ')` order — see the camera skill for camera patterns.

### Touch (Pointer Capture)

```typescript
import { PointerCaptureRotateZoomActionBindings } from '@pmndrs/viverse'

const touch = new PointerCaptureRotateZoomActionBindings(document.body, abortController.signal)
```

### Mobile UI

```typescript
import { ScreenJoystickLocomotionActionBindings, ScreenButtonJumpActionBindings } from '@pmndrs/viverse'

const joystick = new ScreenJoystickLocomotionActionBindings(document.body, abortController.signal)
const jumpBtn = new ScreenButtonJumpActionBindings(document.body, abortController.signal)
```

Controls are auto-hidden on desktop via the `.mobile-only` CSS class.

### Custom Key → Action Mapping

Use `mapFrom` to transform input events before emitting:

```typescript
import { KeyboardActionBinding, RotateYawAction } from '@pmndrs/viverse'

const mapped = RotateYawAction.mapFrom((e: KeyboardEvent) => {
  if (e.code === 'KeyQ') return -0.02
  if (e.code === 'KeyE') return 0.02
  return 0
})

const binding = new KeyboardActionBinding(mapped, document.body, abortController.signal)
binding.keys = ['KeyQ', 'KeyE']
```

## Creating Custom Actions

```typescript
import { StateAction, EventAction } from '@pmndrs/viverse'

// StateAction(mergeFn, neutralValue)
const CrouchAction = new StateAction<boolean>((a, b) => a || b, false)

// EventAction(combineFn?, neutralValue?)
const FireAction = new EventAction<void>()
```

> A `StateAction` **must** be given a merge function and neutral value — `.get()` throws without them (the merge fn is what combines multiple writers). An `EventAction` only needs a combine function if you intend to read it with `.get()`; for the normal `.emit()`/`.subscribe()` pattern, the no-arg form is fine.

## Writing to StateAction

Create a writer, then call `.write()` on state changes. Multiple writers merge automatically.

```typescript
const crouchWriter = CrouchAction.createWriter(abortController.signal)

document.body.addEventListener(
  'keydown',
  (e) => {
    if (e.code === 'KeyC') crouchWriter.write(true)
  },
  { signal: abortController.signal },
)

document.body.addEventListener(
  'keyup',
  (e) => {
    if (e.code === 'KeyC') crouchWriter.write(false)
  },
  { signal: abortController.signal },
)

// Read merged state
const isCrouching = CrouchAction.get()
```

## Emitting EventAction

Call `.emit()` when the event occurs. For continuous polling (e.g., gamepad), track previous state to emit only on press:

```typescript
let wasPressed = false

function pollGamepad() {
  const pressed = navigator.getGamepads()[0]?.buttons[0].pressed ?? false
  if (pressed && !wasPressed) FireAction.emit()
  wasPressed = pressed
  requestAnimationFrame(pollGamepad)
}

// Or subscribe to events
FireAction.subscribe(() => console.log('Fire!'), { signal: abortController.signal })
```

## Lifecycle

Use `AbortController` to manage cleanup:

```typescript
const abortController = new AbortController()

// Create bindings...
const keyboard = new KeyboardLocomotionActionBindings(document.body, abortController.signal)

// Clean up all bindings at once
abortController.abort()
```

## Scope controls to the active mode

A game has modes — a menu, active play, a pause screen, a cutscene, a game-over screen — and the controls that are live must match the current mode. The cleanest way to guarantee that is to give each mode its own `AbortController` (see [Lifecycle](#lifecycle)): entering a mode aborts the previous mode's controller, tearing down all of its bindings and subscriptions at once, and constructs the bindings the new mode needs. Controls that don't exist can't misfire, which is a stronger guarantee than disabling them with a flag.

The recurring failure is leaving gameplay controls live in a mode that doesn't use them. A `PointerLockRotateZoomActionBindings` with `lockOnClick = true` constructed at startup and never torn down grabs the pointer the moment the player clicks a menu button, making the menu unusable. The fix is not a special case for that button — it is that the menu mode constructs no gameplay controls at all, so the lock binding exists only once play begins. The same shape makes a cutscene keep responding to WASD and mouse-look when the play mode's bindings were left live; the cutscene mode should own no player controls.

When a single mode genuinely needs both live controls and clickable DOM UI — a HUD button during play — the UI interaction must not reach the listener that locks the pointer. A lock-on-click listener on `document.body` fires for clicks anywhere, because the event bubbles up to it. Pass the **canvas element** as the binding's DOM target instead of `document.body`, so a click on overlay UI outside the canvas never reaches it; or call `stopPropagation()` in the UI's `pointerdown` handler. (For clickable UI inside the 3D scene, filtering is per-object — see the `pointer-events` skill.)

Controls are rarely the only thing a mode owns: a cutscene or pause usually also freezes the simulation (stop and resume the relevant systems — see the `ecs` skill) and may hand the camera to a different owner (see the `camera` skill). Switch everything a mode owns together on the transition — the bug is always the one concern left live from the previous mode.

## Limitations — filling gaps

The built-in bindings cover keyboard, mouse (pointer-lock), touch, and on-screen mobile controls. When you need something they don't — a gamepad, a remapped key, a game-specific verb (crouch, lean, ability) — that's expected: define a custom `StateAction`/`EventAction` and either a `mapFrom` binding or your own DOM/gamepad listener that writes to it (shown above). The action layer is meant to be extended this way, so reach for a custom action rather than reading raw input inside gameplay systems.
