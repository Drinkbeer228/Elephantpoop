import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../coprology.js');
const ErsStation = require('../station-link.js');

function memory() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v), data };
}

test('сита только от крупного к мелкому: 4 → 2 → 1 мм; не по порядку — ошибка', () => {
  const run = C.createRun();
  assert.deepEqual(C.washSieve(run, 1), { ok: false, reason: 'order', expected: 4 });
  assert.equal(run.mistakes, 1);
  assert.equal(C.washSieve(run, 4).retainedPct, 38);
  assert.equal(C.washSieve(run, 2).ok, true);
  const last = C.washSieve(run, 1);
  assert.equal(last.finished, true);
  assert.equal(run.step, 'microscope');
  const f = C.SAMPLE.fractions;
  assert.equal(f[4] + f[2] + f[1] + f.fines, 100);
});

test('поле зрения одинаково при каждой загрузке, преобладают волокна 10–20 мм', () => {
  const a = C.fieldOfView();
  assert.deepEqual(a, C.fieldOfView());
  assert.equal(C.dominantClass(a), '10-20');
  for (const fib of a) assert.equal(typeof C.lengthClassOf(fib.lengthMm), 'string');
  assert.ok(C.meanLength(a) > 5 && C.meanLength(a) < 20);
});

test('pH 6,8 — норма ферментации; ацидоз ниже 6,2, слабая ферментация выше 7,0', () => {
  assert.equal(C.phReading(6.8), 'norm');
  assert.equal(C.phReading(5.6), 'acid');
  assert.equal(C.phReading(7.4), 'alk');
});

function passAll(run, mistakes = 0) {
  for (let i = 0; i < mistakes; i++) C.washSieve(run, 1);
  for (const mm of C.SIEVES) C.washSieve(run, mm);
  C.pickFiberClass(run, C.dominantClass(run.fibers));
  C.readStrip(run, C.SAMPLE_PH);
  return C.interpret(run, 'norm');
}

test('без ошибок — 100 баллов; каждая ошибка −10, не ниже 40; шаги не перепрыгнуть', () => {
  const skip = C.createRun();
  assert.equal(C.interpret(skip, 'norm').reason, 'step');
  assert.equal(C.castPaperSheet(skip).ok, false);
  assert.equal(passAll(C.createRun()).score, 100);
  assert.equal(passAll(C.createRun(), 2).score, 80);
  assert.equal(passAll(C.createRun(), 9).score, 40);
});

test('сводка для станции: coprology/fiber-analysis = analysis/done/score, лист бумаги — отдельной практикой', () => {
  const run = C.createRun();
  assert.deepEqual(C.summaryItems(run, 'T'), {});
  passAll(run);
  assert.deepEqual(C.summaryItems(run, '2026-11-15T10:00:00.000Z'), {
    'coprology/fiber-analysis': { kind: 'analysis', status: 'done', at: '2026-11-15T10:00:00.000Z', score: 100 },
  });
  const sheet = C.castPaperSheet(run);
  assert.ok(sheet.gsm >= 120 && sheet.gsm <= 300, `ручной отлив: ${sheet.gsm} г/м²`);
  assert.equal(C.summaryItems(run, 'T')['coprology/paper-sheet'].kind, 'practice');
});

test('запись анализа в ers_progress_v1:biolab переживает пересчёт курса; лучший балл не понижается', () => {
  const s = memory();
  assert.equal(ErsStation.recordItem('coprology/fiber-analysis', { kind: 'analysis', status: 'done', at: '2026-11-15T10:00:00.000Z', score: 100 }, s), true);
  ErsStation.writeSummary({ modules: { 'mod-3': { isCompleted: true, completedAt: '2026-11-15T09:00:00.000Z', score: 90 } } }, s);
  const sum = JSON.parse(s.getItem(ErsStation.KEY));
  assert.equal(sum.schema, 'ers.progress/1');
  assert.equal(sum.module, 'biolab');
  assert.deepEqual(sum.items['coprology/fiber-analysis'], { kind: 'analysis', status: 'done', at: '2026-11-15T10:00:00.000Z', score: 100 });
  assert.equal(sum.items['mod-3'].kind, 'module');
  assert.equal(sum.updatedAt, '2026-11-15T10:00:00.000Z');

  ErsStation.recordItem('coprology/fiber-analysis', { kind: 'analysis', status: 'done', at: '2026-11-15T11:00:00.000Z', score: 70 }, s);
  assert.equal(JSON.parse(s.getItem(ErsStation.KEY)).items['coprology/fiber-analysis'].score, 100);
  assert.equal(ErsStation.recordItem('coprology/fiber-analysis', { kind: 'analysis', status: 'started', at: '2026-11-15T12:00:00.000Z' }, s), false);
  assert.equal(ErsStation.recordItem('bad id!', { kind: 'analysis', status: 'done', at: 'T' }, s), false);
});
