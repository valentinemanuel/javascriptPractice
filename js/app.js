import { registry } from './registry.js';
import { Animator } from './core/Animator.js';
import { render } from './core/renderers/svg.js';
import { renderComplexity } from './core/complexity.js';
import { initBackground } from './ui/background.js';
import { applyRandomData } from './ui/random-data.js';
import { computeFitTransform } from './core/fit.js';
import {
  isPrimaryActionKey,
  isPlaybackShortcut,
  isTextEntry,
  pickPrimaryOperation,
} from './core/shortcuts.js';
import {
  initialSidebarState,
  readDockVisible,
  sidebarClasses,
  writeDockVisible,
  writeSidebarVisibility,
} from './utils/sidebar.js';
import {
  applySettings,
  createPayload,
  createStructure,
  downloadJson,
  exportSvgPng,
  isEmptyState,
  parsePayload,
  readJsonFile,
  themeVariables,
} from './utils/io.js';

const byId = (id) => document.getElementById(id);
const svg = byId('stage');
const nav = byId('structure-nav');
const title = byId('structure-title');
const description = byId('structure-description');
const toolbar = byId('operation-buttons');
const configurationButtons = byId('configuration-buttons');
const configDetails = byId('config-details');
const configSummary = byId('config-summary');
const complexityToggle = byId('complexity-toggle');
const structureCount = byId('structure-count');
const headerStructureCount = byId('header-structure-count');
const complexityPanel = byId('complexity');
const logList = byId('log');
const fields = byId('fields');
const dock = byId('dock');
const toggleDock = byId('toggle-dock');
const playPause = byId('play-pause');
playPause.classList.add('is-primary');
const stepButton = byId('step');
const resetButton = byId('reset');
const speedInput = byId('speed');
const speedValue = byId('speed-value');
const clearStructureButton = byId('clear-structure');
const clearLogButton = byId('clear-log');
const exportPngButton = byId('export-png');
const stageWrap = byId('stage-wrap');
const importFileInput = byId('import-json');
const layout = document.querySelector('.layout');
const toggleLeft = byId('toggle-left');
const toggleRight = byId('toggle-right');

const jsonModal = byId('json-modal');
const exportJsonText = byId('export-json-text');
const importJsonText = byId('import-json-text');
const copyStatus = byId('copy-status');
const importStatus = byId('import-status');
const tabExport = byId('tab-export');
const tabImport = byId('tab-import');

let current = null;
let activeOperation = null;
let primaryOperation = null;
let stepCount = 0;
let showAllComplexity = false;

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let sidebarState = initialSidebarState(safeStorage(), window.innerWidth);
let dockVisible = readDockVisible(safeStorage());
let refitTimer = null;

function applySidebarState() {
  layout.className = sidebarClasses(sidebarState);
  toggleLeft.setAttribute('aria-pressed', String(sidebarState.left));
  toggleRight.setAttribute('aria-pressed', String(sidebarState.right));
}

function positionEdgeToggles() {
  const layoutRect = layout.getBoundingClientRect();

  if (window.matchMedia?.('(max-width: 820px)')?.matches) {
    toggleLeft.style.left = '4px';
    toggleRight.style.right = '4px';
  } else {
    const leftRect = layout.querySelector('.sidebar').getBoundingClientRect();
    const rightRect = layout.querySelector('.info-panel').getBoundingClientRect();
    toggleLeft.style.left = `${Math.max(4, leftRect.right - layoutRect.left - 13)}px`;
    toggleRight.style.right = `${Math.max(4, layoutRect.right - rightRect.left - 13)}px`;
  }
}

function applyDockState() {
  dock.classList.toggle('bottom-collapsed', !dockVisible);
  toggleDock.setAttribute('aria-expanded', String(dockVisible));
}

function toggleDockVisible() {
  dockVisible = !dockVisible;
  writeDockVisible(safeStorage(), dockVisible);
  applyDockState();
  scheduleRefit();
}

toggleDock.addEventListener('click', toggleDockVisible);

