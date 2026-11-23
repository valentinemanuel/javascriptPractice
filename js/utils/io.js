/**
 * Client-side export / import helpers for StructLab.
 *
 * The pure helpers at the top are DOM-free and unit testable. The DOM helpers
 * below them are only called by the app shell, never by structure modules.
 */
export const APP_NAME = 'StructLab';
export const FORMAT_VERSION = 1;
const NS = 'http://www.w3.org/2000/svg';

const HASH_STRATEGIES = {
  chaining: 'useChaining',
  linear: 'useLinearProbing',
  quadratic: 'useQuadraticProbing',
  double: 'useDoubleHashing',
};

const HASH_FUNCTIONS = {
  modulo: 'useModuloHash',
  multiplication: 'useMultiplicationHash',
  universal: 'useUniversalHashing',
};

function drain(iterator) {
  if (!iterator || typeof iterator.next !== 'function') return;
  for (const _step of iterator) { /* settings are applied without animation */ }
}

/** True when a state has no user data, even if it keeps structural slots. */
export function isEmptyState(state) {
  if (!state || typeof state !== 'object') return true;
  if (Array.isArray(state.buckets)) {
    return state.buckets.every((bucket) => (bucket.items ?? [])
      .every((item) => item.tombstone === true));
  }
  if (Array.isArray(state.items)) return state.items.length === 0;
  if (Array.isArray(state.nodes)) {
    return state.nodes.every((node) => {
      if (Array.isArray(node.keys)) return node.keys.length === 0;
      return node.value === undefined || node.value === '';
    });
  }
  return true;
}

export function createFileName(id, extension) {
  const safeId = String(id).replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');
  return `structlab-${safeId || 'state'}.${extension}`;
}

export function settingsFor(id, state = {}) {
  if (id === 'hash-table') {
    return { strategy: state.strategy, hash: state.hash };
  }
  if (id === 'graph') {
    return { directed: Boolean(state.directed), weighted: Boolean(state.weighted) };
  }
  if (id === 'btree' || id === 'b-plus-tree') {
    return { order: state.order };
  }
  return {};
}

export function createPayload(id, state) {
  return {
    app: APP_NAME,
    version: FORMAT_VERSION,
    structure: id,
    settings: settingsFor(id, state),
    data: JSON.parse(JSON.stringify(state ?? {})),
  };
}

export function parsePayload(text, supportedIds = []) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'The file does not contain a StructLab state object.' };
  }
  if (payload.app !== APP_NAME) {
    return { ok: false, error: 'This file was not exported by StructLab.' };
  }
  if (payload.version !== FORMAT_VERSION) {
    return { ok: false, error: `Unsupported format version: ${String(payload.version)}.` };
  }
  if (typeof payload.structure !== 'string' || !supportedIds.includes(payload.structure)) {
    return { ok: false, error: 'The file names an unknown structure.' };
  }
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    return { ok: false, error: 'The file has no structure data.' };
  }
  return { ok: true, payload };
}

export function createStructure(id, registry, settings = {}) {
  const entry = registry[id];
  const usesOrder = id === 'btree' || id === 'b-plus-tree';
  const order = Number(settings.order);
  return usesOrder && Number.isFinite(order)
    ? new entry.Structure(order)
    : new entry.Structure();
}

function applySetter(structure, name) {
  const method = structure[name];
  if (typeof method === 'function') drain(method.call(structure));
}

export function applySettings(structure, id, settings = {}) {
  if (id === 'graph') {
    if (typeof settings.directed === 'boolean') {
      applySetter(structure, settings.directed ? 'useDirected' : 'useUndirected');
    }
    if (typeof settings.weighted === 'boolean') {
      applySetter(structure, settings.weighted ? 'useWeighted' : 'useUnweighted');
    }
  }
  if (id === 'hash-table') {
    applySetter(structure, HASH_STRATEGIES[settings.strategy]);
    applySetter(structure, HASH_FUNCTIONS[settings.hash]);
  }
  return structure;
}

export function sceneViewport(box, padding = 40) {
  const margin = Number.isFinite(padding) ? Math.max(0, padding) : 40;
  const width = Math.max(1, Number(box?.width) || 1);
  const height = Math.max(1, Number(box?.height) || 1);
  return {
    x: (Number(box?.x) || 0) - margin,
    y: (Number(box?.y) || 0) - margin,
    width: width + margin * 2,
    height: height + margin * 2,
  };
}

