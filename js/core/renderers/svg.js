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

const STACK_BLOCK = { width: 96, height: 50, radius: 8 };
const QUEUE_BLOCK = { height: 50, radius: 8, inset: 8 };

function drawQueueLane(scene, positions) {
  const slots = [...positions.values()].filter((position) => position.index !== undefined);
  if (slots.length === 0) return;

  const first = slots[0];
  const last = slots.at(-1);
  const left = first.x - (first.width ?? 78) / 2 - 16;
  const right = last.x + (last.width ?? 78) / 2 + 16;
  const top = first.y - QUEUE_BLOCK.height / 2 - 9;
  const bottom = first.y + QUEUE_BLOCK.height / 2 + 9;

  for (const y of [top, bottom]) {
    scene.append(element('line', {
      x1: left,
      y1: y,
      x2: right,
      y2: y,
      class: 'queue-guide',
    }));
  }
}

function drawArrayFreeCells(scene, positions) {
  for (const position of positions.values()) {
    if (!position.free) continue;
    scene.append(element('rect', {
      x: position.x - position.width / 2,
      y: position.y - position.height / 2,
      width: position.width,
      height: position.height,
      rx: '2',
      class: 'array-free-cell',
    }));
    scene.append(element('text', {
      x: position.x,
      y: position.y + 52,
      class: 'array-free-index',
    }, `[${position.index}]`));
  }
}

function drawLeafLinks(scene, state, positions, focus, focusClass) {
  for (const node of state.nodes ?? []) {
    if (node.next === undefined || node.next === null) continue;
    const from = positions.get(node.id);
    const to = positions.get(node.next);
    if (!from || !to) continue;

    const x1 = from.x + (from.width ?? 80) / 2 + 4;
    const x2 = to.x - (to.width ?? 80) / 2 - 5;
    if (x2 <= x1) continue;

    const highlighted = focus.has(node.id) || focus.has(node.next);
    scene.append(element('line', {
      x1,
      y1: from.y,
      x2,
      y2: to.y,
      class: `leaf-link${highlighted ? ` ${focusClass}` : ''}`,
      'marker-end': highlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)',
    }));
  }
}

function childAnchor(node, position, childIndex, childCount) {
  const keys = node.keys ?? [];
  if (keys.length === 0 || childCount < 2) return position.x;

  const width = position.width ?? Math.max(88, keys.length * 44 + 16);
  const left = position.x - width / 2;
  const cellWidth = width / keys.length;
  const inset = Math.min(10, cellWidth * 0.25);

  if (childCount !== keys.length + 1) {
    return left + inset + (childIndex / (childCount - 1)) * (width - inset * 2);
  }
  if (childIndex <= 0) return left + inset;
  if (childIndex >= childCount - 1) return left + width - inset;
  return left + childIndex * cellWidth;
}

function drawStackGuide(scene, positions) {
  const slots = [...positions.values()].filter((position) => position.index !== undefined);
  if (slots.length === 0) return;

  const centerX = slots[0].x;
  const top = Math.min(...slots.map((slot) => slot.y));
  const bottom = Math.max(...slots.map((slot) => slot.y));
  const left = centerX - STACK_BLOCK.width / 2 - 16;
  const right = centerX + STACK_BLOCK.width / 2 + 16;
  const floor = bottom + STACK_BLOCK.height / 2 + 14;
  const rim = top - STACK_BLOCK.height / 2 - 10;
  const corner = 10;

  scene.append(element('path', {
    d: `M ${left} ${rim} `
      + `L ${left} ${floor - corner} Q ${left} ${floor} ${left + corner} ${floor} `
      + `L ${right - corner} ${floor} Q ${right} ${floor} ${right} ${floor - corner} `
      + `L ${right} ${rim}`,
    class: 'stack-guide',
    fill: 'none',
  }));
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

function drawEdge(edge, positions, focus, treeEdge = false, fromX = null) {
  const from = positions.get(edge.from);
  const to = positions.get(edge.to);
  if (!from || !to) return null;

  const startX = fromX ?? from.x;
  const highlighted = focus.has(edge.from) || focus.has(edge.to);
  const marker = highlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)';
  const group = element('g', { class: 'edge-group' });

  if (treeEdge) {
    const midY = (from.y + to.y) / 2;
    group.append(element('path', {
      d: `M ${startX} ${from.y} C ${startX} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`,
      class: `edge edge-tree${highlighted ? ' is-focus' : ''}`,
      'marker-end': edge.directed || edge.side ? marker : undefined,
    }));
  } else {
    let start = { x: from.x, y: from.y };
    let end = { x: to.x, y: to.y };
    if (edge.directed) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const unitX = dx / length;
      const unitY = dy / length;
      const fromRadius = from.radius ?? 26;
      const toRadius = to.radius ?? 26;
      start = {
        x: from.x + unitX * (fromRadius + 2),
        y: from.y + unitY * (fromRadius + 2),
      };
      end = {
        x: to.x - unitX * (toRadius + 2),
        y: to.y - unitY * (toRadius + 2),
      };
    }
    group.append(element('line', {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      class: `edge${highlighted ? ' is-focus' : ''}`,
      'marker-end': edge.directed ? marker : undefined,
    }));
  }

  const badgeText = edge.label ?? edge.weight;
  if (badgeText !== undefined) {
    drawEdgeBadge(group, (startX + to.x) / 2, (from.y + to.y) / 2, badgeText);
  }
  return group;
}

