# estructura

**Live demo:** https://valentinemanuel.github.io/javascriptPractice/

An interactive data structure visualizer built with **HTML, CSS and vanilla JavaScript** — no frameworks, no runtime dependencies, no build step.

Every operation runs step by step, narrates what happens in an accessible log, highlights the affected nodes in SVG, and shows the Ω / Θ / O complexity of the operation being executed.

## Features

- 12 structures, each with its own operation toolbar and complexity table.
- Step-by-step playback: play, pause, single step, speed control and reset.
- Generic SVG renderer with node highlighting, zoom and pan.
- Dark and light themes, responsive layout and `prefers-reduced-motion` support.
- Hash table with four collision strategies, three hash functions and universal hashing.
- Graph with directed/undirected and weighted/unweighted modes plus BFS, DFS and Dijkstra.
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
- **Visual feedback:** home bucket, every probe, collisions, tombstones, load factor and animated rehashing.

### Graph details

- Directed and undirected modes, weighted and unweighted modes.
- BFS shows levels, DFS shows visit order, Dijkstra shows distance labels and relaxations using a binary min-heap.
- Dijkstra rejects negative weights because its settled-set invariant requires non-negative edges.

## Run it

Open `index.html` directly, or serve the folder:

```sh
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Tests

```sh
npm test
```

244 tests use the built-in `node:test` runner. Structure modules are pure JavaScript, so the same files run in the browser and in Node without a bundler.

## Architecture

```
index.html            App shell
styles.css            Theme, layout and node styles
AGENTS.md             Project rules for AI agents
.opencode/            Agent and command definitions used to build the project
js/
  app.js              UI wiring, routing and playback controls
  registry.js         Structure catalogue
  core/
    BaseStructure.js  Shared contract for all structures
    Animator.js       Drives generator-based operations
    complexity.js     Renders Omega / Theta / Big O tables
    layout/           Pure position calculators (linear, tree, multiKey, hash, force)
    renderers/        Generic SVG renderer
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