function scheduleRefit() {
  clearTimeout(refitTimer);
  refitTimer = setTimeout(() => {
    positionEdgeToggles();
    fitSceneToViewport();
  }, 560);
}

function toggleSidebar(side) {
  sidebarState = { ...sidebarState, [side]: !sidebarState[side] };
  writeSidebarVisibility(safeStorage(), sidebarState);
  toggleLeft.style.left = '';
  toggleRight.style.right = '';
  applySidebarState();
  if (window.matchMedia?.('(max-width: 820px)')?.matches) positionEdgeToggles();
  scheduleRefit();
}

toggleLeft.addEventListener('click', () => toggleSidebar('left'));
toggleRight.addEventListener('click', () => toggleSidebar('right'));
layout.addEventListener('transitionend', (event) => {
  if (event.target !== layout || event.propertyName !== 'grid-template-columns') return;
  clearTimeout(refitTimer);
  positionEdgeToggles();
  fitSceneToViewport();
});

function updateComplexity() {
  if (!current) return;
  renderComplexity(
    complexityPanel,
    current.structure.meta,
    activeOperation,
    !showAllComplexity,
  );
}

let zoom = 1;
let panX = 0;
let panY = 0;

const animator = new Animator({
  onStep(step) {
    draw(step);
    stepCount += 1;
    appendLog(`#${stepCount} ${step.message}`, step.type);
  },
  onDone() {
    appendLog('Operation finished.', 'done');
  },
  onStatus(status) {
    playPause.textContent = status.playing ? '⏸ Pause' : '▶ Play';
    stepButton.disabled = !status.active;
  },
});

function viewport() {
  const dockHeight = dock?.getBoundingClientRect().height ?? 0;
  return {
    width: svg.clientWidth || 900,
    height: Math.max(180, (svg.clientHeight || 560) - dockHeight - 16),
  };
}

function applyTransform() {
  const scene = svg.querySelector('#scene');
  if (scene) scene.setAttribute('transform', `translate(${panX} ${panY}) scale(${zoom})`);
}

function fitSceneToViewport() {
  const scene = svg.querySelector('#scene');
  if (!scene || typeof scene.getBBox !== 'function') return;

  let box;
  try {
    box = scene.getBBox();
  } catch {
    return;
  }
  const isEmptyHint = Boolean(scene.querySelector('[data-empty-hint]'));
  if (isEmptyHint || !box || !box.width || !box.height) {
    zoom = 1;
    panX = 0;
    panY = 0;
    applyTransform();
    return;
  }

  const stageRect = svg.getBoundingClientRect();
  const dockRect = dock?.getBoundingClientRect();
  const header = document.querySelector('.stage-header');
  const headerRect = header?.getBoundingClientRect();
  const top = Math.max(0, (headerRect?.bottom ?? stageRect.top) - stageRect.top);
  const bottom = Math.min(
    stageRect.height,
    dockRect ? dockRect.top - stageRect.top : stageRect.height,
  );

  const transform = computeFitTransform(box, {
    width: stageRect.width,
    height: stageRect.height,
    top,
    bottom: Math.max(top + 80, bottom),
    maxScale: 1.35,
  });
  if (!transform) {
    zoom = 1;
    panX = 0;
    panY = 0;
    applyTransform();
    return;
  }

  zoom = transform.scale;
  panX = transform.translateX;
  panY = transform.translateY;
  applyTransform();
}

function draw(step = {}) {
  if (!current) return;
  const state = current.structure.getState();
  const area = viewport();
  const positions = current.entry.layout(state, area);
  render(svg, state, positions, step, area);
  exportPngButton.disabled = isEmptyState(state);
  applyTransform();
}

function appendLog(message, type = 'info') {
  if (!message) return;
  const item = document.createElement('li');
  item.className = `is-${type}`;
  item.textContent = message;
  logList.append(item);
  while (logList.children.length > 80) logList.firstElementChild.remove();
  logList.scrollTop = logList.scrollHeight;
}