function drawNode(node, position, focusClass, isPointer = false, variant = 'circle', labelOverride = null) {
  const displayLabel = labelOverride ?? labelFor(node);
  const classes = ['node'];
  if (focusClass) classes.push(focusClass);
  if (node.terminal) classes.push('is-terminal');
  if (isPointer) classes.push('is-pointer');
  if (node.tombstone) classes.push('is-tombstone');
  if (node.visited) classes.push('is-visited');

  const group = element('g', {
    class: classes.join(' '),
    'data-id': node.id,
    'aria-label': `${node.tombstone ? 'deleted slot' : labelFor(node)}${node.dist !== undefined ? `, distance ${node.dist}` : ''}`,
    tabindex: '0',
  });
  const width = variant === 'stack'
    ? STACK_BLOCK.width
    : variant === 'queue'
      ? Math.max(60, (position.width ?? 78) - QUEUE_BLOCK.inset)
      : position.width ?? (Array.isArray(node.keys) ? Math.max(88, node.keys.length * 44 + 16) : 54);
  const height = variant === 'stack'
    ? STACK_BLOCK.height
    : variant === 'queue'
      ? QUEUE_BLOCK.height
      : position.height ?? 50;

  if (variant === 'stack' || variant === 'queue' || variant === 'array') {
    const rect = {
      x: position.x - width / 2,
      y: position.y - height / 2,
      width,
      height,
    };
    if (variant === 'array') {
      rect.class = 'array-cell';
    } else {
      rect.rx = String(variant === 'stack' ? STACK_BLOCK.radius : QUEUE_BLOCK.radius);
    }
    group.append(element('rect', rect));
    group.append(element('text', {
      x: position.x,
      y: position.y + 6,
      class: 'node-label',
    }, displayLabel));
  } else if (Array.isArray(node.keys)) {
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
    group.append(element('circle', { cx: position.x, cy: position.y, r: position.radius ?? 26 }));
    group.append(element('text', {
      x: position.x,
      y: position.y + 6,
      class: 'node-label',
    }, displayLabel));
  }

  if (node.terminal) {
    const radius = position.radius ?? 26;
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
    }, `d = ${node.dist}`));
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

  const queue = state.headLabel === 'FRONT' || state.tailLabel === 'BACK';
  for (const [id, text, className] of marks) {
    const position = positions.get(id);
    if (!position) continue;
    const y = queue
      ? position.y - QUEUE_BLOCK.height / 2 - 34
      : position.y - (position.radius ?? 33) - 18;
    scene.append(element('text', {
      x: position.x,
      y,
      class: `pointer-label ${className}`,
    }, text));

    if (queue) {
      const direction = className === 'is-front' ? -1 : 1;
      scene.append(element('line', {
        x1: position.x - direction * 10,
        y1: y + 12,
        x2: position.x + direction * 18,
        y2: y + 12,
        class: `pointer-arrow ${className}`,
        'marker-end': className === 'is-front'
          ? 'url(#arrowhead-active)' : 'url(#arrowhead)',
      }));
    }
  }
}

