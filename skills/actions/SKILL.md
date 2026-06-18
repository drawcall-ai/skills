---
name: actions
description: "Map player input (keyboard, mouse, touch, gamepad) to game logic with the @pmndrs/viverse action/binding system. Use when building movement controls, input handling, or custom state/event actions for a Three.js game."
---

# Actions and Action Bindings with `@pmndrs/viverse`

Actions decouple inputs from game logic. Bindings translate hardware events into actions that systems consume each frame.

**Input → Binding → Action → Game Logic**

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

## Summary

- **Decouple input from logic** – systems consume actions, not raw input events.
- **Compose inputs** – multiple bindings write to the same action; values merge.
- **Think signals** – code against "move forward" or "rotate," not specific keys.
