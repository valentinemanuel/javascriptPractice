# StructLab

**Live demo:** https://valentinemanuel.github.io/structlab/

An interactive data structure visualizer built with **HTML, CSS and vanilla JavaScript** — no frameworks, no runtime dependencies, no build step.

Every operation runs step by step, narrates what happens in an accessible log, highlights the affected nodes in SVG, and shows the Ω / Θ / O complexity of the operation being executed.

## Features

- 12 structures, each with its own operation toolbar and complexity table.
- Step-by-step playback: play, pause, single step, speed control and reset. **Clear** in the header empties the active structure completely (keeping Array/Hash capacity slots and the Trie root), while **Reset** restores its demo state. The activity log has its own **Clear** button. Each step is numbered in the log, which auto-scrolls to the newest event. Press **Enter** in an argument field to run the primary operation and **Space** outside any control to toggle playback.
- Pure inline SVG renderer with reusable gradients, glow on the active node, cubic Bézier tree edges and rounded edge badges. Linear structures are visually distinct: Stack blocks in an open frame, Queue blocks in a lane with FRONT/BACK flow arrows, and Array cells in a contiguous memory strip with dotted reserved-capacity slots.
- Multi-key trees draw each branch from its own separator (left of the first key, between keys, right of the last key); B+ trees also link their leaves left to right with arrows.
- Hash tables use a three-stage left-to-right diagram: an **Input Key** card, a **Hash Function** block showing the live calculation (`25 mod 7 = 4`) and a vertical **Index / Value** table. A curved arrow points to the resulting row, chaining nodes hang off that row, and probe attempts are numbered and animated.
- Persistent controls: the operation bar stays visible and the complexity panel shows only the active operation by default (with a **Show all** toggle), so no scrolling is needed.
- An Antigravity-style interactive background on its own `<canvas>`: a uniform particle grid that reacts to the pointer, a faint mouse-following radial glow and automatic Dark/Light palettes. It never touches the structure SVG.
- A 56px glassmorphism header with a theme-aware three-node SVG badge, monospaced `12 Structures` / `Vanilla JS` badges, **Random data** and the theme toggle. Zoom controls (+ / − / Reset view) float over the viewer, and Reset view re-fits the structure automatically.
- Glassmorphism panels (translucent background + `backdrop-filter: blur(12px)`), a transparent SVG stage and a floating rounded control dock at its base.
- Complexity cells show compact Ω / Θ / O pills; the full explanation lives below the table and in per-cell tooltips.
- SVG favicon, dark and light themes, responsive layout and `prefers-reduced-motion` support.
- Hash table with four collision strategies, three hash functions and universal hashing.
- Graph with directed/undirected and weighted/unweighted modes plus BFS, DFS and Dijkstra. Vertices can be dragged to rearrange the layout; Dijkstra accepts an optional target, highlights the selected shortest path and announces it in a banner. Traversals show their visit order the same way. Each vertex shows its current distance and directed arrows stop at the destination circle's edge. A compact legend explains the node-state colors.
- Client-side export/import: **Export PNG** renders the fitted scene into a 2x canvas with embedded theme styles; **Export JSON** saves the canonical state plus settings; **Import JSON** accepts a picker or drag & drop and switches structures automatically.
- Pure logic modules tested in Node with the built-in test runner.

## Structures

| Group | Structure | Operations |
| --- | --- | --- |
| Linear | Stack | push, pop, peek, isEmpty |
| Linear | Queue | enqueue, dequeue, peek, isEmpty |
| Linear | Array | access, insert, delete, search |
| Linear | Linked List | insertHead, insertTail, insertAt, delete, search, reverse |
| Trees | BST | insert, search, delete, inorder, preorder, postorder |
| Trees | AVL Tree | insert, search, delete (with LL/LR/RL/RR rotations) |
| Trees | B-Tree | insert, search, delete (borrow and merge) |
| Trees | B+ Tree | insert, search, rangeQuery, delete |
| Trees | Trie | insert, search, startsWith, delete |
| Trees | N-ary Tree | insert, insertChild, search, delete, bfs, dfs |
| Hashing | Hash Table | put, get, remove, strategy/hash setters, newUniversalFamily |
| Graphs | Graph | addVertex, addEdge, removeVertex, removeEdge, bfs, dfs, dijkstra, mode setters |

### Hash table details

- **Collision strategies:** separate chaining with linked lists, linear probing, quadratic probing and double hashing.
- **Hash functions:** `k mod m`, multiplication (Knuth golden ratio) and universal hashing `h(k) = ((a·k + b) mod p) mod m` with **New universal family** to regenerate `(a, b)`.
- **Visual feedback:** home bucket, every probe, collisions, tombstones and animated rehashing.

### Graph details

- Directed and undirected modes, weighted and unweighted modes.
- BFS shows levels, DFS shows visit order, Dijkstra shows distance labels and relaxations using a binary min-heap.
- Dijkstra rejects negative weights because its settled-set invariant requires non-negative edges.

## Run it

A local server is required because the app uses ES modules, which browsers block over `file://`.

```sh
python -m http.server 8080
```

Then visit `http://localhost:8080`. Alternatively, use the live demo linked at the top.

## Tests

```sh
npm test
```

315 tests use the built-in `node:test` runner. Structure modules are pure JavaScript, so the same files run in the browser and in Node without a bundler.

## Architecture

```
index.html            App shell
styles.css            Theme, layout and node styles
AGENTS.md             Project rules for AI agents
.opencode/            Agent and command definitions used to build the project
js/
  app.js              UI wiring, routing and playback controls
  registry.js         Structure catalogue
  ui/
    background.js     Interactive particle/glow canvas behind the UI
  core/
    BaseStructure.js  Shared contract for all structures
    Animator.js       Drives generator-based operations
    complexity.js     Renders Omega / Theta / Big O tables
    layout/           Pure position calculators (linear, tree, multiKey, hash, force)
    renderers/        Generic SVG renderer
    fit.js            Pure camera fit calculation
    shortcuts.js      Keyboard shortcut helpers
  utils/
    io.js             Client-side PNG / JSON export and JSON import helpers
  structures/         Pure data structure logic (one file per structure)
tests/                node:test suites
```

### The core idea

Structures never touch the DOM. Every operation is a generator that yields steps:

```js
*search(value) {
  yield { type: 'compare', message: `Compared ${value} with 42.`, focus: ['n3'] };
}
```

The `Animator` calls `next()`, a layout computes positions, and the SVG renderer highlights the `focus` ids. This keeps all twelve structures consistent and makes each one testable in isolation.

### Complexity convention

Each operation declares three bounds with a short explanation:

- **Ω** — best case
- **Θ** — average case
- **O** — worst case

The complexity panel highlights the row of the operation currently running, so the notation is tied to what you are watching rather than being static decoration.

## Development with OpenCode

This repository was built with OpenCode agents. `.opencode/agents/` defines four subagents:

- `structure-dev` — implements one structure and its tests
- `layout-dev` — computes SVG positions
- `renderer-dev` — draws states in SVG
- `reviewer` — read-only review after each phase

`.opencode/commands/structure.md` adds the `/structure <name>` slash command. `AGENTS.md` carries the rules every agent follows.

## License

MIT