export function themeVariables(root) {
  const computed = root ? getComputedStyle(root) : getComputedStyle(document.documentElement);
  const names = [
    '--bg', '--panel', '--panel-2', '--text', '--muted', '--accent',
    '--border', '--edge', '--compare', '--found', '--miss', '--probe',
    '--grad-default-1', '--grad-default-2', '--grad-active-1', '--grad-active-2',
    '--grad-found-1', '--grad-found-2',
  ];
  const variables = {};
  for (const name of names) {
    const value = computed.getPropertyValue(name).trim();
    if (value) variables[name] = value;
  }
  return variables;
}

/** Styles embedded in the exported SVG so it renders identically on its own. */
export function buildSvgStyles(variables = {}) {
  const declarations = Object.entries(variables)
    .map(([name, value]) => `${name}:${value};`)
    .join('');
  return `
svg{${declarations}font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.grad-default-1{stop-color:var(--grad-default-1,#33445a)}
.grad-default-2{stop-color:var(--grad-default-2,#151b23)}
.grad-active-1{stop-color:var(--grad-active-1,#79c0ff)}
.grad-active-2{stop-color:var(--grad-active-2,#1f5f9e)}
.grad-found-1{stop-color:var(--grad-found-1,#56d364)}
.grad-found-2{stop-color:var(--grad-found-2,#176b33)}
.node circle,.node rect,.bucket rect{fill:url(#node-grad-default);stroke:var(--accent);stroke-width:2}
.node .node-label{fill:var(--text);font-size:15px;font-weight:700;text-anchor:middle}
.node .distance-label,.index-label{fill:var(--muted);font-size:11px;text-anchor:middle}
.node .key-divider{stroke:var(--border);stroke-width:1}
.node-capacity{fill:var(--muted);font-size:10px;text-anchor:end}
.node.is-visited circle:not(.terminal-ring),.node.is-visited rect{stroke:var(--compare);fill:rgba(242,204,96,0.1)}
.node.is-focus circle:not(.terminal-ring),.node.is-focus rect,
.node.is-visiting circle:not(.terminal-ring),.node.is-visiting rect{fill:url(#node-grad-active)}
.node.is-compare circle:not(.terminal-ring),.node.is-compare rect{stroke:var(--compare);fill:rgba(242,204,96,0.2)}
.node.is-found circle:not(.terminal-ring),.node.is-found rect{stroke:var(--found);fill:url(#node-grad-found)}
.node.is-miss circle:not(.terminal-ring),.node.is-miss rect{stroke:var(--miss);fill:rgba(248,81,73,0.18)}
.node.is-probe circle:not(.terminal-ring),.node.is-probe rect,
.node.is-collision circle:not(.terminal-ring),.node.is-collision rect{stroke:var(--probe);fill:rgba(188,140,255,0.2)}
.node.is-pointer circle:not(.terminal-ring),.node.is-pointer rect{stroke:var(--accent);stroke-dasharray:4 3}
.node.is-tombstone circle{stroke:var(--miss);fill:transparent;stroke-dasharray:4 3}
.node.is-terminal .terminal-ring{fill:none;stroke:var(--found);stroke-width:1.5}
.node.is-terminal .terminal-ring-outer{stroke-width:1;opacity:0.7}
.edge,.edge-tree,.leaf-link,.arrow-path{stroke:var(--edge);stroke-width:1.6;fill:none}
.edge.is-focus,.edge-tree.is-focus{stroke:var(--accent);stroke-width:2.5}
.edge.is-path{stroke:var(--found);stroke-width:3}
.edge-label rect{fill:var(--panel);stroke:var(--border);stroke-width:1}
.edge-label-text{fill:var(--text);font-size:11px;font-weight:600;text-anchor:middle}
.stack-guide,.queue-guide{stroke:var(--border);stroke-width:1.5;stroke-linecap:round;opacity:0.75}
.array-free-cell{fill:none;stroke:var(--border);stroke-width:1.5;stroke-dasharray:3 4;opacity:0.65}
.array-free-index{fill:var(--muted);font-size:10px;opacity:0.7;text-anchor:middle}
.pointer-label{fill:var(--muted);font-size:10px;letter-spacing:0.08em;text-anchor:middle}
.pointer-label.is-front{fill:var(--found)}.pointer-label.is-back{fill:var(--probe)}
.pointer-arrow{stroke:var(--muted);stroke-width:1.6}
.pointer-arrow.is-front{stroke:var(--found)}.pointer-arrow.is-back{stroke:var(--probe)}
.hash-key rect{fill:url(#node-grad-default);stroke:var(--accent);stroke-width:1.5}
.hash-key-text{fill:var(--text);font-size:14px;font-weight:600;text-anchor:middle}
.hash-key.is-found rect{fill:url(#node-grad-found);stroke:var(--found)}
.hash-input-card rect{fill:url(#node-grad-active);stroke:var(--accent);stroke-width:2}
.hash-input-text{fill:var(--text);font-size:13px;font-weight:700;text-anchor:middle}
.hash-column-title,.hash-header-text{fill:var(--accent);font-size:11px;font-weight:700;letter-spacing:0.08em;text-anchor:middle}
.hash-function-box rect{fill:var(--panel);stroke:var(--accent);stroke-width:2}
.hash-function-title,.hash-function-result{fill:var(--accent);font-size:12px;font-weight:700;text-anchor:middle}
.hash-function-meta,.hash-row-index,.hash-row-value{fill:var(--text);font-size:12px;text-anchor:middle}
.hash-row rect{fill:var(--panel-2);stroke:var(--border);stroke-width:1}
.hash-row.is-occupied rect{stroke:var(--accent)}
.hash-row.is-tombstone rect{stroke:var(--miss)}
.hash-row.is-found rect{stroke:var(--found);fill:url(#node-grad-found)}
.hash-key-arrow,.hash-chain-arrow{stroke:var(--edge);stroke-width:1.5}
.hash-key-arrow.is-input{stroke:var(--accent);stroke-width:1.8}
.hash-hash-arrow{stroke:var(--accent);stroke-width:1.6;fill:none}
.hash-probe-arrow{stroke:var(--probe);stroke-width:1.6;stroke-dasharray:5 3;fill:none}
.hash-chain-node rect{fill:var(--panel-2);stroke:var(--accent);stroke-width:1.4}
.hash-chain-text{fill:var(--text);font-size:11px;font-weight:600;text-anchor:middle}
.hash-probe-badge-circle{fill:var(--panel);stroke:var(--probe);stroke-width:2}
.hash-probe-badge{fill:var(--probe);font-size:10px;font-weight:700;text-anchor:middle}
.empty-hint rect{fill:var(--panel);stroke:var(--border);stroke-dasharray:5 4;stroke-width:1.4}
.empty-hint text{fill:var(--muted);font-size:13px;text-anchor:middle}
.result-banner rect{fill:var(--panel);stroke:var(--accent);stroke-width:1.2}
.result-banner text{fill:var(--text);font-size:12px;font-weight:600;text-anchor:middle}
`.trim();
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(payload, id) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, createFileName(id, 'json'));
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('Canvas export is not supported in this browser.'));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the PNG image.'));
    }, 'image/png');
  });
}

