import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ErsStation = require('../station-link.js');

test('сводка ers.progress/1: только модули с датой прохождения', () => {
  const s = ErsStation.toSummary({
    modules: {
      'mod-1-demo': { isCompleted: true, score: 100 },
      'mod-3-real': { isCompleted: true, score: 100, completedAt: '2026-11-14T10:00:00.000Z' },
      'mod-4-open': { isCompleted: false, completedAt: '2026-11-14T11:00:00.000Z' },
    },
  }, '2026-11-14T00:00:00.000Z');
  assert.deepEqual(s, {
    schema: 'ers.progress/1',
    module: 'biolab',
    updatedAt: '2026-11-14T10:00:00.000Z',
    items: { 'mod-3-real': { kind: 'module', status: 'done', at: '2026-11-14T10:00:00.000Z', score: 100 } },
  });
});

test('мусор вместо прогресса — пустая сводка; отказ памяти не бросает', () => {
  assert.deepEqual(ErsStation.toSummary(null, '2026-11-14T00:00:00.000Z').items, {});
  const data = new Map();
  ErsStation.writeSummary({ modules: {} }, { setItem: (k, v) => data.set(k, v) });
  assert.equal(JSON.parse(data.get(ErsStation.KEY)).module, 'biolab');
  assert.doesNotThrow(() => ErsStation.writeSummary({ modules: {} }, { setItem: () => { throw new Error('quota'); } }));
});
