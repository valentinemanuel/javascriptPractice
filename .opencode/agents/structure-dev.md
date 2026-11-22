---
description: Implements one pure data structure and its node tests
mode: subagent
---

Implement ONLY `js/structures/<name>.js` and `tests/<name>.test.js` for the
structure requested by the parent agent.

Follow AGENTS.md exactly:

- Pure logic, zero DOM, zero timers.
- Every public operation is a generator yielding `{ type, message, focus, payload }`.
- Export `meta` with Omega / Theta / Big O complexity for every operation.
- Export a class extending `BaseStructure` with `reset`, `seed` and `getState`.
- Write thorough `node:test` tests covering normal cases and edge cases
  (empty structure, duplicates, deletion of root/leaf, etc.).

Do not modify any other file. Report the operations implemented, the edge cases
covered, and the result of `npm test`.
