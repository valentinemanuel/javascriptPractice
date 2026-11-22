import { registry } from './registry.js';
import { Animator } from './core/Animator.js';
import { render } from './core/renderers/svg.js';
import { renderComplexity } from './core/complexity.js';

const byId = (id) => document.getElementById(id);
const svg = byId('stage');
const nav = byId('structure-nav');
const title = byId('structure-title');
const description = byId('structure-description');
const toolbar = byId('operation-buttons');
const complexityPanel = byId('complexity');
const logList = byId('log');
const fields = byId('fields');
const playPause = byId('play-pause');
const stepButton = byId('step');
const resetButton = byId('reset');
const speedInput = byId('speed');
const speedValue = byId('speed-value');

let current = null;
let activeOperation = null;

let zoom = 1;
let panX = 0;
let panY = 0;

const animator = new Animator({
  onStep(step) {
    draw(step);
    appendLog(step.message, step.type);
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
  return { width: svg.clientWidth || 900, height: svg.clientHeight || 560 };
}

function applyTransform() {
  const scene = svg.querySelector('#scene');
  if (scene) scene.setAttribute('transform', `translate(${panX} ${panY}) scale(${zoom})`);
}

function draw(step = {}) {
  if (!current) return;
  const state = current.structure.getState();
  const positions = current.entry.layout(state, viewport());
  render(svg, state, positions, step);
  applyTransform();
}

function appendLog(message, type = 'info') {
  if (!message) return;
  const item = document.createElement('li');
  item.className = `is-${type}`;
  item.textContent = message;
  logList.prepend(item);
  while (logList.children.length > 80) logList.lastElementChild.remove();
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
  const operations = current.structure.meta.operations ?? {};
  for (const [name, operation] of Object.entries(operations)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = operation.label ?? name;
    button.addEventListener('click', () => runOperation(name, operation));
    toolbar.append(button);
  }
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
  renderComplexity(complexityPanel, structure.meta, activeOperation);
  animator.load(iterator);
  animator.play();
}

function load(id) {
  const entry = registry[id];
  if (!entry) return;

  animator.stop();
  const structure = new entry.Structure();
  structure.reset(structure.meta.demo ?? []);
  current = { id, entry, structure };
  activeOperation = null;

  if (window.location.hash !== `#/${id}`) window.location.hash = `#/${id}`;
  title.textContent = structure.meta.title;
  description.textContent = structure.meta.description;
  svg.setAttribute('aria-label', `${structure.meta.title} visualization`);

  for (const button of nav.querySelectorAll('.structure-link')) {
    button.classList.toggle('is-active', button.dataset.id === id);
  }

  buildToolbar();
  renderComplexity(complexityPanel, structure.meta);
  clearLog();
  appendLog(`Loaded ${structure.meta.title}.`, 'info');
  draw();
}

playPause.addEventListener('click', () => {
  if (animator.playing) animator.pause();
  else animator.play();
});

stepButton.addEventListener('click', () => animator.step());

resetButton.addEventListener('click', () => {
  if (!current) return;
  animator.stop();
  current.structure.reset(current.structure.meta.demo ?? []);
  activeOperation = null;
  renderComplexity(complexityPanel, current.structure.meta);
  clearLog();
  appendLog('Structure reset to its demo state.', 'info');
  draw();
});

speedInput.addEventListener('input', () => {
  animator.setSpeed(speedInput.value);
  speedValue.textContent = `${animator.speed}×`;
});

byId('reset-zoom').addEventListener('click', () => {
  zoom = 1;
  panX = 0;
  panY = 0;
  applyTransform();
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
let lastX = 0;
let lastY = 0;
svg.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  svg.setPointerCapture(event.pointerId);
});
svg.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  panX += event.clientX - lastX;
  panY += event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  applyTransform();
});
svg.addEventListener('pointerup', () => { dragging = false; });

window.addEventListener('hashchange', () => {
  const id = window.location.hash.replace(/^#\/?/, '');
  if (id && id !== current?.id) load(id);
});

buildNav();
const initial = window.location.hash.replace(/^#\/?/, '');
load(registry[initial] ? initial : Object.keys(registry)[0]);
