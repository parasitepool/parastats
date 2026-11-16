import assert from 'node:assert/strict';
import test from 'node:test';
import { sortTableData } from './sort';

interface Row {
  height: number;
  label: string | null;
}

const rows: Row[] = [
  { height: 10, label: 'b' },
  { height: 2, label: null },
  { height: 1, label: 'a' },
];

test('sorts numeric values in both directions', () => {
  assert.deepEqual(
    sortTableData(rows, 'height', 'asc').map((row) => row.height),
    [1, 2, 10],
  );
  assert.deepEqual(
    sortTableData(rows, 'height', 'desc').map((row) => row.height),
    [10, 2, 1],
  );
});

test('keeps null values last regardless of direction', () => {
  assert.deepEqual(
    sortTableData(rows, 'label', 'asc').map((row) => row.label),
    ['a', 'b', null],
  );
  assert.deepEqual(
    sortTableData(rows, 'label', 'desc').map((row) => row.label),
    ['b', 'a', null],
  );
});

test('preserves input order without a column and does not mutate', () => {
  const snapshot = rows.map((row) => ({ ...row }));

  assert.deepEqual(sortTableData(rows, undefined, 'desc'), rows);
  assert.deepEqual(rows, snapshot);
});
