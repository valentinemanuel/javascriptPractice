# Project instructions

`estructura` — an interactive data structure visualizer built with HTML, CSS and
vanilla JavaScript ES modules.

## Hard constraints

- HTML, CSS and vanilla JavaScript ES modules only. No frameworks, no runtime
  npm dependencies, no CDN scripts.
- All user-facing text, code comments, documentation, step messages and commit
  messages are written in English.
- `js/structures/*.js` is pure logic. Never use `document`, `window`, timers or
  any DOM API there.
- Every public operation is a generator (`function*`) that yields step objects.
  Never use `setTimeout` inside a structure.
- A step has this shape: `{ type, message, focus?: string[], payload?: object }`.
  `message` is a full, human-readable English sentence.
- Canonical state uses ids, never object cycles:
  `{ nodes: [...], edges: [...], root?: id, ... }`.
- Node shape: `{ id: string, value?: any, keys?: any[], leaf?: boolean,
  terminal?: boolean, ... }`.
- Edge shape: `{ from: id, to: id, label?: string, side?: string,
  weight?: number, directed?: boolean }`.
- Linear structures may use `{ items: [...] }` or `{ nodes: [...], head, tail }`.
- Hash table state: `{ buckets: [{ id, items: [...] }], capacity, size,
  strategy, hash }`.
- Every structure exports `export const meta = { ... }` with an `operations`
  map. Each operation entry has `description`, `best`, `average` and `worst`,
  and each of those has `{ symbol, text }`. Use Omega for best case, Theta for
  average case and Big O for worst case.
- Operations that take arguments declare `fields: [{ name, label, type,
  placeholder? }]`, where `type` is `number` or `string`. The app shell builds
  the inputs from this declaration, in order.
- Every structure exports a class extending `BaseStructure` with `reset(values)`,
  `seed(values)` and `getState()`. The class must also declare `static meta = meta;`
  so the app shell can build the sidebar before instantiating anything.
- Hash bucket items are objects with at least `{ id, value }`, and the hash
  layout must emit a position for every bucket id and every bucket item id.
- Tests use `node:test` and `node:assert`. Verify with `npm test`.
- Use stable, unique ids (for example `n1`, `n2`, `cell-0`, `bucket-2`).

## File ownership

- Structure agents: only `js/structures/<name>.js` and `tests/<name>.test.js`.
- Layout agent: only `js/core/layout/*.js`.
- Renderer agent: only `js/core/renderers/*.js` and `styles.css`.
- Orchestrator: `index.html`, `js/app.js`, `js/core/BaseStructure.js`,
  `js/core/Animator.js`, `js/core/complexity.js`, `README.md`, `package.json`,
  and OpenCode configuration files.

## Verification

Run `npm test` before reporting any task complete. Do not push until tests pass
and the reviewer agent has checked the changes.
