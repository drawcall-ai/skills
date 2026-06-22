---
name: pointer-events
description: "Forward DOM pointer events into a Three.js scene and filter them with @pmndrs/pointer-events for click/tap/hover interaction with 3D objects and portals. Use when objects in the scene need to be clickable, selectable, or hoverable."
---

# Pointer Events via `@pmndrs/pointer-events`

`@pmndrs/pointer-events` forwards real input into a Three.js scene so 3D objects fire pointer listeners, filters which objects get hit, and lets you define the shape of the pointer itself.

## Overview

The library rests on three pillars:

1. **Forward input in.** `forwardHtmlEvents` brings DOM events into the scene; `forwardObjectEvents` brings events from a surface into a separate portal scene. Each returns an `update()` that runs every frame.
2. **Filter what's hit.** The `pointerEvents` property (CSS-derived: `none`/`listener`/`auto`) and the `pointerEventsType` property (`all`/`allow`/`deny`/function) decide, per object, which events land.
3. **Define the pointer.** You can construct your own `Pointer` and choose how its intersection is computed.

These chain together: forwarding produces events that each carry a `pointerType`; filtering decides per object which of those events land; and custom pointers determine how and where intersection is computed. The sections below follow that order — forwarding events into a scene, filtering what gets hit, and custom pointers.

## Forwarding events into a scene

Forwarding installs a source of pointer events on the scene and gives you an `update()` to advance it each frame.

`forwardHtmlEvents` forwards the HTML document's events into the 3D scene. Call it with the DOM target, a camera getter, and the scene — `forwardHtmlEvents(document.body, () => camera, scene)` — and it returns `{ update }`. Call `update()` every frame in the render loop, before `renderer.render(scene, camera)`. Objects then receive events through `addEventListener('pointerover' | 'pointerout', (e: PointerEvent) => ...)`, where the `PointerEvent` type is imported from `@pmndrs/pointer-events` alongside `forwardHtmlEvents`. Each event exposes `e.point` (a vector, with `e.point.toArray()`), and you can attach multiple listeners for the same event type.

```ts
import * as THREE from 'three'
import { forwardHtmlEvents, PointerEvent } from '@pmndrs/pointer-events'

const width = window.innerWidth,
  height = window.innerHeight

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10)
camera.position.z = 1
const { update } = forwardHtmlEvents(document.body, () => camera, scene)

const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2)
const material = new THREE.MeshBasicMaterial({ color: new THREE.Color('red') })
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)

mesh.addEventListener('pointerover', (e: PointerEvent) => material.color.set('blue'))
mesh.addEventListener('pointerover', (e: PointerEvent) => console.log(e.point.toArray()))
mesh.addEventListener('pointerout', (e: PointerEvent) => material.color.set('red'))

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(width, height)
renderer.setAnimationLoop(() => {
  update()
  renderer.render(scene, camera)
})
```

`forwardObjectEvents` forwards events from a surface — for example a plane — into a separate scene that is rendered onto that surface, producing an interactive portal. It has the same shape as `forwardHtmlEvents`: pass the surface mesh, a camera getter, and the portal scene. It returns its own `update`, shown here as `updatePortal`, which must be called each frame alongside the main `update()`.

```ts
const { update: updatePortal } = forwardObjectEvents(planeMesh, () => portalCamera, portalScene)
// in the render loop, alongside the main update():
updatePortal()
```

## Filtering what gets hit

Two per-object properties control which events reach an object: `pointerEvents` selects whether the object is targetable at all, and `pointerEventsType` filters by the kind of pointer.

`pointerEvents` is based on the CSS `pointer-events` property and takes `none`, `listener`, or `auto`.

```js
object.pointerEvents = 'none'
```

- `none` — the object is never directly targeted.
- `auto` — the object is always targeted for events, matching the CSS property.
- `listener` — the additional value, and the **default**: the object is targeted only if it has any listeners attached.

The `listener` default is more reasonable than `auto` (the web default) for 3D scenes, which often contain semi-transparent content — particles, for instance — that should not catch pointer events by default.

Each object can also filter by pointer type through `pointerEventsType`, which defaults to `all` (events from every pointer type are accepted). To filter, set `{ allow: "screen-mouse" }` or `{ deny: "screen-touch" }` (`screen-mouse` is a normal mouse acting through a 2D screen). Both `allow` and `deny` accept a string or an array of strings, and `pointerEventsType` also accepts a function for custom logic.

The pointer types used by default are `screen-touch`, `screen-pen`, `ray`, `grab`, and `touch`. Events forwarded from the DOM carry a `pointerType` prefixed `screen-`, and events forwarded through a portal via `forwardObjectEvents` carry a `pointerType` prefixed `forward-`.

## Custom pointers

You can create your own `Pointer` — for example, to let first-person controls interact with their environment by placing the pointer inside the camera, or somewhere else entirely. A custom `Pointer` can use a normal `Ray` for intersection, a set of `Lines`, or a `Sphere` for grab and touch events.

## Pitfalls

The `pointerEvents` attribute of a `Mesh`/`Object3D` is not cloned when the object is cloned; reapply it on the clone.
