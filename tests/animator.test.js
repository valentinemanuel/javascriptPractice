import test from 'node:test';
import assert from 'node:assert/strict';
import { Animator } from '../js/core/Animator.js';

function* steps(count) {
  for (let index = 0; index < count; index += 1) {
    yield { type: 'tick', message: `Step ${index}.` };
  }
  return 'finished';
}

test('natural completion emits a final status with no active iterator', async () => {
  const statuses = [];
  let resolveDone;
  const finished = new Promise((resolve) => { resolveDone = resolve; });
  const animator = new Animator({
    baseDelay: 1,
    onStatus: (status) => statuses.push(status),
    onDone: (value) => resolveDone(value),
  });

  animator.load(steps(3));
  animator.play();
  assert.equal(await finished, 'finished');

  assert.equal(animator.iterator, null);
  assert.equal(animator.playing, false);
  const last = statuses.at(-1);
  assert.equal(last.active, false, 'the final status must disable Step');
  assert.equal(last.playing, false, 'the final status must restore the Play label');
});

test('step advances exactly one step and keeps playback paused', () => {
  const seen = [];
  const statuses = [];
  const animator = new Animator({
    onStep: (step) => seen.push(step),
    onStatus: (status) => statuses.push(status),
  });

  animator.load(steps(3));
  animator.step();
  animator.step();

  assert.equal(seen.length, 2);
  assert.deepEqual(seen.map((step) => step.type), ['tick', 'tick']);
  assert.equal(animator.playing, false);
  assert.equal(statuses.at(-1).active, true);
});

test('pause and stop leave the animator idle', () => {
  const animator = new Animator({ baseDelay: 100 });
  animator.load(steps(3));
  animator.play();
  assert.equal(animator.playing, true);
  animator.pause();
  assert.equal(animator.playing, false);
  assert.equal(animator.iterator !== null, true);

  animator.stop();
  assert.equal(animator.iterator, null);
  assert.equal(animator.playing, false);
});

test('setSpeed clamps to the supported range', () => {
  const animator = new Animator();
  animator.setSpeed(99);
  assert.equal(animator.speed, 4);
  animator.setSpeed(-5);
  assert.equal(animator.speed, 0.25);
  animator.setSpeed('nonsense');
  assert.equal(animator.speed, 1);
});
