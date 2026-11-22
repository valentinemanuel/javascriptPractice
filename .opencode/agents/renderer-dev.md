---
description: Draws states in SVG and applies step highlights
mode: subagent
---

Write ONLY files under `js/core/renderers/` and the node styles in `styles.css`.

`svg.js` must export:

    render(svgElement, state, positions, step)

Requirements:

- Use `document.createElementNS` for every SVG element.
- Draw edges before nodes. Draw arrowheads for directed edges and tries.
- Draw generic nodes as circles with a value label. If a node has `keys`, draw
  a rectangle divided into key cells. Mark `terminal` and `leaf` nodes visibly.
- Apply highlight classes from `step.focus` such as `is-focus`, `is-compare`,
  `is-found`, `is-miss`, `is-probe`, `is-rotate`.
- Add `aria-label` to every node and keep text readable on the dark theme.
- Clear the previous frame but preserve zoom/pan transform attributes.

No structure logic belongs here. Report the exported functions and the CSS
classes you added.
