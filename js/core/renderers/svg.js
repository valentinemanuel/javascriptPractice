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
  hash: 'is-probe',
  rotate: 'is-rotate',
  split: 'is-rotate',
  merge: 'is-rotate',
  enqueue: 'is-focus',
  dequeue: 'is-focus',
  relax: 'is-focus',
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
  group.append(element('line', {
    x1: from.x,
    y1: from.y,
    x2: to.x,
    y2: to.y,
    class: `edge${focus.has(edge.from) || focus.has(edge.to) ? ' is-focus' : ''}`,
    'marker-end': edge.directed || edge.side ? 'url(#arrowhead)' : undefined,
  }));

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
      y: position.y + height / 2 + 18,
      class: 'distance-label',
    }, `d=${node.dist}`));
  }

  return group;
}

function drawPointerLabels(scene, state, positions) {
  const marks = [];
  if (state.top !== null && state.top !== undefined) {
    marks.push([state.top, state.topLabel ?? 'TOP', 'is-front']);
  }
  if (state.head !== null && state.head !== undefined
    && state.tail !== null && state.tail !== undefined) {
    const headText = state.headLabel ?? 'HEAD';
    const tailText = state.tailLabel ?? 'TAIL';
    if (state.head === state.tail) {
      marks.push([state.head, `${headText} / ${tailText}`, 'is-front']);
    } else {
      marks.push([state.head, headText, 'is-front']);
      marks.push([state.tail, tailText, 'is-back']);
    }
  }

  for (const [id, text, className] of marks) {
    const position = positions.get(id);
    if (!position) continue;
    scene.append(element('text', {
      x: position.x,
      y: position.y - (position.radius ?? 30) - 16,
      class: `pointer-label ${className}`,
    }, text));
  }
}

function drawHash(scene, state, positions, step, focus, focusClass) {
  const buckets = state.buckets ?? [];
  if (buckets.length === 0) return;

  const placed = buckets.map((bucket) => positions.get(bucket.id)).filter(Boolean);
  if (placed.length === 0) return;
  const minX = Math.min(...placed.map((p) => p.x));
  const maxX = Math.max(...placed.map((p) => p.x));
  const chaining = state.strategy === 'chaining';

  scene.append(element('text', { x: minX - 40, y: 24, class: 'hash-hash-badge' },
    `${chaining ? 'Separate chaining' : 'Open addressing'} · hash: ${state.hash}`));

  const payload = step.payload ?? {};
  const firstProbe = Array.isArray(payload.probe) ? payload.probe[0] : undefined;
  const homeIndex = step.type === 'hash'
    ? payload.index
    : firstProbe !== undefined
      ? Number(String(firstProbe).replace('bucket-', ''))
      : undefined;
  if (payload.key !== undefined && Number.isFinite(homeIndex)) {
    let detail = `h(${payload.key}) = ${homeIndex}`;
    if (step.type === 'hash' && state.hash === 'universal') {
      detail += `   a=${payload.a}  b=${payload.b}  p=${payload.p}`;
    } else if (step.type === 'hash' && state.hash === 'multiplication') {
      detail += `   A≈${Number(payload.a).toFixed(3)}`;
    }
    scene.append(element('text', { x: minX - 40, y: 46, class: 'hash-hash-sub' }, detail));
  }
  if (step.type === 'rehash' && payload.from !== undefined) {
    scene.append(element('text', { x: maxX + 46, y: 24, class: 'hash-hash-badge' },
      `Rehash ${payload.from} → ${payload.to}`));
  }

  for (const bucket of buckets) {
    const position = positions.get(bucket.id);
    if (!position) continue;
    const className = focus.has(bucket.id) ? ` ${focusClass}` : '';
    const group = element('g', { class: `hash-slot${className}`, 'data-id': bucket.id });

    group.append(element('rect', {
      x: position.x - position.width / 2,
      y: position.y - position.height / 2,
      width: position.width,
      height: position.height,
      rx: '7',
    }));
    group.append(element('text', {
      x: position.x,
      y: position.y - position.height / 2 - 9,
      class: 'hash-index',
    }, `[${bucket.id.replace('bucket-', '')}]`));

    if (!chaining) {
      const item = bucket.items?.[0];
      group.append(element('text', {
        x: position.x,
        y: position.y + 6,
        class: `hash-value${item?.tombstone ? ' is-tombstone' : ''}`,
      }, item ? (item.tombstone ? '×' : String(item.value)) : '—'));
    } else if ((bucket.items?.length ?? 0) === 0) {
      group.append(element('text', { x: position.x, y: position.y + 5, class: 'hash-index' }, 'empty'));
    }
    scene.append(group);

    const items = bucket.items ?? [];
    if (chaining && items.length > 0) {
      let previous = { x: position.x + position.width / 2, y: position.y };
      items.forEach((item) => {
        const itemPosition = positions.get(item.id);
        if (!itemPosition) return;
        scene.append(element('line', {
          x1: previous.x,
          y1: previous.y,
          x2: itemPosition.x - 20,
          y2: itemPosition.y,
          class: 'hash-chain-line',
          'marker-end': 'url(#arrowhead)',
        }));
        scene.append(drawNode(item, itemPosition, focus.has(item.id) ? focusClass : ''));
        previous = { x: itemPosition.x + 20, y: itemPosition.y };
      });
    }
  }

  const probe = payload.probe ?? [];
  const badges = probe.map((id) => positions.get(id)).filter(Boolean);
  badges.forEach((position, index) => {
    if (index > 0) {
      scene.append(element('line', {
        x1: badges[index - 1].x + 46,
        y1: badges[index - 1].y - 34,
        x2: position.x + 46,
        y2: position.y - 34,
        class: 'hash-probe-line',
      }));
    }
    scene.append(element('circle', {
      cx: position.x + 46,
      cy: position.y - 34,
      r: 11,
      class: 'hash-probe-badge-circle',
    }));
    scene.append(element('text', {
      x: position.x + 46,
      y: position.y - 30,
      class: 'hash-probe-badge',
    }, index + 1));
  });
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

  if (Array.isArray(state.buckets)) {
    drawHash(scene, state, positions, step, focus, focusClass);
    return;
  }

  for (const edge of state.edges ?? []) {
    const drawn = drawEdge(edge, positions, focus);
    if (drawn) scene.append(drawn);
  }

  for (const node of nodeList(state)) {
    const position = positions.get(node.id);
    if (!position) continue;
    scene.append(drawNode(node, position, focus.has(node.id) ? focusClass : ''));
    if (position.index !== undefined) {
      scene.append(element('text', {
        x: position.x,
        y: position.y + 46,
        class: 'index-label',
      }, `[${position.index}]`));
    }
  }

  drawPointerLabels(scene, state, positions);
}
