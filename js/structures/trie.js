import { BaseStructure } from '../core/BaseStructure.js';

export const meta = {
  id: 'trie',
  title: 'Trie',
  group: 'Trees',
  layout: 'tree',
  description: 'A prefix tree that stores words one character per edge. Every operation follows a single path from the root, so its cost depends only on the word length L and never on the total number of stored words; each node branches over at most the alphabet size.',
  demo: ['cat', 'car', 'dog', 'door'],
  operations: {
    insert: {
      signature: 'insert(word)',
      label: 'Insert',
      fields: [{ name: 'word', label: 'Word', type: 'string', placeholder: 'e.g. cat' }],
      description: 'Adds a word by walking from the root and creating one node per missing character, then marking the final node as a complete word.',
      best: { symbol: 'Ω(L)', text: 'the path already exists, so only the terminal mark is checked' },
      average: { symbol: 'Θ(L)', text: 'one step per character of the word' },
      worst: { symbol: 'O(L)', text: 'one new node per character; branching is independent of the total word count' },
    },
    search: {
      signature: 'search(word)',
      label: 'Search',
      fields: [{ name: 'word', label: 'Word', type: 'string', placeholder: 'e.g. cat' }],
      description: 'Follows the path spelled by the word and reports success only when the final node carries a complete-word mark.',
      best: { symbol: 'Ω(L)', text: 'the path is present from the first character' },
      average: { symbol: 'Θ(L)', text: 'one step per character of the word' },
      worst: { symbol: 'O(L)', text: 'the path breaks or ends early; branching is independent of the total word count' },
    },
    startsWith: {
      signature: 'startsWith(prefix)',
      label: 'Starts with',
      fields: [{ name: 'prefix', label: 'Prefix', type: 'string', placeholder: 'e.g. ca' }],
      description: 'Checks whether any stored word begins with the given prefix by walking the corresponding path; the final node need not be terminal.',
      best: { symbol: 'Ω(L)', text: 'the prefix path is present from the first character' },
      average: { symbol: 'Θ(L)', text: 'one step per character of the prefix' },
      worst: { symbol: 'O(L)', text: 'the path breaks early; branching is independent of the total word count' },
    },
    delete: {
      signature: 'delete(word)',
      label: 'Delete',
      fields: [{ name: 'word', label: 'Word', type: 'string', placeholder: 'e.g. cat' }],
      description: 'Removes the complete-word mark and prunes any nodes on the suffix that are no longer used by another word.',
      best: { symbol: 'Ω(L)', text: 'the word is absent at the first character or the suffix is still shared' },
      average: { symbol: 'Θ(L)', text: 'walk the word path and prune unused suffix nodes' },
      worst: { symbol: 'O(L)', text: 'every suffix node is pruned; branching is independent of the total word count' },
    },
  },
};

export class Trie extends BaseStructure {
  static meta = meta;

  constructor() {
    super(meta, { root: null, nodes: [], edges: [] });
    this.seed([]);
  }

  initialState() {
    return { root: null, nodes: [], edges: [] };
  }

  seed(values = []) {
    if (!this.state.root || !this._nodeById(this.state.root)) {
      const root = { id: this._createId('t'), value: '', terminal: false };
      this.state.root = root.id;
      this.state.nodes.push(root);
    }
    for (const value of values) this._insertWord(String(value));
    return this;
  }

  _nodeById(id) {
    return this.state.nodes.find((node) => node.id === id) ?? null;
  }

  _childFor(fromId, char) {
    const edge = this.state.edges.find((item) => item.from === fromId && item.label === char);
    return edge ? edge.to : null;
  }

  _insertWord(word) {
    let currentId = this.state.root;
    for (const char of Array.from(word)) {
      let nextId = this._childFor(currentId, char);
      if (nextId === null) {
        const node = { id: this._createId('t'), value: char, terminal: false };
        this.state.nodes.push(node);
        this.state.edges.push({ from: currentId, to: node.id, label: char, directed: true });
        nextId = node.id;
      }
      currentId = nextId;
    }
    this._nodeById(currentId).terminal = true;
    return currentId;
  }

