/**
 * Drives generator-based operations and exposes play / pause / step controls.
 * A single cancellable timer avoids re-entrancy when operations are retriggered.
 */
export class Animator {
  constructor({ onStep, onDone, onStatus, speed = 1, baseDelay = 520 } = {}) {
    this.onStep = onStep;
    this.onDone = onDone;
    this.onStatus = onStatus;
    this.speed = speed;
    this.baseDelay = baseDelay;
    this.iterator = null;
    this.playing = false;
    this._timer = null;
    this._token = 0;
  }

  status() {
    return {
      playing: this.playing,
      active: Boolean(this.iterator),
      speed: this.speed,
    };
  }

  _emitStatus() {
    this.onStatus?.(this.status());
  }

  setSpeed(value) {
    const parsed = Number(value);
    this.speed = Number.isFinite(parsed) ? Math.min(4, Math.max(0.25, parsed)) : 1;
    if (this.playing) this._schedule();
    this._emitStatus();
  }

  load(iterator) {
    this.stop();
    this.iterator = iterator;
    this._emitStatus();
  }

  play() {
    if (!this.iterator || this.playing) return;
    this.playing = true;
    this._advance();
    if (this.playing) this._schedule();
    this._emitStatus();
  }

  pause() {
    this.playing = false;
    clearTimeout(this._timer);
    this._timer = null;
    this._emitStatus();
  }

  stop() {
    this._token += 1;
    this.playing = false;
    clearTimeout(this._timer);
    this._timer = null;
    this.iterator = null;
    this._emitStatus();
  }

  step() {
    if (!this.iterator) return;
    this.playing = false;
    clearTimeout(this._timer);
    this._timer = null;
    this._advance();
    this._emitStatus();
  }

  _schedule() {
    clearTimeout(this._timer);
    const token = this._token;
    this._timer = setTimeout(() => {
      if (token !== this._token || !this.playing || !this.iterator) return;
      if (this._advance()) return;
      this._schedule();
    }, this.baseDelay / this.speed);
  }

  _advance() {
    if (!this.iterator) return true;
    const result = this.iterator.next();
    if (result.done) {
      this.iterator = null;
      this.playing = false;
      clearTimeout(this._timer);
      this._timer = null;
      this.onDone?.(result.value);
      return true;
    }
    this.onStep?.(result.value);
    return false;
  }
}
