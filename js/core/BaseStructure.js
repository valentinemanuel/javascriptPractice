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

  _resetIds() {
    this._idCounter = 0;
  }

  _createId(prefix = 'n') {
    this._idCounter += 1;
    return `${prefix}${this._idCounter}`;
  }
}
