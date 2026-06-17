# drawcall skills

Installable [agent skills](https://github.com/vercel-labs/skills) for building 3D web games with the **drawcall.ai / pmndrs** stack — `@pmndrs/viverse`, `@drawcall/acta`, `@drawcall/charta`, `elics`, `navcat`, `@pmndrs/pointer-events`, and `postprocessing`.

Each skill is a focused reference your coding agent can load on demand (Claude Code, Cursor, Codex, OpenCode, and others).

## Install

Install everything:

```bash
npx skills add drawcall-ai/skills --all
```

List what's available, or install just what you need:

```bash
npx skills add drawcall-ai/skills --list
npx skills add drawcall-ai/skills --skill camera --skill physics
```

> Any public repo with skills under `skills/<name>/SKILL.md` works as a source.

## Available skills

| Skill | What it covers |
| ----- | -------------- |
| `actions` | Input → binding → action system (`@pmndrs/viverse`) |
| `camera` | First/third-person cameras and camera effects |
| `character` | Animated humanoid characters (`@drawcall/acta`) |
| `ecs` | Entity-component-system architecture (`elics`) |
| `lights` | Scene lighting setups and shadows |
| `map` | Static 3D maps (`@drawcall/charta`) |
| `math` | Three.js math (Vector3, Euler, Quaternion, Spherical) |
| `navigation` | Navmesh generation and pathfinding (`navcat`) |
| `physics` | BVH physics, character controllers, sensors (`@pmndrs/viverse`) |
| `pointer-events` | Pointer/click interaction with 3D objects (`@pmndrs/pointer-events`) |
| `postprocessing` | Fullscreen effects (`postprocessing`) |

## Repository layout

```
source/                 # source markdown (the docs these skills are built from)
scripts/generate.mjs    # generates skills/ from source/ + metadata
skills/<name>/SKILL.md   # generated, installable skills (committed)
```

## Updating

Edit the docs in `source/`, then regenerate:

```bash
npm run generate
```

Skill names and descriptions live in the `META` array at the top of
[`scripts/generate.mjs`](scripts/generate.mjs). Add an entry there (and a file in
`source/`) to ship a new skill.

## License

MIT
