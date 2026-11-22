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
  visit: 'is-visiting',
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

function radialGradient(id, firstClass, secondClass) {
  const gradient = element('radialGradient', { id, cx: '35%', cy: '30%', r: '75%' });
  gradient.append(
    element('stop', { offset: '0%', class: firstClass }),
    element('stop', { offset: '100%', class: secondClass }),
  );
  return gradient;
}

function arrowMarker(id) {
  const marker = element('marker', {
    id,
    viewBox: '0 0 10 10',
    refX: '9',
    refY: '5',
    markerWidth: '6',
    markerHeight: '6',
    markerUnits: 'userSpaceOnUse',
    orient: 'auto-start-reverse',
  });
  marker.append(element('path', {
    d: 'M 1.5 1 Q 8 5 1.5 9',
    class: 'arrow-path',
    fill: 'none',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));
  return marker;
}

function ensureDefs(svg) {
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = element('defs');
    svg.prepend(defs);
  }
  if (defs.querySelector('#node-grad-default')) return defs;

  defs.append(
    radialGradient('node-grad-default', 'grad-default-1', 'grad-default-2'),
    radialGradient('node-grad-active', 'grad-active-1', 'grad-active-2'),
    radialGradient('node-grad-found', 'grad-found-1', 'grad-found-2'),
  );

  const filter = element('filter', {
    id: 'glow',
    x: '-60%',
    y: '-60%',
    width: '220%',
    height: '220%',
  });
  filter.append(element('feGaussianBlur', {
    in: 'SourceGraphic',
    stdDeviation: '4',
    result: 'blur',
  }));
  const merge = element('feMerge');
  merge.append(
    element('feMergeNode', { in: 'blur' }),
    element('feMergeNode', { in: 'SourceGraphic' }),
  );
  filter.append(merge);
  defs.append(filter);

  defs.append(arrowMarker('arrowhead'), arrowMarker('arrowhead-active'));
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

function drawEdgeBadge(group, x, y, value) {
  const text = String(value);
  const width = Math.max(24, text.length * 9 + 14);
  const badge = element('g', { class: 'edge-label' });
  badge.append(element('rect', {
    x: x - width / 2,
    y: y - 11,
    width,
    height: 22,
    rx: '6',
  }));
  badge.append(element('text', { x, y: y + 4, class: 'edge-label-text' }, text));
  group.append(badge);
}

function drawEdge(edge, positions, focus, treeEdge = false) {
  const from = positions.get(edge.from);
  const to = positions.get(edge.to);
  if (!from || !to) return null;

  const highlighted = focus.has(edge.from) || focus.has(edge.to);
  const marker = highlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)';
  const group = element('g', { class: 'edge-group' });

  if (treeEdge) {
    const midY = (from.y + to.y) / 2;
    group.append(element('path', {
      d: `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`,
      class: `edge edge-tree${highlighted ? ' is-focus' : ''}`,
      'marker-end': edge.directed || edge.side ? marker : undefined,
    }));
  } else {
    group.append(element('line', {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      class: `edge${highlighted ? ' is-focus' : ''}`,
      'marker-end': edge.directed ? marker : undefined,
    }));
  }

  const badgeText = edge.label ?? edge.weight;
  if (badgeText !== undefined) {
    drawEdgeBadge(group, (from.x + to.x) / 2, (from.y + to.y) / 2, badgeText);
  }
  return group;
}

