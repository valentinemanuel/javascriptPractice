---
description: Computes SVG positions for each structure family
mode: subagent
---

Write ONLY files under `js/core/layout/`.

Each module exports a pure function with this signature:

    compute(state, viewport) -> Map<id, { x, y, width?, height?, extra? }>

Required layouts:

- `linear.js`: row or column positions for stacks, queues, arrays and lists.
- `tree.js`: hierarchical layout for BST, AVL, n-ary trees and tries. Use an
  in-order based x coordinate for binary trees and a level-based y coordinate.
- `multiKey.js`: layout for B-Tree and B+ Tree nodes with several keys per node.
- `hash.js`: grid of buckets with space for chains or probe trails.
- `force.js`: deterministic Fruchterman-Reingold layout for graphs, with a
  fixed iteration count and a manual-drag override map.

No DOM access, no dependencies, no timers. Report each exported function and
which structure ids use it.
