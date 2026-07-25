---
name: steel-arena
description: >-
  Maintain and extend the Steel Arena (鋼鐵擂台) first-person melee browser game
  (Vite + Three.js). Use when working in the steel-arena project, or when the
  user mentions 鋼鐵擂台, FP boxing, viewmodel arms, body-part hits, difficulty,
  or punch/block animations.
---

# 鋼鐵擂台 / Steel Arena

First-person steel-cage melee game at `D:\Projects\steel-arena` (Vite + Three.js).

## Run

- Double-click `開始遊戲.bat`, or `npm run dev`
- Opens `http://localhost:5173/`

## Architecture

| File | Role |
|------|------|
| `src/game.js` | Loop, HUD, finish/knockdown → result, difficulty, dual render |
| `src/player.js` | Move, aim zones, punches, block, **viewmodel scene** |
| `src/enemy.js` | AI chase/attack/block, body parts, knockdown |
| `src/arena.js` | Cage, lights |
| `src/config.js` | Difficulty presets + collide radius |
| `src/sfx.js` | WebAudio blips |

### Critical: viewmodel rendering

FP arms must **not** rely on `camera.add(arms)` alone — if the camera is not in the scene graph, Three.js will not draw those children.

**Required pattern** (already in code):

1. Arms live in `player.viewScene` with `player.viewCamera`
2. After world render: `clearDepth()` → render viewScene
3. Use `MeshBasicMaterial` so fists stay visible (no fog/lighting washout)
4. Show arms only when `player.visible` (hide on title idle orbit)

When changing render order, keep `#draw()` in `game.js` as world then viewmodel.

## Controls

- `WASD` move · `Shift` sprint · mouse look
- LMB / `Q` left fist · RMB / `E` right fist · `Space` block
- Aim pitch selects zone + punch style (see below)

## Aim / pitch convention

Mouse look: `pitch -= movementY * sens`

- **Look up** → `pitch > 0` → zone `head` → style `uppercut`
- **Level** → body → `straight`
- **Look down** → `pitch < 0` → `legs` → `hook`

Do **not** invert these thresholds without retesting UI labels (`頭部 · 上鉤拳` etc.).

## Punch styles

Keyframed in `player.#punchPoses` / `#setPunchFrame` — arcs must stay visually distinct:

- **straight**: cheek chamber → flat forward piston (Y almost fixed)
- **uppercut**: drop low → scoop high
- **hook**: wide outside → horizontal cross

Keep separate `dur` and hit windows per style. Rest/block poses stay **wide** (high `|x|`) so center FOV stays clear.

## Combat rules

- Body parts: head / body / legs spheres on enemy; prefer aimed zone
- Enemy can high/low block; blocked hits show `格擋!`
- Capsule separation via `COLLIDE_RADIUS` — no walking through enemy
- On KO / time-up: play knockdown, **then** show result (`finishing` flag)
- Result UI: 再戰一場 + 回選單 (`goToMenu` → title + idle preview)

## Difficulty

`config.js` → `DIFFICULTIES.easy|normal|hard`. Default **easy**. Apply via `applyDifficulty` on start/restart. Title screen `.diff-btn` sets `game.setDifficulty`.

## UI copy (zh-Hant)

Keep Traditional Chinese for HUD/menus. Aim chip format: `部位 · 拳種`.

## Change checklist

When editing combat/viewmodel:

1. Confirm arms still render (second pass)
2. Confirm look-down shows 下盤/下鉤拳, look-up shows 頭部/上鉤拳
3. Confirm three punch arcs look different
4. Confirm knockdown finishes before result menu
5. Smoke-test easy difficulty start from `開始遊戲.bat`
