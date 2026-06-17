---
name: ecs
description: "Structure game state with the EliCS entity-component-system: components, systems, queries, predicates, lifecycle, and the Input/State/View architecture. Use when organizing game logic with multiple interacting objects and state-driven update loops."
---

# Entity Component System

We use EliCS, a lightweight, high-performance Entity Component System framework for TypeScript. It uses a data-oriented design that prioritizes composition over inheritance, with efficient bitmasking and typed array storage.

**Core concepts:** Entities (unique objects), Components (data containers), Systems (logic processors), Queries (entity selectors), and World (the container managing everything).

## Recommended Architecture

Use 3 layers: Input, State, and View.

- mapping Input to State (Input Systems: receive user input, normalize it, and apply it to State. Complex inputs can be split across multiple systems (e.g., raw events → normalized actions → state updates). Each input system must provide methods to imperatively invoke all inputs enabling simulating and testing user input programmatically.)
- advancing State each frame (State Systems: advance the game state every frame (e.g., enemies chasing the player).)
- synchronizing State to the View (View Systems: reflect State in the View. Subscribe during initialization to entity creation/removal when needed (e.g., to create/destroy 3D objects or UI), and update frequently changing data each frame.)

### Recommended File Structure

- \`src/components/\*.ts\`: one component per file (e.g., position.ts, velocity.ts). Components hold state only; behavior belongs in systems.
- \`src/systems/\*.ts\`: one file per system (e.g., input.ts, physics.ts). Each system exports initialization and per-frame update functions.
- \`src/seed.ts\`: constructs startup entities and attaches their components so the game is immediately playable.
- \`src/main.ts\`: composes the game. Loads seed, registers systems, runs initialization, then advances all state each frame and syncs to the View.

## Creating a World

The "world" is where all ECS elements coexist.

```typescript
import { World } from 'elics'

const world = new World()
```

## Defining Components

Components are data containers that define entity properties.

```typescript
import { createComponent, Types } from 'elics'
import { world } from './world.ts'

// Available Types:
// - Scalars: Types.Float32, Types.Int16, Types.Boolean, Types.String
// - Vectors: Types.Vec2, Types.Vec3, Types.Vec4, Types.Color (RGBA 0-1)
// - References: Types.Entity, Types.Object, Types.Enum

// Define enums for type-safe state management using const assertions
export const UnitType = {
  Infantry: 'infantry',
  Cavalry: 'cavalry',
  Archer: 'archer',
} as const

export const CombatState = {
  Idle: 'idle',
  Moving: 'moving',
  Attacking: 'attacking',
  Defending: 'defending',
} as const

export const Position = createComponent(
  'Position',
  {
    value: { type: Types.Vec3, default: [0, 0, 0] },
  },
  '3D position coordinates',
)
//register components directly after creating them
world.registerComponent(Position)

export const Velocity = createComponent(
  'Velocity',
  {
    value: { type: Types.Vec3, default: [0, 0, 0] },
  },
  '3D velocity vector',
)
world.registerComponent(Velocity)

export const Health = createComponent(
  'Health',
  {
    value: { type: Types.Float32, default: 100 },
  },
  'Entity health points',
)
world.registerComponent(Health)

export const Unit = createComponent(
  'Unit',
  {
    type: { type: Types.Enum, enum: UnitType, default: UnitType.Infantry },
    state: { type: Types.Enum, enum: CombatState, default: CombatState.Idle },
    damage: { type: Types.Float32, default: 10, min: 1, max: 100 },
    armor: { type: Types.Int16, default: 0, min: 0, max: 50 },
    morale: { type: Types.Float32, default: 1.0, min: 0.0, max: 1.0 },
  },
  'Military unit with combat statistics',
)
world.registerComponent(Unit)

// Entity references
export const Target = createComponent('Target', {
  entity: { type: Types.Entity, default: null },
})
world.registerComponent(Target)
```

> **Important:** Vector types (`Vec2`, `Vec3`, `Vec4`, `Color`) must be accessed via `getVectorView()`, not `getValue()`/`setValue()`. EliCS throws at runtime if you use the wrong accessor.

## Creating Entities

Instantiate entities and attach components:

```typescript
const unit = world.createEntity()
unit.addComponent(Position, { value: [10, 20, 30] })
unit.addComponent(Velocity)
unit.addComponent(Health)
unit.addComponent(Unit, {
  type: UnitType.Infantry,
  state: CombatState.Moving,
  damage: 15,
  armor: 20,
  morale: 0.8,
})