function clearLog() {
  logList.replaceChildren();
}

function parseField(raw, type) {
  if (type !== 'number') return raw;
  const number = Number(raw);
  return Number.isFinite(number) ? number : raw;
}

function buildFields(operations = {}) {
  fields.replaceChildren();
  const seen = new Set();
  const descriptors = [];
  for (const operation of Object.values(operations)) {
    for (const descriptor of operation.fields ?? []) {
      if (!seen.has(descriptor.name)) {
        seen.add(descriptor.name);
        descriptors.push(descriptor);
      }
    }
  }
  if (descriptors.length === 0) {
    const hint = document.createElement('span');
    hint.className = 'fields-hint';
    hint.textContent = 'No arguments needed for this operation.';
    fields.append(hint);
    return;
  }

  for (const descriptor of descriptors) {
    const label = document.createElement('label');
    label.className = 'field';
    const caption = document.createElement('span');
    caption.textContent = descriptor.label ?? descriptor.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.name = descriptor.name;
    input.placeholder = descriptor.placeholder ?? '';
    input.autocomplete = 'off';
    label.append(caption, input);
    fields.append(label);
  }
}

function readFields(operation) {
  const values = [];
  for (const descriptor of operation.fields ?? []) {
    const input = fields.querySelector(`[data-name="${descriptor.name}"]`);
    const raw = input?.value ?? '';
    if (raw.trim() === '') {
      if (descriptor.required !== false) {
        appendLog(`Enter a value for ${descriptor.label ?? descriptor.name} first.`, 'miss');
        return null;
      }
      values.push('');
      continue;
    }
    values.push(parseField(raw, descriptor.type));
  }
  return values;
}

function buildNav() {
  nav.replaceChildren();
  const count = String(Object.keys(registry).length);
  structureCount.textContent = count;
  headerStructureCount.textContent = count;
  const groups = new Map();
  for (const [id, entry] of Object.entries(registry)) {
    const group = entry.group ?? 'Other';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push([id, entry]);
  }

  for (const [group, entries] of groups) {
    const heading = document.createElement('h3');
    heading.textContent = group;
    nav.append(heading);
    for (const [id, entry] of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'structure-link';
      button.dataset.id = id;
      button.textContent = entry.Structure.meta.title;
      button.addEventListener('click', () => load(id));
      nav.append(button);
    }
  }
}

function buildToolbar() {
  toolbar.replaceChildren();
  configurationButtons.replaceChildren();
  const operations = current.structure.meta.operations ?? {};
  let configCount = 0;

  for (const [name, operation] of Object.entries(operations)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = operation.label ?? name;
    button.addEventListener('click', () => runOperation(name, operation));
    if (name.startsWith('use') || name.startsWith('new')) {
      configurationButtons.append(button);
      configCount += 1;
    } else {
      toolbar.append(button);
    }
  }

  primaryOperation = pickPrimaryOperation(operations);
  configDetails.hidden = configCount === 0;
  if (configCount === 0) configDetails.open = false;
  configSummary.textContent = current.id === 'graph'
    ? 'Strategy & graph settings'
    : current.id === 'btree' || current.id === 'b-plus-tree'
      ? 'Tree degree settings'
      : 'Strategy & hash settings';
  buildFields(operations);
}

function runOperation(name, operation) {
  if (!current) return;
  const structure = current.structure;
  const method = structure[name];
  if (!method || !operation) return;

  const args = readFields(operation);
  if (args === null) return;
  const iterator = method.call(structure, ...args);

  activeOperation = name;
  stepCount = 0;
  updateComplexity();
  animator.load(iterator);
  animator.play();
}

