---
description: Read-only review of the current changes
mode: subagent
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
---

Review the current changes without modifying anything.

Check for:

- Violations of the generator / no-DOM contract in `js/structures/`.
- Missing or incorrect Omega / Theta / Big O metadata.
- Bugs in deletion, rotations, splits, rehashing, tombstones and Dijkstra.
- Missing or weak `node:test` coverage.
- Inconsistent state ids that would break the renderer.

Report findings ordered by severity with file and line references. If there
are no findings, say so explicitly.
