/**
 * Renders the Omega / Theta / Big O metadata declared by each structure.
 */
const COLUMNS = [
  { key: 'best', label: 'Best', notation: 'Ω' },
  { key: 'average', label: 'Average', notation: 'Θ' },
  { key: 'worst', label: 'Worst', notation: 'O' },
];

export function complexityFor(meta, operation) {
  return meta?.operations?.[operation] ?? null;
}

export function renderComplexity(container, meta, activeOperation = null, compact = false) {
  if (!container) return;
  container.replaceChildren();

  const operations = Object.entries(meta?.operations ?? {});
  const visible = compact
    ? operations.filter(([name]) => name === activeOperation)
    : operations;
  const rows = visible.length > 0 ? visible : operations.slice(0, 1);

  const table = document.createElement('table');
  table.className = 'complexity-table';

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const title of ['Operation', 'Best Ω', 'Average Θ', 'Worst O']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = title;
    headRow.append(th);
  }
  head.append(headRow);
  table.append(head);

  const body = document.createElement('tbody');
  for (const [name, operation] of rows) {
    const row = document.createElement('tr');
    if (name === activeOperation) row.classList.add('is-active');

    const nameCell = document.createElement('th');
    nameCell.scope = 'row';
    nameCell.textContent = operation.signature ?? name;
    row.append(nameCell);

    for (const column of COLUMNS) {
      const cell = document.createElement('td');
      const value = operation[column.key] ?? {};
      const symbol = document.createElement('strong');
      symbol.textContent = value.symbol ?? '—';
      const note = document.createElement('small');
      note.textContent = value.text ?? '';
      cell.append(symbol, note);
      row.append(cell);
    }
    body.append(row);
  }
  table.append(body);
  container.append(table);

  const active = complexityFor(meta, activeOperation);
  if (active) {
    const note = document.createElement('p');
    note.className = 'complexity-note';
    note.textContent = active.description ?? '';
    container.append(note);
  }
  if (compact && operations.length > 1) {
    const hint = document.createElement('p');
    hint.className = 'complexity-note';
    hint.textContent = `${operations.length} operations available — use “Show all” to compare every bound.`;
    container.append(hint);
  }
}