function load(id, structure = null) {
  const entry = registry[id];
  if (!entry) return;

  animator.stop();
  const instance = structure ?? new entry.Structure();
  instance.reset(instance.meta.demo ?? []);
  current = { id, entry, structure: instance };
  activeOperation = null;
  stepCount = 0;

  if (window.location.hash !== `#/${id}`) window.location.hash = `#/${id}`;
  title.textContent = instance.meta.title;
  description.textContent = instance.meta.description;
  svg.setAttribute('aria-label', `${instance.meta.title} visualization`);
  svg.classList.toggle('is-graph', id === 'graph');

  for (const button of nav.querySelectorAll('.structure-link')) {
    button.classList.toggle('is-active', button.dataset.id === id);
  }

  buildToolbar();
  updateComplexity();
  clearLog();
  appendLog(`Loaded ${instance.meta.title}.`, 'info');
  draw();
  fitSceneToViewport();
}

function togglePlayback() {
  if (animator.playing) animator.pause();
  else animator.play();
}

playPause.addEventListener('click', togglePlayback);

stepButton.addEventListener('click', () => animator.step());

fields.addEventListener('keydown', (event) => {
  if (!isPrimaryActionKey(event) || !primaryOperation) return;
  event.preventDefault();
  runOperation(primaryOperation.name, primaryOperation.operation);
});

document.addEventListener('keydown', (event) => {
  if (!jsonModal.hidden) return;
  const target = event.target;
  const onControl = target?.matches?.('button, a, summary, [role="button"]');
  const plainH = event.key.toLowerCase() === 'h'
    && !event.ctrlKey && !event.metaKey && !event.altKey
    && !isTextEntry(target) && !onControl;
  if (plainH) {
    event.preventDefault();
    toggleDockVisible();
    return;
  }
  if (!isPlaybackShortcut(event) || !current) return;
  event.preventDefault();
  togglePlayback();
});

resetButton.addEventListener('click', () => {
  if (!current) return;
  animator.stop();
  current.structure.reset(current.structure.meta.demo ?? []);
  activeOperation = null;
  stepCount = 0;
  updateComplexity();
  clearLog();
  appendLog('Structure reset to its demo state.', 'info');
  draw();
  fitSceneToViewport();
});

speedInput.addEventListener('input', () => {
  animator.setSpeed(speedInput.value);
  speedValue.textContent = `${animator.speed}×`;
});

complexityToggle.addEventListener('click', () => {
  showAllComplexity = !showAllComplexity;
  complexityToggle.textContent = showAllComplexity ? 'Show less' : 'Show all';
  complexityToggle.setAttribute('aria-expanded', String(showAllComplexity));
  updateComplexity();
});

function setZoom(factor) {
  zoom = Math.min(2.5, Math.max(0.4, zoom * factor));
  applyTransform();
}

byId('zoom-in').addEventListener('click', () => setZoom(1.2));
byId('zoom-out').addEventListener('click', () => setZoom(1 / 1.2));

byId('reset-zoom').addEventListener('click', () => {
  fitSceneToViewport();
});

byId('random-data').addEventListener('click', () => {
  if (!current) return;
  animator.stop();
  applyRandomData(current.structure, current.id);
  activeOperation = null;
  stepCount = 0;
  updateComplexity();
  clearLog();
  appendLog('Loaded a fresh random dataset.', 'info');
  draw();
  fitSceneToViewport();
});

clearStructureButton.addEventListener('click', () => {
  if (!current) return;
  animator.stop();
  current.structure.clear();
  activeOperation = null;
  stepCount = 0;
  updateComplexity();
  clearLog();
  appendLog(`Cleared ${current.structure.meta.title}.`, 'info');
  draw();
  fitSceneToViewport();
  fields.querySelector('input')?.focus();
});

clearLogButton.addEventListener('click', () => clearLog());

byId('export-png').addEventListener('click', async () => {
  if (!current) return;
  if (isEmptyState(current.structure.getState())) {
    appendLog('Cannot export a PNG: the structure is empty. Add data first.', 'miss');
    return;
  }
  try {
    const variables = themeVariables();
    await exportSvgPng(svg, current.id, {
      variables,
      background: variables['--bg'] ?? '#0d1117',
    });
    appendLog(`Exported ${current.structure.meta.title} as a PNG image.`, 'info');
  } catch (error) {
    appendLog(`PNG export failed: ${error.message ?? error}`, 'miss');
  }
});

