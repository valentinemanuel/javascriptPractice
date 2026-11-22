/**
 * Shared contract for every data structure.
 * Subclasses own their state and must not touch the DOM.
 */
export class BaseStructure {
  constructor(meta, state) {
    this.meta = meta;
    this.state = state;
    this._idCounter = 0;
  }

  getState() {
    return this.state;
  }

  initialState() {
    return {};
  }

  reset(values = []) {
    this._resetIds();
    this.state = this.initialState();
    this.seed(values);
    return this;
  }

  seed(_values = []) {
    throw new Error('seed() must be implemented by each structure');
  }

  /** Empties the structure completely, keeping its structural defaults. */
  clear() {
    return this.reset();
  }

  /** Replaces the canonical state with a previously exported one. */
  restore(state) {
    this.state = JSON.parse(JSON.stringify(state));
    this._resetIds();
    this._reserveIds(this.state);
    return this;
  }

  _reserveIds(value) {
    let highest = 0;
    const visit = (item) => {
      if (Array.isArray(item)) {
        item.forEach(visit);
      } else if (item && typeof item === 'object') {
        if (typeof item.id === 'string') {
          const match = item.id.match(/\d+$/);
          if (match) highest = Math.max(highest, Number(match[0]));
        }
        Object.values(item).forEach(visit);
      }
    };
    visit(value);
    this._idCounter = Math.max(this._idCounter, highest);
  }

  _resetIds() {
    this._idCounter = 0;
  }

  _createId(prefix = 'n') {
    this._idCounter += 1;
    return `${prefix}${this._idCounter}`;
  }
}
