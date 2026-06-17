---
name: assets
description: "Choose and use the right asset-creation tool for a 3D web game — createModel, createMap, createCharacter, createImage, createSpeech, createMusic, createSoundEffect. Use when adding props, environments, characters, UI images, voice, music, or sound effects."
---

# Assets

## When to Use What

| Need                               | Tool                    | Example                           |
| ---------------------------------- | ----------------------- | --------------------------------- |
| Props, items, obstacles, furniture | `createModel`           | Trees, rocks, chests, weapons     |
| Environments, terrain, rooms       | `createMap` / `editMap` | Forest clearing, dungeon, village |
| Animated humanoids                 | `createCharacter`       | Player, NPCs, enemies             |
| UI Images, billboards, signs       | `createImage`           | Health bar icon, shop sign        |
| Voice lines, narration             | `createSpeech`          | NPC dialogue, tutorial voice      |
| Background music, ambience         | `createMusic`           | Battle theme, menu music          |
| Sound effects                      | `createSoundEffect`     | Explosions, footsteps, UI clicks  |

> ⚠️ **Never use primitive geometry** (BoxGeometry, SphereGeometry, CylinderGeometry) for visible game objects. Primitives are only for debug visualization or invisible colliders.

---

## GLTF/GLB Models

Create with `createModel`. Use for individual static 3D objects (furniture, props, vehicles, collectibles, obstacles) anchored at bottom-center. To understand or ask about a model (e.g. what it looks like, its style), use **askFile** with the model path and your question—not readFile or viewFile.

```typescript
const gltf = await new GLTFLoader().loadAsync('crystal.glb')
scene.add(gltf.scene)
```

**Workflow for new props:**

1. Use `createImage` to generate concept art (or provide a reference image)
2. Use `createModel` with the image to generate the 3D model
3. Load with GLTFLoader

---

## Charta Maps

Create static 3D maps with `createMap`, edit with `editMap`. Use for static environments e.g. rooms, terrain. See [map.md](./map.md) for full documentation.

```typescript
const map = await Map.load()
scene.add(map)
```

---

## Characters

Create with `createCharacter`, edit with `editCharacter`. Use for animated humanoid character models with behavior state machines using the `@drawcall/acta` library.

```typescript
const character = await Character.load()
scene.add(character)

//call every frame (e.g. to sync with ecs)
character.update(delta, { worldMoveDirection, ... })
```

---

## Images

Create with `createImage`, edit with `editImage`. Use for billboards, UI elements, flat visuals. To understand or ask about the contents of an image or texture (e.g. what is shown, style, colors), use **askFile** with the asset path and your question—not readFile or viewFile.

```typescript
const texture = await new TextureLoader().loadAsync('sign.png')
const sprite = new Sprite(new SpriteMaterial({ map: texture }))
scene.add(sprite)
```

---

## Audio

Create with `createSpeech`, `createMusic`, or `createSoundEffect`. Use for voice lines, background music, and sound effects.

```typescript
const audio = new Audio('greeting.mp3')
audio.play()
```

---

## Environment

Generate a simple environment map from the sun using Three.js Sky shader. This provides ambient lighting and reflections for the scene.

```typescript
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { PMREMGenerator } from 'three'

const sky = new Sky()
sky.scale.setScalar(450000)
scene.add(sky)

sky.material.uniforms.sunPosition.value = sunPosition

const pmremGenerator = new PMREMGenerator(renderer)
const renderTarget = pmremGenerator.fromScene(sky as any)
scene.environment = renderTarget.texture
scene.environmentIntensity = 0.3
```
