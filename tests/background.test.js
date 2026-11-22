import test from 'node:test';
import assert from 'node:assert/strict';
import { initBackground } from '../js/ui/background.js';

function createEnvironment({ reduce = false, dpr = 1, width = 900, height = 600 } = {}) {
  const listeners = {};
  let frameCallback = null;
  let themeCallback = null;
  let motionCallback = null;
  let observerActive = true;
  let removed = false;

  const context = {
    gradients: [],
    arcs: 0,
    transforms: [],
    setTransform(...args) { this.transforms.push(args); },
    clearRect() {},
    beginPath() {},
    arc() { this.arcs += 1; },
    fill() {},
    fillRect() {},
    createRadialGradient(...args) {
      const gradient = { args, stops: [] };
      gradient.addColorStop = (offset, color) => gradient.stops.push(color);
      this.gradients.push(gradient);
      return gradient;
    },
  };

  const canvas = {
    id: '',
    width: 0,
    height: 0,
    style: {},
    attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    getContext() { return context; },
    remove() { removed = true; },
  };

  globalThis.document = {
    documentElement: { dataset: { theme: 'dark' } },
    body: { prepend() {} },
    createElement() { return canvas; },
  };

  globalThis.window = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: dpr,
    matchMedia(query) {
      return {
        matches: query.includes('prefers-reduced-motion') ? reduce : false,
        addEventListener(type, handler) {
          if (type === 'change') motionCallback = handler;
        },
        removeEventListener(type) {
          if (type === 'change') motionCallback = null;
        },
      };
    },
    addEventListener(type, handler) { (listeners[type] ??= []).push(handler); },
    removeEventListener(type, handler) {
      listeners[type] = (listeners[type] ?? []).filter((item) => item !== handler);
    },
    requestAnimationFrame(handler) { frameCallback = handler; return 1; },
    cancelAnimationFrame() { frameCallback = null; },
  };

  globalThis.MutationObserver = class {
    constructor(handler) { themeCallback = handler; }
    observe() { observerActive = true; }
    disconnect() { themeCallback = null; observerActive = false; }
  };

  return {
    canvas,
    context,
    listeners,
    flushFrame() {
      const callback = frameCallback;
      frameCallback = null;
      callback?.();
    },
    changeTheme(theme) {
      document.documentElement.dataset.theme = theme;
      if (observerActive) themeCallback?.();
    },
    changeMotion(matches) { motionCallback?.({ matches }); },
    resizeTo(nextWidth, nextHeight) {
      window.innerWidth = nextWidth;
      window.innerHeight = nextHeight;
      listeners.resize[0]?.();
    },
    wasRemoved() { return removed; },
    hasFrame() { return frameCallback !== null; },
  };
}

test('background mounts a sized canvas behind the interface', () => {
  const env = createEnvironment();
  const teardown = initBackground();
  assert.equal(env.canvas.id, 'bg-canvas');
  assert.equal(env.canvas.attributes['aria-hidden'], 'true');
  assert.equal(env.canvas.width, 900);
  assert.equal(env.canvas.height, 600);
  teardown();
});

test('particles and radial glow follow the pointer smoothly', () => {
  const env = createEnvironment();
  const teardown = initBackground();

  env.flushFrame();
  const initialArcs = env.context.arcs;
  assert.ok(initialArcs > 0, 'a uniform particle grid must be drawn');
  const initialCenter = env.context.gradients.at(-1).args[0];

  env.listeners.mousemove[0]({ clientX: 800, clientY: 400 });
  env.flushFrame();
  const movedCenter = env.context.gradients.at(-1).args[0];
  assert.ok(movedCenter > initialCenter, 'the glow must ease toward the pointer');
  assert.ok(movedCenter < 800, 'the glow must ease, not jump');
  assert.ok(env.context.arcs > initialArcs, 'particles must be redrawn each frame');

  teardown();
});

test('theme switches swap the glow palette', () => {
  const env = createEnvironment();
  const teardown = initBackground();

  env.flushFrame();
  assert.match(env.context.gradients.at(-1).stops[0], /88, 166, 255/);

  env.changeTheme('light');
  env.flushFrame();
  assert.match(env.context.gradients.at(-1).stops[0], /9, 105, 218/);

  teardown();
});

test('reduced motion snaps the glow, skips the loop and still repaints on theme changes', () => {
  const env = createEnvironment({ reduce: true });
  const teardown = initBackground();

  assert.equal(env.hasFrame(), false, 'no animation loop should be scheduled');
  assert.ok(env.context.arcs > 0, 'a static frame should still be drawn');
  const before = env.context.gradients.length;

  env.listeners.mousemove[0]({ clientX: 640, clientY: 360 });
  assert.equal(env.context.gradients.at(-1).args[0], 640);
  assert.equal(env.context.gradients.at(-1).args[1], 360);
  assert.equal(env.context.gradients.length, before + 1);

  env.changeTheme('light');
  assert.match(env.context.gradients.at(-1).stops[0], /9, 105, 218/);

  env.changeMotion(false);
  assert.equal(env.hasFrame(), true, 'disabling reduce-motion must start the loop');

  teardown();
});

test('DPR is capped at 2x and resize rebuilds the grid', () => {
  const env = createEnvironment({ dpr: 3 });
  const teardown = initBackground();

  assert.equal(env.canvas.width, 1800);
  assert.equal(env.canvas.height, 1200);
  assert.deepEqual(env.context.transforms[0], [2, 0, 0, 2, 0, 0]);

  env.flushFrame();
  const before = env.context.arcs;
  env.resizeTo(1200, 700);
  assert.equal(env.canvas.width, 2400);
  assert.equal(env.canvas.height, 1400);
  env.flushFrame();
  assert.ok(env.context.arcs > before, 'the particle grid must be rebuilt for the new size');

  teardown();
});

test('teardown removes listeners, observer, frame and canvas', () => {
  const env = createEnvironment();
  const teardown = initBackground();
  const gradientsBefore = env.context.gradients.length;

  teardown();
  env.changeTheme('light');

  assert.equal(env.hasFrame(), false);
  assert.equal(env.listeners.mousemove.length, 0);
  assert.equal(env.listeners.resize.length, 0);
  assert.equal(env.context.gradients.length, gradientsBefore, 'theme observer must be disconnected');
  assert.equal(env.wasRemoved(), true);
});
