import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFitTransform } from '../js/core/fit.js';

test('fit transform centres the drawing in the available area', () => {
  const result = computeFitTransform(
    { x: 100, y: 80, width: 300, height: 200 },
    { width: 900, height: 560, top: 0, bottom: 460, maxScale: 1.35 },
  );

  assert.ok(result);
  assert.equal(result.scale, 1.35);
  assert.equal(result.translateX, 450 - 250 * 1.35);
  assert.equal(result.translateY, (444 / 2) - 180 * 1.35);
});

test('fit transform shrinks large structures and never exceeds the max scale', () => {
  const shrunk = computeFitTransform(
    { x: 0, y: 0, width: 1200, height: 800 },
    { width: 900, height: 560, top: 0, bottom: 460, maxScale: 1.35 },
  );
  assert.ok(shrunk.scale < 1);
  assert.ok(shrunk.scale <= 1.35);

  const tiny = computeFitTransform(
    { x: 0, y: 0, width: 20, height: 20 },
    { width: 900, height: 560, top: 0, bottom: 460, maxScale: 1.35 },
  );
  assert.equal(tiny.scale, 1.35);
});

test('fit transform accounts for the top banner and bottom dock', () => {
  const result = computeFitTransform(
    { x: 0, y: 0, width: 400, height: 300 },
    { width: 900, height: 560, top: 60, bottom: 400, maxScale: 1.35 },
  );
  const availableHeight = 400 - 60 - 16;
  assert.equal(result.scale, availableHeight / 300);
  assert.equal(result.translateY, 60 + availableHeight / 2 - 150 * result.scale);
});

test('fit transform returns null for an empty bounding box', () => {
  assert.equal(computeFitTransform({ x: 0, y: 0, width: 0, height: 0 }, { width: 900 }), null);
  assert.equal(computeFitTransform(null, { width: 900 }), null);
});
