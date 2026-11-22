/**
 * Layout for B-Trees and B+ Trees, whose nodes hold several keys.
 *
 * Horizontal positions follow child order (edge.index, then edge order):
 * leaves are packed left to right and each internal node is centred over its
 * children. Node width grows with the key count. B+ leaf chains (node.next)
 * are aligned on a single, consistent row.
 */

const NODE_HEIGHT = 46;
const TOP_PADDING = 80;
const LEVEL_GAP = 110;
const SIBLING_GAP = 28;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function widthFor(node) {
  return Math.max(80, asArray(node?.keys).length * 40 + 14);
}

export function compute(state = {}, viewport = {}) {
  const width = viewport.width ?? 900;
  const nodes = asArray(state.nodes);
  const positions = new Map();
  if (nodes.length === 0) return positions;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = asArray(state.edges);
  const children = new Map(nodes.map((node) => [node.id, []]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));

  edges.forEach((edge, order) => {
    if (!edge || !nodeById.has(edge.from) || !nodeById.has(edge.to)) return;
    children.get(edge.from).push({ id: edge.to, sortKey: edge.index ?? order });
    incoming.set(edge.to, incoming.get(edge.to) + 1);
  });
  for (const list of children.values()) {
    list.sort((a, b) => a.sortKey - b.sortKey);
  }

  function childIds(id) {
    return (children.get(id) ?? []).map((child) => child.id);
  }

  // Depth from the root, with graceful fallbacks for disconnected nodes.
  const depth = new Map();
  function assignDepths(startId) {
    if (!nodeById.has(startId) || depth.has(startId)) return;
    depth.set(startId, 0);
    const queue = [startId];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const id = queue[cursor];
      for (const child of childIds(id)) {
        if (depth.has(child)) continue;
        depth.set(child, depth.get(id) + 1);
        queue.push(child);
      }
    }
  }
  assignDepths(state.root);
  for (const node of nodes) {
    if (!depth.has(node.id) && incoming.get(node.id) === 0) assignDepths(node.id);
  }
  for (const node of nodes) {
    if (!depth.has(node.id)) assignDepths(node.id);
  }

  // Width of a whole subtree including the gaps between its children.
  const spanCache = new Map();
  const active = new Set();
  function subtreeSpan(id) {
    if (spanCache.has(id)) return spanCache.get(id);
    const ownWidth = widthFor(nodeById.get(id));
    const kids = childIds(id);
    if (kids.length === 0 || active.has(id)) {
      spanCache.set(id, ownWidth);
      return ownWidth;
    }
    active.add(id);
    const kidsSpan = kids.reduce((sum, kid) => sum + subtreeSpan(kid) + SIBLING_GAP, -SIBLING_GAP);
    const span = Math.max(ownWidth, kidsSpan);
    active.delete(id);
    spanCache.set(id, span);
    return span;
  }

  function place(id, left, fallbackDepth) {
    if (positions.has(id)) return;
    const span = subtreeSpan(id);
    positions.set(id, {
      x: left + span / 2,
      y: TOP_PADDING + (depth.get(id) ?? fallbackDepth) * LEVEL_GAP,
      width: widthFor(nodeById.get(id)),
      height: NODE_HEIGHT,
    });
    const kids = childIds(id);
    if (kids.length === 0) return;
    const kidsSpan = kids.reduce(
      (sum, kid) => sum + subtreeSpan(kid) + SIBLING_GAP,
      -SIBLING_GAP,
    );
    let cursor = left + (span - kidsSpan) / 2;
    for (const kid of kids) {
      place(kid, cursor, (depth.get(id) ?? fallbackDepth) + 1);
      cursor += subtreeSpan(kid) + SIBLING_GAP;
    }
  }

  // Place the main tree first, then any orphan components.
  let cursor = 0;
  const roots = [];
  if (nodeById.has(state.root)) roots.push(state.root);
  for (const node of nodes) {
    if (node.id !== state.root && incoming.get(node.id) === 0) roots.push(node.id);
  }
  for (const node of nodes) {
    if (!roots.includes(node.id)) roots.push(node.id);
  }
  for (const root of roots) {
    if (positions.has(root)) continue;
    place(root, cursor, 0);
    cursor += subtreeSpan(root) + SIBLING_GAP;
  }

  const totalWidth = cursor > 0 ? cursor - SIBLING_GAP : 0;
  const offset = Math.max(30, (width - totalWidth) / 2);
  for (const position of positions.values()) position.x += offset;

  // B+ trees keep their linked leaves on one horizontal row.
  const chain = new Set();
  for (const node of nodes) {
    if (node.next === undefined || node.next === null || !nodeById.has(node.next)) continue;
    chain.add(node.id);
    chain.add(node.next);
  }
  if (chain.size > 0) {
    let row = -Infinity;
    for (const id of chain) {
      const position = positions.get(id);
      if (position) {
        row = Math.max(row, position.y);
      } else {
        positions.set(id, {
          x: offset + widthFor(nodeById.get(id)) / 2,
          y: TOP_PADDING,
          width: widthFor(nodeById.get(id)),
          height: NODE_HEIGHT,
        });
        row = Math.max(row, TOP_PADDING);
      }
    }
    if (Number.isFinite(row)) {
      for (const id of chain) {
        const position = positions.get(id);
        if (position) position.y = row;
      }
    }
  }

  return positions;
}
