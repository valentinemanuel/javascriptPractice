/**
 * Deterministic force-directed layout for graphs.
 *
 * Nodes start on a circle, then 200 fixed Fruchterman-Reingold iterations
 * spread connected neighbours apart evenly. A fixed-seed pseudo-random seam
 * only breaks perfect ties (coincident nodes), so repeated calls with the same
 * state always produce identical positions. Nodes listed in state.pinned are
 * treated as fixed anchors for manual dragging and stay at their given
 * coordinates. Everything is clamped inside the padded viewport.
 */

const ITERATIONS = 200;
const PADDING = 44;
const SEED = 0x1a2b3c4d;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Linear congruential generator: small, deterministic and dependency-free.
function randomUnit(seam) {
  seam.value = (Math.imul(seam.value, 1664525) + 1013904223) >>> 0;
  return seam.value / 4294967296;
}

function direction(dx, dy, seam) {
  const length = Math.hypot(dx, dy);
  if (length > 1e-6) return { x: dx / length, y: dy / length, distance: length };
  const angle = randomUnit(seam) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle), distance: 1e-6 };
}

export function compute(state = {}, viewport = {}) {
  const width = viewport.width ?? 900;
  const height = viewport.height ?? 560;
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const positions = new Map();
  if (nodes.length === 0) return positions;

  const minX = PADDING;
  const minY = PADDING;
  const maxX = Math.max(minX, width - PADDING);
  const maxY = Math.max(minY, height - PADDING);

  const ids = nodes.map((node) => node.id);
  const count = ids.length;
  const indexById = new Map(ids.map((id, index) => [id, index]));
  const x = new Float64Array(count);
  const y = new Float64Array(count);
  const fixed = new Set();

  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const radius = Math.max(40, Math.min(maxX - minX, maxY - minY) * 0.32);

  for (let index = 0; index < count; index += 1) {
    const angle = count === 1 ? -Math.PI / 2 : -Math.PI / 2 + (Math.PI * 2 * index) / count;
    x[index] = clamp(centreX + Math.cos(angle) * radius, minX, maxX);
    y[index] = clamp(centreY + Math.sin(angle) * radius, minY, maxY);
  }

  // Manual-drag override map: plain object or Map, both id -> { x, y }.
  const pinned = state.pinned;
  for (let index = 0; index < count; index += 1) {
    const value = pinned instanceof Map
      ? pinned.get(ids[index])
      : pinned && typeof pinned === 'object'
        ? pinned[ids[index]]
        : undefined;
    if (!value) continue;
    const pinX = Number(value.x);
    const pinY = Number(value.y);
    if (!Number.isFinite(pinX) || !Number.isFinite(pinY)) continue;
    x[index] = clamp(pinX, minX, maxX);
    y[index] = clamp(pinY, minY, maxY);
    fixed.add(index);
  }

  const edges = (Array.isArray(state.edges) ? state.edges : [])
    .filter((edge) => edge && indexById.has(edge.from) && indexById.has(edge.to) && edge.from !== edge.to)
    .map((edge) => ({
      from: indexById.get(edge.from),
      to: indexById.get(edge.to),
      strength: Number.isFinite(edge.weight) && edge.weight > 0
        ? Math.min(5, edge.weight)
        : 1,
    }));

  const idealLength = clamp(Math.sqrt(((maxX - minX) * (maxY - minY)) / count) / 2, 50, 140);
  const idealSquared = idealLength * idealLength;
  let temperature = Math.max(20, Math.min(maxX - minX, maxY - minY) / 12);
  const seam = { value: SEED };
  const displacementX = new Float64Array(count);
  const displacementY = new Float64Array(count);

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    displacementX.fill(0);
    displacementY.fill(0);

    // Repulsion between every pair of nodes.
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        const unit = direction(x[i] - x[j], y[i] - y[j], seam);
        const force = idealSquared / unit.distance;
        const pushX = unit.x * force;
        const pushY = unit.y * force;
        displacementX[i] += pushX;
        displacementY[i] += pushY;
        displacementX[j] -= pushX;
        displacementY[j] -= pushY;
      }
    }

    // Attraction along edges; larger weights pull neighbours closer.
    for (const edge of edges) {
      const unit = direction(x[edge.to] - x[edge.from], y[edge.to] - y[edge.from], seam);
      const force = ((unit.distance * unit.distance) / idealLength) * edge.strength;
      const pullX = unit.x * force;
      const pullY = unit.y * force;
      displacementX[edge.from] += pullX;
      displacementY[edge.from] += pullY;
      displacementX[edge.to] -= pullX;
      displacementY[edge.to] -= pullY;
    }

    const cooling = temperature * (1 - iteration / ITERATIONS);
    for (let i = 0; i < count; i += 1) {
      if (fixed.has(i)) continue;
      const magnitude = Math.hypot(displacementX[i], displacementY[i]);
      if (magnitude < 1e-9) continue;
      const step = Math.min(magnitude, cooling);
      x[i] = clamp(x[i] + (displacementX[i] / magnitude) * step, minX, maxX);
      y[i] = clamp(y[i] + (displacementY[i] / magnitude) * step, minY, maxY);
    }
  }

  ids.forEach((id, index) => {
    positions.set(id, { x: x[index], y: y[index] });
  });
  return positions;
}
