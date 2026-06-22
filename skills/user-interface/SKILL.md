---
name: user-interface
description: "Design and build user interfaces for 3D apps and games — routing between spatial 3D/XR UI and 2D HUD UI, plus visual design principles. Use when adding menus, HUDs, panels, dashboards, or any in-app UI to a Three.js project, or deciding which UI technology to use."
---

# User Interface

Building good UI for a 3D app is two decisions: **where the UI lives** (spatial vs. screen) and **how it looks** (design quality). This skill routes the first and sets the bar for the second.

## Choosing the technology

Decide per surface — a single app often uses both:

| Surface | Use |
| --- | --- |
| A panel or control living in the 3D world | **`drawcall-ai/uikitml`** |
| Any UI in an app that targets AR/VR (even a flat panel — it renders as 3D geometry) | **`drawcall-ai/uikitml`** |
| A 2D HUD, menu, or overlay in a **non**-AR/VR app | **HTML/CSS** |

Spatial and XR UI go through the `drawcall-ai/uikitml` skill (`npx skills add drawcall-ai/uikitml`): pmndrs/uikit interfaces written as strict HTML-like markup you can validate, preview, and convert to Three.js / R3F / IWSDK. Flat HUD/menu chrome in a non-XR app is plain HTML/CSS over the canvas — faster, fully featured, crisp at any resolution; uikit is unnecessary there.

To make 3D objects (including spatial UI) respond to clicks and hovers, use the `@pmndrs/pointer-events` package.

## The loading screen

A 3D app does real work before its first frame — loading models, textures, environment maps, audio — and until that finishes the canvas is blank, so the player's *first* experience is a frozen black screen unless you cover it. Show a loading screen from the very start (plain HTML/CSS over the canvas in a non-XR app) carrying the product's identity and load progress, then fade it out once the scene is ready. It is part of the UX and the first thing any playthrough sees, not an afterthought — design it to the same bar as the rest of the UI, and advance its progress across the real load stages rather than faking a fixed timer. Drive the reveal from load completion and trigger the fade with a timer, not a lone `requestAnimationFrame` — a backgrounded or headless tab (such as a capture/proof run) can pause rAF, leaving the loader stuck on screen forever.

## Size From The Element

UI, canvas, camera, and postprocessing should follow the rendered element's actual box, not a one-time `window.innerWidth` snapshot. A loading screen can be up while the user enters fullscreen, rotates a device, resizes the browser, or the app host changes the iframe size. If resize listeners are registered only after async loading finishes, the first playable frame can keep the old canvas backing size and camera aspect while the HUD fills the new viewport.

Prefer a fixed full-viewport app container and a canvas styled to fill it:

```css
html, body { width: 100%; height: 100%; overflow: hidden; }
#app { position: fixed; inset: 0; width: 100%; height: 100%; }
canvas { width: 100%; height: 100%; display: block; }
```

Register size watching as soon as the canvas exists, before awaiting large assets. A `ResizeObserver` on the canvas or its container is usually a better source of truth than `window.resize`, because it also catches host/layout changes that do not behave like ordinary browser resizes. On each size update, resize every screen-sized render target together: renderer backing store, camera aspect/projection, postprocessing composer, and any fixed-pixel overlay canvases such as minimaps. Keep `renderer.setSize(width, height, false)` so CSS owns the displayed size, and update pixel ratio when device scale can change. `fullscreenchange` and `visualViewport.resize` are useful secondary nudges; they should call the same resize function rather than duplicating logic.

The check is concrete: trigger a resize or fullscreen change while the loading screen is still active, then verify the canvas client size, canvas backing size, and camera aspect all match the current viewport before the loader disappears.

## Design like a professional

The goal is interface that looks intentionally designed for *this* product — a game's UI should read like game UI, a tool's like a tool. The failure mode is the generic "AI app" look: it comes from defaulting to plausible-but-generic patterns instead of making deliberate choices. Design like a studio lead giving the product its own identity.

**Spend craft where it matters, stay minimal elsewhere.** Lavish detail on the few elements the user acts on — the primary action, the live readout, the focused state — and let everything else recede. Uniform decoration is noise; deliberate contrast is design. Progressive disclosure: show only what's relevant now, fade or hide the rest.

**Establish a system and hold to it.** A deliberate palette, a type scale, and consistent spacing read as quality; one-off styling reads as AI. Match it to the world and tone of what you're building.

**Type.** Avoid the default stacks (Inter, Roboto, Arial, system) and monospace-as-"technical" shorthand. Pick fonts that fit the product and build hierarchy from weight and scale. (uikit ships MSDF fonts — see the uikitml skill.)

**Color.** Commit to a dominant color with sharp accents over a timid even spread. Tint neutrals slightly toward the brand hue; avoid pure `#000`/`#fff`. Steer clear of the AI palette — purple-to-blue gradients, cyan-on-dark, neon glow.

**Layout.** Vary spacing for rhythm (tight groupings, generous separations); left-aligned usually reads as more designed than everything-centered. Reach for whitespace, alignment, scale, and contrast before adding chrome. Don't wrap everything in cards or repeat identical card grids.

**Motion.** A few intentional moments beat constant movement — one well-orchestrated entrance, one meaningful hover/reveal. Keep it fast and restrained with ease-out easing; skip bounce/elastic. In HTML, animate `transform`/`opacity`, not layout.

**Avoid these AI fingerprints:** glassmorphism everywhere, rounded cards with generic drop shadows, neon glow, emoji as icons, gradient text on headings/metrics, decorative sparklines, modals as a lazy default. (These are about UI *chrome* — they don't constrain the game world itself, where bloom and emissive glow are legitimately part of the look; see the `world` and `postprocessing` skills.)

**Legibility & ergonomics.** Strong contrast, comfortable sizing, clear focus/hover states; in spatial UI keep targets large and text readable at distance. Immersion never beats usability.

The slop test: if a glance would make someone think "AI made this," rework it. These are guardrails, not a cage — any palette, layout, or motion the product calls for is fair game as long as the result is intentional and fits.
