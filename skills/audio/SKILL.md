---
name: audio
description: "Add sound to a Three.js game — a listener, positional world sounds vs. non-positional UI sounds, overlapping playback, and a sound at every feedback moment. Use when a game is silent or only some actions make sound."
---

# Audio

Sound is feedback, not polish. If an action changes the game (fire, reload, pickup, hit, death, footstep, UI click) and makes no sound, the moment feels broken. Wire a sound to every such moment.

## Setup

Attach one `AudioListener` to the camera, then choose positional vs. non-positional per sound:

```typescript
const listener = new AudioListener()
camera.add(listener)
const buffer = await new AudioLoader().loadAsync('/sound-effects/gunshot.mp3')

// World event with a position → PositionalAudio attached to the source (pans + attenuates with distance)
const shot = new PositionalAudio(listener)
shot.setBuffer(buffer)
weapon.add(shot)
shot.play()

// UI / non-spatial event (reload, pickup, menu) → plain Audio
const ui = new Audio(listener)
ui.setBuffer(buffer)
ui.play()
```

## Mix balance

Coverage should not make the mix tiring. Frequent cues and looping beds need quieter defaults than rare confirmation sounds, because repetition makes even correct sounds feel loud. Footsteps, ambient wind, engine hums, drones, and other near-constant sounds usually sit as low texture; they should confirm motion or mood without competing with weapons, hits, UI confirmations, or voice. Start conservative on repeated sounds, then raise only when the game loses readable feedback.

Prefer positional playback for world sounds whose source is visible or meaningful in space: enemy shots, enemy deaths, impacts, doors, machines, pickups in the world, and nearby hazards. Non-positional playback fits UI, music beds, narration, and player-only feedback that should stay stable in the listener's head. If a world sound must be non-positional for technical reasons, lower it and document the tradeoff so it does not read as a global alert.

## Overlap and browser policy
- One `Audio`/`PositionalAudio` node can't play twice at once (`.play()` on an already-playing node warns and no-ops). For rapid sounds (gunfire, footsteps) keep a small pool of nodes or create a fresh node per shot from the shared buffer, so sounds don't cut each other off. A `PositionalAudio` only pans/attenuates while it's parented into the scene graph (`source.add(node)`), so a pooled positional node must stay attached — plain non-positional `Audio` has no such requirement.
- Browsers block audio until a user gesture. Resume on the first click/key: `listener.context.resume()`.

## Coverage

Walk the game's feedback moments and confirm each has a sound: fire, dry-fire, reload start + finish, pickup, craft, hit (dealt and taken), death, footstep (vary by surface), wave/round transitions, win/lose. Market `sound-effect` and `background-music` assets cover most needs; if a moment has no fitting asset, synthesize a short WebAudio tone rather than leaving it silent.

## Voice and narration -> `speech` skill

For spoken output — NPC dialogue, narration, tutorial voice, accessibility readouts — route to the `speech` skill. It returns an audio clip URL from text and voice input, including guidance for voice selection, caching, browser autoplay constraints, and first-request warmup. Use this audio skill only to play the resulting clip through the same `Audio`/`PositionalAudio` nodes above.