function currentPayload() {
  return current ? createPayload(current.id, current.structure.getState()) : null;
}

function setModalStatus(element, message, kind = '') {
  element.textContent = message;
  element.className = `modal-status${kind ? ` is-${kind}` : ''}`;
}

function setModalTab(tab) {
  const exporting = tab === 'export';
  tabExport.setAttribute('aria-selected', String(exporting));
  tabImport.setAttribute('aria-selected', String(!exporting));
  tabExport.tabIndex = exporting ? 0 : -1;
  tabImport.tabIndex = exporting ? -1 : 0;
  byId('panel-export').hidden = !exporting;
  byId('panel-import').hidden = exporting;
  setModalStatus(copyStatus, '');
  setModalStatus(importStatus, '');
}

function openJsonModal() {
  const payload = currentPayload();
  if (!payload) return;
  exportJsonText.value = JSON.stringify(payload, null, 2);
  setModalTab('export');
  jsonModal.hidden = false;
  jsonModal.setAttribute('aria-hidden', 'false');
  byId('copy-json').focus();
}

function closeJsonModal() {
  if (jsonModal.hidden) return;
  jsonModal.hidden = true;
  jsonModal.setAttribute('aria-hidden', 'true');
  byId('share-json').focus();
}

byId('share-json').addEventListener('click', openJsonModal);
byId('modal-close').addEventListener('click', closeJsonModal);
jsonModal.querySelector('[data-close-modal]').addEventListener('click', closeJsonModal);
tabExport.addEventListener('click', () => setModalTab('export'));
tabImport.addEventListener('click', () => setModalTab('import'));
jsonModal.querySelector('.modal-tabs').addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const next = tabExport.getAttribute('aria-selected') === 'true' ? 'import' : 'export';
  setModalTab(next);
  (next === 'export' ? tabExport : tabImport).focus();
});

const COPY_LABEL = 'Copy to clipboard';
let copyResetTimer = null;
byId('copy-json').addEventListener('click', async () => {
  const button = byId('copy-json');
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard is not available in this browser.');
    }
    await navigator.clipboard.writeText(exportJsonText.value);
    button.textContent = 'Copied!';
    setModalStatus(copyStatus, 'JSON copied to the clipboard.', 'success');
    clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => { button.textContent = COPY_LABEL; }, 1500);
  } catch (error) {
    setModalStatus(copyStatus, `Copy failed: ${error.message ?? error}`, 'error');
  }
});

byId('download-json').addEventListener('click', () => {
  const payload = currentPayload();
  if (!payload) return;
  downloadJson(payload, current.id);
  setModalStatus(copyStatus, `Downloaded structlab-${current.id}.json.`, 'success');
  appendLog(`Exported ${current.structure.meta.title} state as JSON.`, 'info');
});

function importStateText(text) {
  try {
    const result = parsePayload(text, Object.keys(registry));
    if (!result.ok) {
      setModalStatus(importStatus, result.error, 'error');
      appendLog(`Import failed: ${result.error}`, 'miss');
      return false;
    }

    const { payload } = result;
    const structure = createStructure(payload.structure, registry, payload.settings ?? {});
    load(payload.structure, structure);
    applySettings(current.structure, payload.structure, payload.settings ?? {});
    current.structure.restore(payload.data);
    activeOperation = null;
    stepCount = 0;
    updateComplexity();
    clearLog();
    appendLog(`Loaded ${current.structure.meta.title} from JSON.`, 'info');
    draw();
    fitSceneToViewport();
    setModalStatus(importStatus, `${current.structure.meta.title} loaded successfully.`, 'success');
    closeJsonModal();
    return true;
  } catch (error) {
    const message = error.message ?? String(error);
    setModalStatus(importStatus, `Import failed: ${message}`, 'error');
    appendLog(`Import failed: ${message}`, 'miss');
    return false;
  }
}

