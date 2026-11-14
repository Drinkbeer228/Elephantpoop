import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const LabMath = require('../lab-math.js');
const MODULES = require('../modules-data.js');

test('Mass balance & ΔN calculation matches NotebookLM Block 1 specification', () => {
  // 1 kg raw dry-season substrate (W=0.70, C=0.50, N=0.010), soil=0, target C:N = 20:1
  const res = LabMath.calculateMassBalance({
    profileKey: 'raw-dry',
    mSoil: 0,
    mSub: 1,
    targetCn: 20,
    hMulch: 3.0
  });

  assert.ok(Math.abs(res.mSubDry - 0.3) < 1e-6);
  assert.ok(Math.abs(res.cnMix - 50.0) < 1e-6);
  assert.ok(Math.abs(res.deltaNGrams - 4.5) < 1e-4);
  assert.ok(Math.abs(res.ureaGrams - 9.7826) < 0.02);

  // Penman-Monteith evaporation attenuation at h = 3.0 cm: E = 6.0 * exp(-0.38 * 3) = 1.919...
  assert.ok(Math.abs(res.E - 1.919) < 0.01);
  assert.ok(res.evapReductionPct > 67.5 && res.evapReductionPct < 68.5);
});

test('Alkaline delignification simulator achieves benchmark at 2.0% NaOH, 100°C, 300 min, 0.40 Musa', () => {
  const res = LabMath.calculatePaperDelignification({
    naoh: 2.0,
    temp: 100,
    timeMin: 300,
    musaRatio: 0.40
  });

  assert.ok(res.ligninRemovalPercent >= 70);
  assert.ok(res.fiberDamageAlphaLossPercent <= 8);
  assert.ok(res.residualOdorIndex <= 0.5);
  assert.ok(res.sheetTensileStrengthMPa >= 28);
});

test('Overcooking triggers alpha-cellulose degradation > 8%', () => {
  const res = LabMath.calculatePaperDelignification({
    naoh: 3.8,
    temp: 108,
    timeMin: 420,
    musaRatio: 0.40
  });

  assert.ok(res.fiberDamageAlphaLossPercent > 8);
});

test('Слонология.EDU has 51 unique, non-stubbed modules with valid quizzes and required IDs', () => {
  assert.equal(MODULES.length, 51);

  const seenIdx = new Set<number>();
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const seenQuestions = new Set<string>();

  for (let i = 0; i < MODULES.length; i++) {
    const m = MODULES[i];
    assert.equal(m.moduleIndex, i + 1);
    assert.ok(!seenIdx.has(m.moduleIndex));
    assert.ok(!seenIds.has(m.id));
    assert.ok(!seenTitles.has(m.title));
    assert.ok(!seenQuestions.has(m.quiz.question));

    seenIdx.add(m.moduleIndex);
    seenIds.add(m.id);
    seenTitles.add(m.title);
    seenQuestions.add(m.quiz.question);

    assert.ok(m.scientificContext.length >= 150, `Module ${m.moduleIndex} context too short`);
    assert.ok(!m.scientificContext.includes('Академический модуль №'), `Module ${m.moduleIndex} still uses stub context`);
    assert.ok(!m.quiz.question.includes('Аттестационный вопрос модуля №'), `Module ${m.moduleIndex} still uses stub quiz`);
    assert.ok(Array.isArray(m.requiredReadings) && m.requiredReadings.length >= 2);
    assert.equal(m.quiz.options.length, 3);
    assert.ok(m.quiz.correctAnswer >= 0 && m.quiz.correctAnswer <= 2);
    assert.ok(m.quiz.explanation.length >= 40);
  }

  // Verify achievement-referenced module IDs exist
  const requiredIds = [
    'mod-1-hindgut-biomechanics',
    'mod-2-soil-microbiome-rhizosphere',
    'mod-2-soil-water-holding-capacity',
    'mod-3-thermophilic-sanitation',
    'mod-3-alkaline-delignification',
    'mod-9-46-human-elephant-conflict-mitigation',
    'mod-9-47-cites-mike-and-anti-poaching-monitoring'
  ];
  for (const id of requiredIds) {
    assert.ok(seenIds.has(id), `Missing achievement-linked module ID: ${id}`);
  }
});
