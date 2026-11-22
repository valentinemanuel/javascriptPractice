/**
 * Hierarchical layout for binary trees, n-ary trees and tries.
 *
 * Binary trees (edges carrying side 'left' / 'right') get x coordinates from
 * an in-order walk, which keeps left subtree < node < right subtree.
 * N-ary trees and tries get a leaf-count based spread: every leaf owns one
 * horizontal slot and each parent is centred over its descendant leaves.
 * Depth always comes from a breadth-first walk away from the root, so y is
 * top padding + depth * levelGap.
 */

const TOP_PADDING = 80;
const LEVEL_GAP = 96;
const MIN_GAP = 58;
const MAX_GAP = 88;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function compute(state = {}, viewport = {}) {
  const width = viewport.width ?? 900;
  const nodes = asArray(state.nodes);
  if (nodes.length === 0) return new Map();

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = asArray(state.edges);
  const children = new Map(nodes.map((node) => [node.id, []]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (!edge || !nodeById.has(edge.from) || !nodeById.has(edge.to)) continue;
    children.get(edge.from).push(edge);
    incoming.set(edge.to, incoming.get(edge.to) + 1);
  }

  const maxChildren = Math.max(0, ...[...children.values()].map((list) => list.length));
  const binary =
    edges.some((edge) => edge && (edge.side === 'left' || edge.side === 'right')) ||
    maxChildren <= 2;

  // Depth from the root. Orphan components are rooted at their first node
  // with no incoming edge; leftovers (cycles) are rooted wherever needed.
  const depth = new Map();
  function assignDepths(startId) {
    if (!nodeById.has(startId) || depth.has(startId)) return;
    depth.set(startId, 0);
    const queue = [startId];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const id = queue[cursor];
      for (const edge of children.get(id) ?? []) {
        if (depth.has(edge.to)) continue;
        depth.set(edge.to, depth.get(id) + 1);
        queue.push(edge.to);
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

  function orderedChildren(id) {
    const ownEdges = children.get(id) ?? [];
    const left = ownEdges.find((edge) => edge.side === 'left');
    const right = ownEdges.find((edge) => edge.side === 'right');
    if (left || right) {
      return [left, right]
        .filter(Boolean)
        .map((edge) => edge.to)
        .filter((childId) => nodeById.has(childId));
    }
    return ownEdges
      .map((edge, order) => ({ to: edge.to, order: edge.index ?? order }))
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.to)
      .filter((childId) => nodeById.has(childId));
  }

  let slotCount = 0;
  if (binary) {
    // In-order walk: left subtree, node, right subtree.
    const visited = new Set();
    const slot = new Map();
    function walk(id) {
      if (!nodeById.has(id) || visited.has(id)) return;
      visited.add(id);
      const [left, right] = orderedChildren(id);
      if (left) walk(left);
      slot.set(id, slotCount);
      slotCount += 1;
      if (right) walk(right);
    }
    walk(state.root);
    for (const node of nodes) {
      if (!visited.has(node.id)) walk(node.id);
    }

    const gap = slotCount > 1
      ? Math.max(MIN_GAP, Math.min(MAX_GAP, (width - 120) / (slotCount - 1)))
      : 0;
    const start = width / 2 - ((slotCount - 1) * gap) / 2;
    const positions = new Map();
    for (const node of nodes) {
      positions.set(node.id, {
        x: start + (slot.get(node.id) ?? 0) * gap,
        y: TOP_PADDING + (depth.get(node.id) ?? 0) * LEVEL_GAP,
      });
    }
    return positions;
  }

  // Leaf-count spread for n-ary trees and tries.
  const slot = new Map();
  function spread(id, start, active) {
    if (active.has(id)) return start + 1;
    active.add(id);
    const kids = orderedChildren(id);
    if (kids.length === 0) {
      slot.set(id, start);
      active.delete(id);
      return start + 1;
    }
    let cursor = start;
    const centres = [];
    for (const kid of kids) {
      const first = cursor;
      cursor = spread(kid, cursor, active);
      centres.push((first + cursor - 1) / 2);
    }
    slot.set(id, (centres[0] + centres[centres.length - 1]) / 2);
    active.delete(id);
    return cursor;
  }

  if (nodeById.has(state.root)) slotCount = spread(state.root, 0, new Set());
  for (const node of nodes) {
    if (slot.has(node.id)) continue;
    slotCount = spread(node.id, slotCount, new Set());
  }

  const gap = slotCount > 1
    ? Math.max(MIN_GAP, Math.min(MAX_GAP, (width - 120) / (slotCount - 1)))
    : 0;
  const start = width / 2 - ((slotCount - 1) * gap) / 2;
  const positions = new Map();
  for (const node of nodes) {
    positions.set(node.id, {
      x: start + (slot.get(node.id) ?? 0) * gap,
      y: TOP_PADDING + (depth.get(node.id) ?? 0) * LEVEL_GAP,
    });
  }
  return positions;
}