// Reading and writing scalar values
const damage = unit.getValue(Unit, 'damage') // returns number
unit.setValue(Unit, 'state', CombatState.Attacking)

// Reading and writing vector values (returns TypedArray subarray)
const pos = unit.getVectorView(Position, 'value')
pos[0] = 100 // Modify X directly

// Check component existence
if (unit.hasComponent(Health)) {
  /* ... */
}

// Remove component or destroy entity
unit.removeComponent(Velocity)
unit.destroy() // entity.active becomes false
```

## Creating Systems

Systems contain the core logic.

```typescript
import { createSystem, Entity } from 'elics'
import { Object3D } from 'three'
import { scene } from './scene.ts'
import { unitModel } from './unit-model.ts'

const movementQueryConfig = {
  movables: { required: [Position, Velocity] },
}

export class MovementSystem extends createSystem(movementQueryConfig) {
  update(delta, time) {
    this.queries.movables.entities.forEach((entity: Entity) => {
      const position = entity.getVectorView(Position, 'value')
      const velocity = entity.getVectorView(Velocity, 'value')
      position[0] += velocity[0] * delta
      position[1] += velocity[1] * delta
      position[2] += velocity[2] * delta
    })
  }
}

const unitViewQueryConfig = {
  units: { required: [Unit, Position] },
}

export class UnitViewSystem extends createSystem(unitViewQueryConfig) {
  public readonly models = new Map<Entity, Object3D>()

  init() {
    const create = (entity: Entity) => {
      const newModel = unitModel.clone()
      scene.add(newModel)
      this.models.set(entity, newModel)
    }
    const destroy = (entity: Entity) => {
      const oldModel = this.models.get(entity)!
      scene.remove(oldModel)
      this.models.delete(entity)
    }
    // Loop through existing and subscribe to new query entities
    this.queries.units.entities.forEach(create)
    this.queries.units.subscribe('qualify', create)
    this.queries.units.subscribe('disqualify', destroy)
  }

  update(delta, time) {
    this.queries.units.entities.forEach((entity) => {
      const model = this.models.get(entity)!
      const pos = entity.getVectorView(Position, 'value')
      model.position.set(pos[0], pos[1], pos[2])
    })
  }

  destroy() {
    // Cleanup when system is unregistered
  }
}

// Register with priority (lower runs first)
world.registerSystem(MovementSystem, { priority: 0 })
world.registerSystem(UnitViewSystem, { priority: 10 })
```

## Accessing Systems

Retrieve a registered system instance using `world.getSystem(...)`:

```typescript
const enemySystem = world.getSystem(EnemySystem)!

// Access system properties and methods
enemySystem.spawnEnemy(position)
```

## System Resource Loading

Systems can define an async `load()` method for resource loading. The lifecycle order is: `init()` → `load()` → `update()`.

```typescript
export class EnemySystem extends createSystem(queryConfig) {
  private model!: Group

  init() {
    /* automatically called by registerSystem() */
  }

  async load() {
    this.model = (await new GLTFLoader().loadAsync('/models/enemy.glb')).scene
  }

  update(delta: number) {
    /* called every frame */
  }
}
```

In `main.ts`, call `load()` before starting the animation loop:

```typescript
// automatically calls init()
world.registerSystem(EnemySystem)
await world.getSystem(EnemySystem)!.load()
renderer.setAnimationLoop(() => { ... })
```

## System Lifecycle Control

Pause and resume systems dynamically using `stop()` and `play()`:

```typescript
const enemySystem = world.getSystem(EnemySystem)!

// Pause the system (e.g., during cutscenes or menus)
enemySystem.stop()

// Check if system is paused
if (enemySystem.isPaused) {
  console.log('Enemy system is paused')
}

// Resume the system
enemySystem.play()
```

> **Example Use case:** Pause physics during dialogue sequences, then resume when the player regains control.

## Query Predicates

Filter entities by component values using `where` clauses:

```typescript
const queryConfig = {
  lowHealth: {
    required: [Health, Unit],
    excluded: [Target], // Exclude entities with this component
    where: [{ component: Health, key: 'value', op: 'lt', value: 30 }],
  },
}
```

**Operators:** `eq` (equal), `ne` (not equal), `lt` (less than), `le` (less or equal), `gt` (greater than), `ge` (greater or equal), `in` (in array), `nin` (not in array).

## Updating the World

Update the world with `delta` and `time`.

```typescript
function render() {
  ...
  const delta = clock.getDelta()
  ...
  world.update(delta, clock.elapsedTime)
  ...
}
```
