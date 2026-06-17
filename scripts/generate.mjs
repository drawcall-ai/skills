#!/usr/bin/env node
/**
 * Generate installable agent skills from the source markdown docs.
 *
 * Each entry in META becomes a skill at `skills/<name>/SKILL.md`, consisting of
 * YAML frontmatter (name + description, as required by the `skills` CLI) followed
 * by the verbatim contents of the matching file in `source/`.
 *
 * Usage: node scripts/generate.mjs   (or: npm run generate)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = join(root, 'source')
const skillsDir = join(root, 'skills')

/**
 * One entry per skill. `name` must be lowercase with hyphens (CLI requirement),
 * `source` is the file in `source/`, and `description` is what an agent reads to
 * decide when to load the skill — keep it specific and include a "Use when…".
 */
const META = [
  {
    name: 'actions',
    source: 'actions.md',
    description:
      'Map player input (keyboard, mouse, touch, gamepad) to game logic with the @pmndrs/viverse action/binding system. Use when building movement controls, input handling, or custom state/event actions for a Three.js game.',
  },
  {
    name: 'assets',
    source: 'assets.md',
    description:
      'Choose and use the right asset-creation tool for a 3D web game — createModel, createMap, createCharacter, createImage, createSpeech, createMusic, createSoundEffect. Use when adding props, environments, characters, UI images, voice, music, or sound effects.',
  },
  {
    name: 'camera',
    source: 'camera.md',
    description:
      'Build first-person and third-person cameras plus effects (screen shake, FOV speed, rest smoothing) as ECS systems for Three.js games. Use when implementing or tuning camera movement and behavior.',
  },
  {
    name: 'character',
    source: 'character.md',
    description:
      'Drive animated humanoid characters with @drawcall/acta — state machines, walk/run blending, bone attachments, jumping, and physics via applyMove/applyJump callbacks. Use when a game has a visible player avatar, NPCs, or enemies that need animation.',
  },
  {
    name: 'ecs',
    source: 'entity-component-system.md',
    description:
      'Structure game state with the EliCS entity-component-system: components, systems, queries, predicates, lifecycle, and the Input/State/View architecture. Use when organizing game logic with multiple interacting objects and state-driven update loops.',
  },
  {
    name: 'lights',
    source: 'lights.md',
    description:
      'Set up lighting for Three.js scenes — choosing light combinations, shadows, and look. Use when configuring scene lighting, fixing flat or harsh lighting, or adding shadows.',
  },
  {
    name: 'map',
    source: 'map.md',
    description:
      'Create static 3D maps (terrain, rooms, villages, dungeons) with @drawcall/charta via the createMap/editMap natural-language tools, then load locations, placed objects, physics, and navigation from them. Use when building pre-authored environments.',
  },
  {
    name: 'math',
    source: 'math.md',
    description:
      'Use Three.js math classes (Vector3, Euler, Quaternion, Matrix4, Spherical) correctly instead of hand-rolled trigonometry, including when to pick Euler vs Quaternion. Use when doing rotations, orbit positioning, or any vector/angle math in a Three.js game.',
  },
  {
    name: 'navigation',
    source: 'navigation.md',
    description:
      'Generate navigation meshes and find paths for AI agents with navcat and navcat/three, including all generation parameters and the recast-style pipeline. Use when adding pathfinding or AI navigation over Three.js geometry.',
  },
  {
    name: 'physics',
    source: 'physics.md',
    description:
      'Add BVH-based physics for static/kinematic geometry with @pmndrs/viverse — physics worlds, character controllers, ground detection, and sensor volumes. Use when a game needs collision, a character controller, or enter/exit trigger volumes.',
  },
  {
    name: 'pointer-events',
    source: 'pointer-events.md',
    description:
      'Forward DOM pointer events into a Three.js scene and filter them with @pmndrs/pointer-events for click/tap/hover interaction with 3D objects and portals. Use when objects in the scene need to be clickable, selectable, or hoverable.',
  },
  {
    name: 'postprocessing',
    source: 'postprocessing.md',
    description:
      'Set up the postprocessing library — passes, effects, and the correct WebGLRenderer attributes — for fullscreen image effects in Three.js. Use when adding bloom, color grading, or other screen-space visual effects.',
  },
]

function frontmatter({ name, description }) {
  // description is single-line; escape any stray double quotes for safe YAML.
  const safe = description.replace(/"/g, '\\"')
  return `---\nname: ${name}\ndescription: "${safe}"\n---\n\n`
}

// Validate source files exist before wiping output.
const sources = new Set(readdirSync(sourceDir).filter((f) => f.endsWith('.md')))
const missing = META.filter((m) => !sources.has(m.source)).map((m) => m.source)
if (missing.length) {
  console.error(`Missing source files: ${missing.join(', ')}`)
  process.exit(1)
}
const orphans = [...sources].filter((s) => !META.some((m) => m.source === s))
if (orphans.length) {
  console.warn(`Warning: source files with no skill entry: ${orphans.join(', ')}`)
}

// Regenerate cleanly so removed entries don't leave stale skill folders.
if (existsSync(skillsDir)) rmSync(skillsDir, { recursive: true, force: true })
mkdirSync(skillsDir, { recursive: true })

for (const entry of META) {
  const body = readFileSync(join(sourceDir, entry.source), 'utf8').trimEnd()
  const dir = join(skillsDir, entry.name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), frontmatter(entry) + body + '\n')
  console.log(`  ${entry.name}  ←  source/${entry.source}`)
}
console.log(`\nGenerated ${META.length} skills into skills/`)