byId('load-json').addEventListener('click', () => importStateText(importJsonText.value));
byId('select-json').addEventListener('click', () => importFileInput.click());

importFileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    importStateText(await readJsonFile(file));
  } catch (error) {
    const message = error.message ?? String(error);
    setModalStatus(importStatus, `Import failed: ${message}`, 'error');
    appendLog(`Import failed: ${message}`, 'miss');
  }
});

stageWrap.addEventListener('dragenter', (event) => {
  event.preventDefault();
  stageWrap.classList.add('is-dropping');
});
stageWrap.addEventListener('dragover', (event) => {
  event.preventDefault();
  stageWrap.classList.add('is-dropping');
});
stageWrap.addEventListener('dragleave', (event) => {
  if (!stageWrap.contains(event.relatedTarget)) stageWrap.classList.remove('is-dropping');
});
stageWrap.addEventListener('drop', (event) => {
  event.preventDefault();
  stageWrap.classList.remove('is-dropping');
  const files = [...(event.dataTransfer?.files ?? [])];
  const file = files.find((item) => item.name.toLowerCase().endsWith('.json'));
  if (!file) {
    appendLog('Import failed: drop a .json file over the viewer.', 'miss');
    return;
  }
  importStateFileViaDrag(file);
});

async function importStateFileViaDrag(file) {
  try {
    importStateText(await readJsonFile(file));
  } catch (error) {
    const message = error.message ?? String(error);
    appendLog(`Import failed: ${message}`, 'miss');
  }
}

document.addEventListener('keydown', (event) => {
  if (jsonModal.hidden) return;
  if (event.key === 'Escape') {
    closeJsonModal();
    return;
  }
  if (event.key !== 'Tab') return;

  const focusable = [...jsonModal.querySelectorAll('button, textarea, input')]
    .filter((element) => !element.disabled && element.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

byId('theme-toggle').addEventListener('click', (event) => {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  event.currentTarget.textContent = next === 'dark' ? '☾ Dark' : '☀ Light';
});

svg.addEventListener('wheel', (event) => {
  event.preventDefault();
  zoom = Math.min(2.5, Math.max(0.4, zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
  applyTransform();
}, { passive: false });

let dragging = false;
let draggingNode = null;
let dragOffset = { x: 0, y: 0 };
let lastX = 0;
let lastY = 0;

function scenePoint(event) {
  const rect = svg.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - panX) / zoom,
    y: (event.clientY - rect.top - panY) / zoom,
  };
}

svg.addEventListener('pointerdown', (event) => {
  const node = event.target.closest?.('.node[data-id]');
  if (node && current?.id === 'graph') {
    draggingNode = node.getAttribute('data-id');
    const position = current.entry
      .layout(current.structure.getState(), viewport())
      .get(draggingNode);
    const point = scenePoint(event);
    dragOffset = position
      ? { x: position.x - point.x, y: position.y - point.y }
      : { x: 0, y: 0 };
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  svg.setPointerCapture(event.pointerId);
});
svg.addEventListener('pointermove', (event) => {
  if (draggingNode) {
    const point = scenePoint(event);
    const state = current.structure.getState();
    state.pinned = state.pinned ?? {};
    state.pinned[draggingNode] = {
      x: point.x + dragOffset.x,
      y: point.y + dragOffset.y,
    };
    draw();
    return;
  }
  if (!dragging) return;
  panX += event.clientX - lastX;
  panY += event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  applyTransform();
});
function endDrag() {
  dragging = false;
  draggingNode = null;
}
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);

window.addEventListener('resize', scheduleRefit);

window.addEventListener('hashchange', () => {
  const id = window.location.hash.replace(/^#\/?/, '');
  if (id && id !== current?.id) load(id);
});

initBackground();
buildNav();
applySidebarState();
applyDockState();
positionEdgeToggles();
const initial = window.location.hash.replace(/^#\/?/, '');
load(registry[initial] ? initial : Object.keys(registry)[0]);
