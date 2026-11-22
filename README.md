# estructura

An interactive data structure visualizer built with **HTML, CSS and vanilla JavaScript** — no frameworks, no runtime dependencies, no build step.

Every operation runs step by step, narrates what happens in a log, and shows the Ω / Θ / O complexity of the operation being executed.

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

Tests use the built-in `node:test` runner. The structure modules are pure JavaScript, so the same files run in the browser and in Node.

## Architecture

```
index.html            App shell
styles.css            Theme, layout and node styles
js/
  app.js              UI wiring, routing and playback controls
  registry.js         Structure catalogue
  core/
    BaseStructure.js  Shared contract for all structures
    Animator.js       Drives generator-based operations
    complexity.js     Renders Omega / Theta / Big O tables
    layout/           Pure position calculators
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

The `Animator` calls `next()`, the layout computes positions, and the SVG renderer highlights `focus` ids. This keeps all twelve structures consistent and makes each one testable in isolation.

## Structures

More structures are added in phases; check the sidebar in the app for the current list.

| Phase | Structures |
| --- | --- |
| 0 | Stack |
| 1 | Queue, Array, Linked List |
| 2 | BST, AVL, B-Tree, B+ Tree, Trie, N-ary Tree |
| 3 | Hash Table |
| 4 | Graph |

## Roadmap

- Phase 3 adds the hash table with separate chaining and linear, quadratic and
  double probing, plus universal hashing.
- Phase 4 adds directed and undirected graphs with BFS, DFS and Dijkstra.
- GitHub Pages publishing is enabled from the `main` branch once the first push
  is made.