function drawNode(node, position, focusClass, isPointer = false) {
  const classes = ['node'];
  if (focusClass) classes.push(focusClass);
  if (node.terminal) classes.push('is-terminal');
  if (isPointer) classes.push('is-pointer');
  if (node.tombstone) classes.push('is-tombstone');

  const group = element('g', {
    class: classes.join(' '),
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
    const radius = position.radius ?? 23;
    group.append(element('circle', {
      cx: position.x,
      cy: position.y,
      r: radius + 5,
      class: 'terminal-ring',
    }));
    group.append(element('circle', {
      cx: position.x,
      cy: position.y,
      r: radius + 9,
      class: 'terminal-ring terminal-ring-outer',
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

function hashCellText(bucket, chaining) {
  const items = bucket.items ?? [];
  if (items.length === 0) return '—';
  if (!chaining) {
    return items[0].tombstone ? '×' : String(items[0].value);
  }
  const values = items.slice(0, 3).map((item) => (item.tombstone ? '×' : String(item.value)));
  return items.length > 3 ? `${values.join(' · ')}…` : values.join(' · ');
}

function drawHash(scene, state, positions, step, focus, focusClass) {
  const table = positions.get('__table');
  const hashBox = positions.get('__hash');
  const buckets = state.buckets ?? [];
  if (!table || !hashBox || buckets.length === 0) return;

  const chaining = state.strategy === 'chaining';
  const payload = step.payload ?? {};
  const keys = buckets.flatMap((bucket) => bucket.items ?? []);
  const indexWidth = table.indexWidth;
  const valueX = table.x + indexWidth;
  const valueWidth = table.width - indexWidth;

  // Keys flow into the hash function.
  for (const key of keys) {
    const position = positions.get(key.id);
    if (!position) continue;
    scene.append(element('line', {
      x1: position.x + position.width / 2,
      y1: position.y,
      x2: hashBox.x - hashBox.width / 2,
      y2: hashBox.y,
      class: 'hash-key-arrow',
      'marker-end': 'url(#arrowhead)',
    }));
  }

  // The hash function points at the home slot and at every probe attempt.
  const probes = Array.isArray(payload.probe) ? payload.probe.slice(0, 8) : [];
  const targets = probes.length > 0
    ? probes
    : Number.isInteger(payload.index) ? [`bucket-${payload.index}`] : [];
  targets.forEach((id, index) => {
    const position = positions.get(id);
    if (!position) return;
    scene.append(element('line', {
      x1: hashBox.x + hashBox.width / 2,
      y1: hashBox.y,
      x2: table.x,
      y2: position.y,
      class: probes.length > 1 ? 'hash-probe-arrow' : 'hash-hash-arrow',
      'marker-end': probes.length > 1 ? 'url(#arrowhead-active)' : 'url(#arrowhead)',
    }));
    if (probes.length > 1) {
      scene.append(element('circle', {
        cx: table.x - 16,
        cy: position.y,
        r: 10,
        class: 'hash-probe-badge-circle',
      }));
      scene.append(element('text', {
        x: table.x - 16,
        y: position.y + 4,
        class: 'hash-probe-badge',
      }, index + 1));
    }
  });

  // Key boxes.
  if (keys.length === 0) {
    scene.append(element('text', {
      x: positions.get('__keys')?.x ?? 116,
      y: table.y + 20,
      class: 'hash-empty-hint',
    }, 'No keys yet — insert one to see its path.'));
  }
  for (const key of keys) {
    const position = positions.get(key.id);
    if (!position) continue;
    const group = element('g', {
      class: `hash-key${focus.has(key.id) ? ` ${focusClass}` : ''}`,
      'data-id': key.id,
    });
    group.append(element('rect', {
      x: position.x - position.width / 2,
      y: position.y - position.height / 2,
      width: position.width,
      height: position.height,
      rx: '8',
    }));
    group.append(element('text', {
      x: position.x,
      y: position.y + 5,
      class: 'hash-key-text',
    }, key.tombstone ? '×' : String(key.value)));
    scene.append(group);
  }
  scene.append(element('text', {
    x: positions.get('__keys')?.x ?? 116,
    y: table.y - 24,
    class: 'hash-column-title',
  }, 'KEYS'));

  // Hash function box.
  const functionGroup = element('g', { class: 'hash-function-box' });
  functionGroup.append(element('rect', {
    x: hashBox.x - hashBox.width / 2,
    y: hashBox.y - hashBox.height / 2,
    width: hashBox.width,
    height: hashBox.height,
    rx: '12',
  }));
  functionGroup.append(element('text', {
    x: hashBox.x,
    y: hashBox.y - 12,
    class: 'hash-function-title',
  }, 'Hash Function'));
  functionGroup.append(element('text', {
    x: hashBox.x,
    y: hashBox.y + 9,
    class: 'hash-function-meta',
  }, `${state.hash} · ${chaining ? 'chaining' : state.strategy}`));
  const firstProbe = Array.isArray(payload.probe) ? payload.probe[0] : undefined;
  const homeIndex = step.type === 'hash'
    ? payload.index
    : firstProbe !== undefined
      ? Number(String(firstProbe).replace('bucket-', ''))
      : undefined;
  if (payload.key !== undefined && Number.isFinite(homeIndex)) {
    functionGroup.append(element('text', {
      x: hashBox.x,
      y: hashBox.y + 28,
      class: 'hash-function-result',
    }, `h(${payload.key}) = ${homeIndex}`));
  }
  scene.append(functionGroup);

  // Table header.
  const headerY = table.y - 24;
  const header = element('g', { class: 'hash-table-header' });
  header.append(element('rect', { x: table.x, y: headerY - 14, width: indexWidth, height: 24, rx: '6' }));
  header.append(element('rect', { x: valueX, y: headerY - 14, width: valueWidth, height: 24, rx: '6' }));
  header.append(element('text', { x: table.x + indexWidth / 2, y: headerY + 2, class: 'hash-header-text' }, 'Index'));
  header.append(element('text', { x: valueX + valueWidth / 2, y: headerY + 2, class: 'hash-header-text' }, 'Value'));
  scene.append(header);

  // Index / Value rows.
  buckets.forEach((bucket) => {
    const position = positions.get(bucket.id);
    if (!position) return;
    const items = bucket.items ?? [];
    const live = items.filter((item) => !item.tombstone).length;
    const slotState = live > 0 ? 'is-occupied'
      : items.length > 0 ? 'is-tombstone' : 'is-empty';
    const className = focus.has(bucket.id) ? ` ${focusClass}` : '';
    const row = element('g', {
      class: `hash-row ${slotState}${className}`,
      'data-id': bucket.id,
    });
    const top = position.y - position.height / 2;
    row.append(element('rect', { x: table.x, y: top, width: indexWidth, height: position.height }));
    row.append(element('rect', { x: valueX, y: top, width: valueWidth, height: position.height }));
    row.append(element('text', {
      x: table.x + indexWidth / 2,
      y: position.y + 4,
      class: 'hash-row-index',
    }, String(position.index)));
    row.append(element('text', {
      x: valueX + valueWidth / 2,
      y: position.y + 4,
      class: 'hash-row-value',
    }, hashCellText(bucket, chaining)));
    scene.append(row);
  });

  if (step.type === 'rehash' && payload.from !== undefined) {
    scene.append(element('text', {
      x: table.x + table.width,
      y: table.y - 24,
      class: 'hash-hash-badge',
    }, `Rehash ${payload.from} → ${payload.to}`));
  }
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

  const treeEdges = Object.prototype.hasOwnProperty.call(state, 'root');
  const pointerIds = new Set(
    [state.top, state.head, state.tail].filter((id) => id !== null && id !== undefined),
  );

  for (const edge of state.edges ?? []) {
    const drawn = drawEdge(edge, positions, focus, treeEdges);
    if (drawn) scene.append(drawn);
  }

  for (const node of nodeList(state)) {
    const position = positions.get(node.id);
    if (!position) continue;
    const className = focus.has(node.id) ? focusClass : '';
    scene.append(drawNode(node, position, className, pointerIds.has(node.id)));
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