  *insert(word) {
    const text = String(word ?? '');
    const chars = Array.from(text);
    let currentId = this.state.root;

    for (let i = 0; i < chars.length; i += 1) {
      const char = chars[i];
      let nextId = this._childFor(currentId, char);
      const created = nextId === null;
      if (created) {
        const node = { id: this._createId('t'), value: char, terminal: false };
        this.state.nodes.push(node);
        this.state.edges.push({ from: currentId, to: node.id, label: char, directed: true });
        nextId = node.id;
      }
      currentId = nextId;
      yield {
        type: 'visit',
        message: created
          ? `Created node ${nextId} for character '${char}' at position ${i + 1} while inserting "${text}".`
          : `Followed the existing node for character '${char}' at position ${i + 1} while inserting "${text}".`,
        focus: [currentId],
      };
    }

    const terminalNode = this._nodeById(currentId);
    const alreadyTerminal = terminalNode.terminal;
    terminalNode.terminal = true;
    yield {
      type: 'insert',
      message: alreadyTerminal
        ? `The word "${text}" was already stored as a complete word.`
        : `Marked node ${currentId} as the end of the word "${text}".`,
      focus: [currentId],
    };
    return currentId;
  }

  *search(word) {
    const text = String(word ?? '');
    const chars = Array.from(text);
    let currentId = this.state.root;

    for (let i = 0; i < chars.length; i += 1) {
      const char = chars[i];
      const nextId = this._childFor(currentId, char);
      if (nextId === null) {
        yield {
          type: 'miss',
          message: `No edge for character '${char}' at position ${i + 1}, so "${text}" is not in the trie.`,
          focus: [currentId],
        };
        return false;
      }
      currentId = nextId;
      yield {
        type: 'visit',
        message: `Visited node ${currentId} for character '${char}' at position ${i + 1} while searching for "${text}".`,
        focus: [currentId],
      };
    }

    if (this._nodeById(currentId).terminal) {
      yield {
        type: 'found',
        message: `Found the complete word "${text}" at node ${currentId}.`,
        focus: [currentId],
      };
      return true;
    }

    yield {
      type: 'miss',
      message: `"${text}" appears only as a prefix in the trie, not as a complete word.`,
      focus: [currentId],
    };
    return false;
  }

  *startsWith(prefix) {
    const text = String(prefix ?? '');
    const chars = Array.from(text);
    let currentId = this.state.root;

    for (let i = 0; i < chars.length; i += 1) {
      const char = chars[i];
      const nextId = this._childFor(currentId, char);
      if (nextId === null) {
        yield {
          type: 'miss',
          message: `No edge for character '${char}' at position ${i + 1}, so no word starts with "${text}".`,
          focus: [currentId],
        };
        return false;
      }
      currentId = nextId;
      yield {
        type: 'visit',
        message: `Visited node ${currentId} for character '${char}' at position ${i + 1} while checking the prefix "${text}".`,
        focus: [currentId],
      };
    }

    yield {
      type: 'found',
      message: `The trie contains at least one word with the prefix "${text}".`,
      focus: [currentId],
    };
    return true;
  }

  *delete(word) {
    const text = String(word ?? '');
    const chars = Array.from(text);
    let currentId = this.state.root;

    for (let i = 0; i < chars.length; i += 1) {
      const char = chars[i];
      const nextId = this._childFor(currentId, char);
      if (nextId === null) {
        yield {
          type: 'miss',
          message: `No edge for character '${char}' at position ${i + 1}, so "${text}" cannot be deleted.`,
          focus: [currentId],
        };
        return false;
      }
      currentId = nextId;
    }

    if (!this._nodeById(currentId).terminal) {
      yield {
        type: 'miss',
        message: `"${text}" is not a complete word in the trie, so nothing was deleted.`,
        focus: [currentId],
      };
      return false;
    }

    this._nodeById(currentId).terminal = false;
    yield {
      type: 'delete',
      message: `Removed the complete-word mark from node ${currentId} for "${text}".`,
      focus: [currentId],
    };

    let cursor = currentId;
    while (cursor !== this.state.root) {
      const node = this._nodeById(cursor);
      const hasChildren = this.state.edges.some((edge) => edge.from === cursor);
      if (node.terminal || hasChildren) break;

      const parentId = this.state.edges.find((edge) => edge.to === cursor)?.from ?? this.state.root;
      yield {
        type: 'remove',
        message: `Pruned the unused node ${cursor} for character '${node.value}' while deleting "${text}".`,
        focus: [cursor, parentId],
      };
      this.state.edges = this.state.edges.filter((edge) => edge.to !== cursor);
      this.state.nodes = this.state.nodes.filter((item) => item.id !== cursor);
      cursor = parentId;
    }

    return true;
  }
}
