/**
 * Generic SVG renderer. It consumes a state, a position map and one step.
 * It contains no data structure logic.
 */
const NS = 'http://www.w3.org/2000/svg';

const HIGHLIGHT_CLASS = {
  push: 'is-focus',
  pop: 'is-focus',
  insert: 'is-focus',
  delete: 'is-focus',
  remove: 'is-focus',
  access: 'is-focus',
  visit: 'is-visit',
  compare: 'is-compare',
  found: 'is-found',
  miss: 'is-miss',
  collision: 'is-collision',
  probe: 'is-probe',
  rotate: 'is-rotate',
  split: 'is-rotate',
  merge: 'is-rotate',
  enqueue: 'is-focus',
  dequeue: 'is-focus',
};

function element(name, attributes = {}, text) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function ensureDefs(svg) {
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = element('defs');
    svg.prepend(defs);
  }
  if (!defs.querySelector('#arrowhead')) {
    const marker = element('marker', {
      id: 'arrowhead',
      viewBox: '0 0 10 10',
      refX: '9',
      refY: '5',
      markerWidth: '7',
      markerHeight: '7',
      orient: 'auto-start-reverse',
    });
    marker.append(element('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'arrow-path' }));
    defs.append(marker);
  }
  return defs;
}

function nodeList(state) {
  if (Array.isArray(state.nodes)) return state.nodes;
  if (Array.isArray(state.items)) return state.items;
  return [];
}

function labelFor(node) {
  if (node.tombstone) return '×';
  if (Array.isArray(node.keys)) return node.keys.join(' | ');
  if (node.value !== undefined) return String(node.value);
  return node.id;
}

function drawEdge(edge, positions, focus) {
  const from = positions.get(edge.from);
  const to = positions.get(edge.to);
  if (!from || !to) return null;

  const group = element('g', { class: 'edge-group' });
  const line = element('line', {
    x1: from.x,
    y1: from.y,
    x2: to.x,
    y2: to.y,
    class: `edge${focus.has(edge.from) || focus.has(edge.to) ? ' is-focus' : ''}`,
    'marker-end': edge.directed || edge.side ? 'url(#arrowhead)' : undefined,
  });
  group.append(line);

  if (edge.label !== undefined) {
    group.append(element('text', {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - 8,
      class: 'edge-label',
    }, edge.label));
  }
  if (edge.weight !== undefined) {
    group.append(element('text', {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 + 16,
      class: 'edge-weight',
    }, edge.weight));
  }
  return group;
}

function drawNode(node, position, focusClass) {
  const group = element('g', {
    class: `node${focusClass ? ` ${focusClass}` : ''}${node.tombstone ? ' is-tombstone' : ''}`,
    'data-id': node.id,
    'aria-label': `${node.tombstone ? 'deleted slot' : labelFor(node)}${node.dist !== undefined ? `, distance ${node.dist}` : ''}`,
    tabindex: '0',
  });
  const width = position.width ?? (Array.isArray(node.keys) ? Math.max(78, node.keys.length * 40 + 14) : 46);
  const height = position.height ?? 46;

  if (Array.isArray(node.keys)) {
    group.append(element('rect', {
      x: position.x - width / 2,
      y: position.y - height / 2,
      width,
      height,
      rx: '6',
    }));
    const cellWidth = width / Math.max(1, node.keys.length);
    node.keys.forEach((key, index) => {
      if (index > 0) {
        group.append(element('line', {
          x1: position.x - width / 2 + index * cellWidth,
          y1: position.y - height / 2,
          x2: position.x - width / 2 + index * cellWidth,
          y2: position.y + height / 2,
          class: 'key-divider',
        }));
      }
      group.append(element('text', {
        x: position.x - width / 2 + (index + 0.5) * cellWidth,
        y: position.y + 6,
        class: 'node-label',
      }, key));
    });
  } else {
    group.append(element('circle', { cx: position.x, cy: position.y, r: position.radius ?? 23 }));
    group.append(element('text', {
      x: position.x,
      y: position.y + 6,
      class: 'node-label',
    }, labelFor(node)));
  }

  if (node.terminal) {
    group.append(element('circle', {
      cx: position.x,
      cy: position.y,
      r: (position.radius ?? 23) + 6,
      class: 'terminal-ring',
    }));
  }

  if (node.dist !== undefined) {
    group.append(element('text', {
      x: position.x,
      y: position.y + (position.height ?? 46) / 2 + 18,
      class: 'distance-label',
    }, `d=${node.dist}`));
  }

  return group;
}

function drawIndex(position) {
  if (position.index === undefined) return null;
  return element('text', {
    x: position.x,
    y: position.y + 46,
    class: 'index-label',
  }, `[${position.index}]`);
}

export function render(svg, state, positions = new Map(), step = {}) {
  if (!svg || !state) return;
  ensureDefs(svg);

  let scene = svg.querySelector('#scene');
  if (!scene) {
    scene = element('g', { id: 'scene' });
    svg.append(scene);
  }

  const transform = scene.getAttribute('transform');
  scene.replaceChildren();
  if (transform) scene.setAttribute('transform', transform);

  const focus = new Set([
    ...(step.focus ?? []),
    ...(step.payload?.path ?? []),
    ...(step.payload?.probe ?? []),
  ]);
  const focusClass = HIGHLIGHT_CLASS[step.type] ?? 'is-focus';

  for (const edge of state.edges ?? []) {
    const drawn = drawEdge(edge, positions, focus);
    if (drawn) scene.append(drawn);
  }

  const bucketClass = HIGHLIGHT_CLASS[step.type] ?? 'is-focus';
  for (const bucket of state.buckets ?? []) {
    const position = positions.get(bucket.id);
    if (!position) continue;
    const group = element('g', { class: `bucket${focus.has(bucket.id) ? ` ${bucketClass}` : ''}`, 'data-id': bucket.id });
    group.append(element('rect', {
      x: position.x - 34,
      y: position.y - 26,
      width: 68,
      height: 52,
      rx: '6',
    }));
    group.append(element('text', { x: position.x, y: position.y + 6, class: 'node-label' }, bucket.id.replace('bucket-', '')));
    scene.append(group);
  }

  for (const node of nodeList(state)) {
    const position = positions.get(node.id);
    if (!position) continue;
    scene.append(drawNode(node, position, focus.has(node.id) ? focusClass : ''));
    const index = drawIndex(position);
    if (index) scene.append(index);
  }

  for (const item of state.buckets?.flatMap((bucket) => bucket.items ?? []) ?? []) {
    const position = positions.get(item.id);
    if (!position) continue;
    scene.append(drawNode(item, position, focus.has(item.id) ? focusClass : ''));
  }
}
