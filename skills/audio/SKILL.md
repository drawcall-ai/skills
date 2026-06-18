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

## Overlap and browser policy
- One `Audio`/`PositionalAudio` node can't play twice at once. For rapid sounds (gunfire, footsteps) keep a small pool of nodes or create a fresh node per shot from the shared buffer, so sounds don't cut each other off.
- Browsers block audio until a user gesture. Resume on the first click/key: `listener.context.resume()`.

## Coverage

Walk the game's feedback moments and confirm each has a sound: fire, dry-fire, reload start + finish, pickup, craft, hit (dealt and taken), death, footstep (vary by surface), wave/round transitions, win/lose. Market `sound-effect` and `background-music` assets cover most needs; if a moment has no fitting asset, synthesize a short WebAudio tone rather than leaving it silent.
