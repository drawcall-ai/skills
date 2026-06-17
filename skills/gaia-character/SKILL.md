---
name: gaia-character
description: "Drive animated humanoid characters with @drawcall/acta — state machines, walk/run blending, bone attachments, jumping, and physics via applyMove/applyJump callbacks. Use when a game has a visible player avatar, NPCs, or enemies that need animation."
---

# Character using `@drawcall/acta`

Acta is a JSON-based language to define humanoid character behaviors for three.js.

Important: You should not create these behaviors yourself, rather use the `createCharacter` tool to generate a character and `editCharacter` to modify it. When prompting, describe character states and transitions (e.g. "idle", "waving") — these can then be driven via the `update` method.

Important: You cannot provide or create animation assets. The acta tool will use appropriate animations from its own library. Do not attempt to create animation files before calling `createCharacter`.

## Quick Start

> When using physics, you should pass an `applyMove` callback to `Character.load()`. This ensures movement is only applied during movement animations — preventing the character from sliding during idle, attack, or other non-movement states.

```typescript
import { BvhCharacterPhysics, BvhPhysicsWorld } from '@pmndrs/viverse'

// Setup physics
const physicsWorld = new BvhPhysicsWorld()
const characterPhysics = new BvhCharacterPhysics(physicsWorld)

// Load character WITH applyMove callback — this is REQUIRED for proper physics
const character = await Character.load((velocity, delta) => {
  characterPhysics.inputVelocity.copy(velocity)
})
scene.add(character)

// In your control system, only compute the desired velocity
const desiredVelocity = new Vector3(/* from input */)

// In render loop — pass velocity to character, let applyMove handle physics
character.update(delta, { worldMoveVelocity: desiredVelocity /* ...other props */ })
characterPhysics.update(character, delta, {})
```

> **Why applyMove?** Without it, you'd set `characterPhysics.inputVelocity` directly, causing the character to slide even when idle or attacking. The `applyMove` callback is invoked by the animation system only when movement animations are playing.

### Quick Start (without Physics)

```typescript
const character = await Character.load()
scene.add(character)

// In render loop
character.update(delta, { wave: waveButtonPressed })
```

> `update()` must be called every frame, even when no properties change. Always pass `worldMoveVelocity` — the `applyMove` callback handles when to actually apply it based on the current animation state.

---

## Attaching Items

Characters cannot hold items directly. Create items separately via `createModel` and attach to character bones:

```typescript
import { VRMHumanBoneName } from '@pmndrs/viverse'

const rightHand = character.getBone(VRMHumanBoneName.RightHand)
rightHand?.add(swordModel)
```

---

## Update Parameters

| Parameter            | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `worldHeadDirection` | Where the head looks (Vector3)                           |
| `worldAimDirection`  | Where to aim for pistol animations (Vector3)             |
| `worldMoveVelocity`  | Movement velocity in world space (Vector3)               |
| `...properties`      | Boolean properties evaluated by state machine conditions |

> **Automatic Walk/Run Selection:** During the "move" animation, acta automatically blends between walk and run animations based on the magnitude of `worldMoveVelocity`. Slower speeds play the walk animation, while faster speeds transition to run — no manual switching required.

> **Note:** The "Move" animation is built-in and does not require a URL in `animationUrls`. The system automatically provides walk/run animations that blend based on `worldMoveVelocity` magnitude.

> **Automatic Rotation:** Acta automatically rotates the character to face the `worldMoveVelocity` direction. Do not manually set `character.rotation` or use `lookAt()` — use `update()` exclusively.

---

## Events

Use animation events to synchronize game state with character animations. This is essential for state-driven logic where actions complete when animations finish.

```typescript
character.behavior.addEventListener('animationStarted', ({ name }) => {})
character.behavior.addEventListener('animationFinished', ({ name }) => {})
```

### Example: PlayerSystem with Reload

This EliCS system demonstrates the pattern of deriving character properties from game state, and using animation events to update that state:

