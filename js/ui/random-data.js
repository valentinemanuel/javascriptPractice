/**
 * Generates fresh demo data for the currently selected structure.
 */

const WORDS = ['cat', 'car', 'dog', 'door', 'tree', 'trie', 'heap', 'hash', 'node', 'list', 'sort', 'stack'];
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function drain(iterator) {
  for (const _step of iterator) { /* apply the generator without animating it */ }
}

export function randomValuesFor(id) {
  if (id === 'trie') {
    return [...WORDS].sort(() => Math.random() - 0.5).slice(0, randomInt(4, 6));
  }
  const count = randomInt(6, 9);
  return Array.from({ length: count }, () => randomInt(10, 99));
}

function fillGraph(graph) {
  for (const node of [...graph.getState().nodes]) {
    drain(graph.removeVertex(node.value));
  }

  const count = randomInt(5, 7);
  const labels = LABELS.slice(0, count);
  for (const label of labels) drain(graph.addVertex(label));

  for (let index = 0; index < labels.length - 1; index += 1) {
    drain(graph.addEdge(labels[index], labels[index + 1], randomInt(1, 9)));
  }
  for (let from = 0; from < labels.length; from += 1) {
    for (let to = from + 2; to < labels.length; to += 1) {
      if (Math.random() < 0.25) {
        drain(graph.addEdge(labels[from], labels[to], randomInt(1, 9)));
      }
    }
  }
}

/**
 * Replaces the current structure contents with a new random dataset.
 * @param {object} structure an initialized structure instance
 * @param {string} id registry id of that structure
 */
export function applyRandomData(structure, id) {
  if (id === 'graph') {
    fillGraph(structure);
    return;
  }
  structure.reset(randomValuesFor(id));
}