function hashCellText(bucket, chaining) {
  const items = bucket.items ?? [];
  if (items.length === 0) return '—';
  if (!chaining) {
    return items[0].tombstone ? '×' : String(items[0].value);
  }
  return `[${items[0].tombstone ? '×' : String(items[0].value)}]`;
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

  // Active input key card (stage 1 of the diagram).
  const input = positions.get('__input');
  if (input) {
    const activeKey = payload.key ?? keys.at(-1)?.value;
    scene.append(element('line', {
      x1: input.x + input.width / 2,
      y1: input.y,
      x2: hashBox.x - hashBox.width / 2,
      y2: hashBox.y,
      class: 'hash-key-arrow is-input',
      'marker-end': 'url(#arrowhead)',
    }));
    scene.append(element('text', {
      x: input.x,
      y: input.y - 26,
      class: 'hash-column-title',
    }, 'INPUT KEY'));
    const card = element('g', { class: 'hash-input-card' });
    card.append(element('rect', {
      x: input.x - input.width / 2,
      y: input.y - input.height / 2,
      width: input.width,
      height: input.height,
      rx: '9',
    }));
    card.append(element('text', {
      x: input.x,
      y: input.y + 5,
      class: 'hash-input-text',
    }, `Key: ${activeKey ?? '—'}`));
    scene.append(card);
  }

  // The hash function points at the home slot and at every probe attempt.
  const probes = Array.isArray(payload.probe) ? payload.probe.slice(0, 8) : [];
  const targets = probes.length > 0
    ? probes
    : Number.isInteger(payload.index) ? [`bucket-${payload.index}`] : [];
  const arrowStart = hashBox.x + hashBox.width / 2;
  const bendX = (arrowStart + table.x) / 2;
  targets.forEach((id, index) => {
    const position = positions.get(id);
    if (!position) return;
    const probing = probes.length > 1;
    scene.append(element('path', {
      d: `M ${arrowStart} ${hashBox.y} C ${bendX} ${hashBox.y}, ${bendX} ${position.y}, ${table.x} ${position.y}`,
      class: `${probing ? 'hash-probe-arrow' : 'hash-hash-arrow'}${probing && step.type === 'probe' ? ' is-animating' : ''}`,
      fill: 'none',
      'marker-end': probing ? 'url(#arrowhead-active)' : 'url(#arrowhead)',
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
  const expression = payload.expression
    ?? (Number.isFinite(homeIndex) ? `${payload.key} mod ${state.capacity} = ${homeIndex}` : `${state.hash} hashing`);
  functionGroup.append(element('text', {
    x: hashBox.x,
    y: hashBox.y + 29,
    class: 'hash-function-result',
  }, expression));
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

  // Separate chaining: draw the rest of each bucket's list to the right.
  if (chaining) {
    const chainLayout = positions.get('__chain') ?? { x: table.x + table.width + 28, step: 46, max: 3 };
    const maxNodes = chainLayout.max ?? 3;
    buckets.forEach((bucket) => {
      const position = positions.get(bucket.id);
      const extra = bucket.items ?? [];
      if (!position || extra.length <= 1) return;
      const items = extra.slice(1, 1 + maxNodes);
      const hidden = extra.length - 1 - items.length;
      let previousX = valueX + valueWidth;
      items.forEach((item, index) => {
        const centerX = chainLayout.x + index * (chainLayout.step ?? 46);
        scene.append(element('line', {
          x1: previousX,
          y1: position.y,
          x2: centerX - 23,
          y2: position.y,
          class: 'hash-chain-arrow',
          'marker-end': 'url(#arrowhead)',
        }));
        const node = element('g', {
          class: `hash-chain-node${focus.has(item.id) ? ` ${focusClass}` : ''}`,
          'data-id': item.id,
        });
        node.append(element('rect', {
          x: centerX - 22,
          y: position.y - 12,
          width: 44,
          height: 24,
          rx: '6',
        }));
        node.append(element('text', {
          x: centerX,
          y: position.y + 4,
          class: 'hash-chain-text',
        }, `[${item.tombstone ? '×' : String(item.value)}]`));
        scene.append(node);
        previousX = centerX + 22;
      });
      if (hidden > 0) {
        const overflowX = previousX + 24;
        scene.append(element('text', {
          x: overflowX,
          y: position.y + 4,
          class: 'hash-chain-overflow',
        }, `+${hidden}`));
      }
    });
  }

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
  const stacked = state.orientation === 'vertical';
  const queue = state.headLabel === 'FRONT' || state.tailLabel === 'BACK';
  const array = Number.isInteger(state.capacity) && Array.isArray(state.items)
    && state.head === undefined;
  const nodes = nodeList(state);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const trieRoot = nodes.some((node) => node.value === '') ? state.root : null;
  const multiKey = treeEdges && nodes.some((node) => Array.isArray(node.keys));
  const outgoing = new Map();
  if (multiKey) {
    for (const edge of state.edges ?? []) {
      outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
    }
  }
  const pointerIds = new Set(
    [state.top, state.head, state.tail].filter((id) => id !== null && id !== undefined),
  );

  if (stacked) drawStackGuide(scene, positions);
  if (queue) drawQueueLane(scene, positions);
  if (array) drawArrayFreeCells(scene, positions);

  (state.edges ?? []).forEach((edge, order) => {
    let fromX = null;
    if (multiKey) {
      const node = nodeById.get(edge.from);
      const position = positions.get(edge.from);
      if (node && position) {
        fromX = childAnchor(node, position, edge.index ?? order, outgoing.get(edge.from) ?? 1);
      }
    }
    const drawn = drawEdge(edge, positions, focus, treeEdges, fromX);
    if (drawn) scene.append(drawn);
  });

  if (multiKey) drawLeafLinks(scene, state, positions, focus, focusClass);

  const variant = stacked ? 'stack' : queue ? 'queue' : array ? 'array' : 'circle';
  for (const node of nodes) {
    const position = positions.get(node.id);
    if (!position) continue;
    const className = focus.has(node.id) ? focusClass : '';
    const labelOverride = node.id === trieRoot ? 'Ø' : null;
    scene.append(drawNode(node, position, className, pointerIds.has(node.id), variant, labelOverride));
    if (position.index !== undefined) {
      scene.append(element('text', {
        x: stacked ? position.x - STACK_BLOCK.width / 2 - 22 : position.x,
        y: stacked ? position.y : position.y + 52,
        class: stacked ? 'index-label is-stacked' : 'index-label',
      }, `[${position.index}]`));
    }
  }

  drawPointerLabels(scene, state, positions);
}