export async function exportSvgPng(svg, id, options = {}) {
  const scene = svg?.querySelector?.('#scene');
  if (!scene || typeof scene.getBBox !== 'function') {
    throw new Error('The visualization is not ready for export.');
  }

  const view = sceneViewport(scene.getBBox(), options.padding ?? 40);
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
  clone.setAttribute('width', String(Math.ceil(view.width)));
  clone.setAttribute('height', String(Math.ceil(view.height)));

  const resultLayer = clone.querySelector('#result-layer');
  if (resultLayer) resultLayer.remove();

  // getBBox() is in local coordinates; drop the live camera transform so the
  // exported crop is independent of the current zoom and pan.
  const clonedScene = clone.querySelector('#scene');
  if (clonedScene) clonedScene.removeAttribute('transform');

  let defs = clone.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(NS, 'defs');
    clone.prepend(defs);
  }
  const style = document.createElementNS(NS, 'style');
  style.textContent = buildSvgStyles(options.variables ?? themeVariables());
  defs.append(style);

  const background = document.createElementNS(NS, 'rect');
  background.setAttribute('x', String(view.x));
  background.setAttribute('y', String(view.y));
  background.setAttribute('width', String(view.width));
  background.setAttribute('height', String(view.height));
  background.setAttribute('fill', options.background ?? '#0d1117');
  if (clone.firstChild) clone.insertBefore(background, clone.firstChild.nextSibling);
  else clone.prepend(background);

  const source = new XMLSerializer().serializeToString(clone);
  const svgUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not render the SVG image.'));
      image.src = svgUrl;
    });

    const scale = options.scale ?? 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(view.width * scale));
    canvas.height = Math.max(1, Math.round(view.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    downloadBlob(await canvasToBlob(canvas), createFileName(id, 'png'));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsText(file);
  });
}
