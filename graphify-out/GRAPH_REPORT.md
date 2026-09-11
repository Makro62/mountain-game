# Graph Report - .  (2026-09-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 219 nodes · 469 edges · 11 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7

## God Nodes (most connected - your core abstractions)
1. `getHeight()` - 31 edges
2. `useMountainStore` - 19 edges
3. `compilerOptions` - 19 edges
4. `riverCenterX()` - 13 edges
5. `Player()` - 12 edges
6. `sharedMat()` - 10 edges
7. `useShadows()` - 10 edges
8. `distToTrail()` - 9 edges
9. `tone()` - 9 edges
10. `Birches()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Minimap()` --calls--> `riverCenterX()`  [EXTRACTED]
  src/game/HUD.tsx → src/game/terrain.ts
- `Deer()` --calls--> `getHeight()`  [EXTRACTED]
  src/game/Animals.tsx → src/game/terrain.ts
- `pickTarget()` --calls--> `getHeight()`  [EXTRACTED]
  src/game/Animals.tsx → src/game/terrain.ts
- `pickTarget()` --calls--> `riverCenterX()`  [EXTRACTED]
  src/game/Animals.tsx → src/game/terrain.ts
- `Bridge()` --calls--> `getHeight()`  [EXTRACTED]
  src/game/River.tsx → src/game/terrain.ts

## Import Cycles
- None detected.

## Communities (11 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (26): Bird(), BirdFlock, Birds(), Deer(), DEER_ANCHORS, DeerHerd(), FLOCKS, pickTarget() (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (27): App(), directionHint(), HUD(), Minimap(), ToastMessage(), WEATHER_ICON, MountainScene(), SkyRig() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (27): EdelweissFlower(), EdelweissPatch(), MeadowFlowers(), mulberry32(), TerrainMesh(), Foam(), River(), WaterSurface() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, ES2020, src, vite/client, vite.config.ts, compilerOptions, allowImportingTsExtensions (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (25): eslint, @eslint/js, eslint-plugin-react-hooks, devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, tailwindcss (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (24): dependencies, react, react-dom, @react-three/drei, @react-three/fiber, three, zustand, description (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (15): ensureCtx(), muted(), playCheckpoint(), playLose(), playPickup(), playRock(), playStep(), playTent() (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.24
Nodes (17): LOOT_SPOTS, TREE_LINE, Birches(), dummyColor, GrassTufts(), nearTrailOrCamp(), pineTint(), placeAt() (+9 more)

## Knowledge Gaps
- **69 isolated node(s):** `BirdFlock`, `MatExtra`, `Inventory`, `Screen`, `Checkpoint` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getHeight()` connect `Community 2` to `Community 0`, `Community 1`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 4` to `Community 5`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `useMountainStore` connect `Community 1` to `Community 0`, `Community 2`, `Community 6`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `BirdFlock`, `MatExtra`, `Inventory` to the rest of the system?**
  _69 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11411411411411411 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09803921568627451 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12643678160919541 - nodes in this community are weakly interconnected._