```typescript
import { createSystem, Entity } from 'elics'
import { Vector3 } from 'three'
import { Character } from './player.acta'
import { Player, Velocity } from './components'

const playerQueryConfig = {
  players: { required: [Player, Velocity] },
}

export class PlayerSystem extends createSystem(playerQueryConfig) {
  public readonly characters = new Map<Entity, Character>()

  init() {
    const create = async (entity: Entity) => {
      const character = await Character.load()
      scene.add(character)
      this.characters.set(entity, character)

      // Animation events update game state
      character.behavior.addEventListener('animationFinished', ({ name }) => {
        if (name === 'Reload') {
          entity.setValue(Player, 'bullets', entity.getValue(Player, 'maxBullets'))
        }
      })
    }
    const destroy = (entity: Entity) => {
      const character = this.characters.get(entity)!
      scene.remove(character)
      this.characters.delete(entity)
    }
    this.queries.players.entities.forEach('qualify', create)
    this.queries.players.subscribe('qualify', create)
    this.queries.players.subscribe('disqualify', destroy)
  }

  update(delta: number) {
    this.queries.players.entities.forEach((entity: Entity) => {
      const character = this.characters.get(entity)!
      const velocity = entity.getVectorView(Velocity, 'value')

      // isReloading derived from game state — true when out of ammo
      const isReloading = entity.getValue(Player, 'bullets') === 0

      // Always call update every frame
      // Always pass worldMoveVelocity — applyMove controls when it's applied
      character.update(delta, {
        isReloading,
        worldMoveVelocity: new Vector3(velocity[0], velocity[1], velocity[2]),
      })
    })
  }
}
```

**Key pattern:**

- Properties like `isReloading` are derived from component state (`bullets === 0`)
- Animation events update component state (refill bullets on `animationFinished`)
- This creates a natural flow: empty magazine → `isReloading` true → reload plays → animation finishes → bullets refilled → `isReloading` false

---

## Built-in Properties

| Property   | Description                                          |
| ---------- | ---------------------------------------------------- |
| `isMoving` | Computed: true when `worldMoveVelocity.length() > 0` |

> **Troubleshooting:** If `isMoving` remains `false`, verify that you are passing a non-zero `worldMoveVelocity` to `character.update()`. You do NOT need to pass `isMoving` manually—it is computed automatically.

---

## Physics Integration (`applyMove`)

Pass an `applyMove` callback to `Character.load()` to integrate with physics (see [physics.md](./physics.md)). This ensures movement is only applied while movement animations are playing — preventing the character from sliding during idle or other non-movement states.

```typescript
const characterPhysics = new BvhCharacterPhysics(world)

const character = await Character.load((velocity, delta) => {
  characterPhysics.inputVelocity.copy(velocity)
})
```

---

## Jumping and Falling

Pass an `applyJump` callback to `Character.load()` for jump physics:

```typescript
const character = await Character.load(
  (velocity, delta) => {
    characterPhysics.inputVelocity.copy(velocity)
  },
  () => characterPhysics.applyVelocity(new Vector3(0, 10, 0)), // applyJump
)
```

Subscribe to `JumpAction` and set `isJumping` to true (see [actions.md](./actions.md)):

```typescript
import { JumpAction } from '@pmndrs/viverse'

JumpAction.subscribe(
  () => {
    isJumping = true
  },
  { signal: abortController.signal },
)
```

Sync `isGrounded` from physics each frame:

```typescript
character.update(delta, {
  isGrounded: characterPhysics.isGrounded,
  isJumping,
  worldMoveVelocity: desiredVelocity,
})
```

Reset `isJumping` when landing animation completes:

```typescript
character.behavior.addEventListener('animationFinished', ({ name }) => {
  if (name === 'Jump_Land') {
    isJumping = false
  }
})
```

> **Why applyJump?** Like `applyMove`, it ensures physics is only applied when the animation starts.
