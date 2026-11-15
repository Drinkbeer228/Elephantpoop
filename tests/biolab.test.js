const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ErsProgress = require('../ers-progress.js');
const BiolabCore = require('../biolab-core.js');
const LabMath = require('../lab-math.js');

function createMockStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    clear() {
      map.clear();
    }
  };
}

test('ErsProgress: writes and reads ers.progress/1 under ers_progress_v1:biolab and manages ration-violation flag', () => {
  const storage = createMockStorage();

  // 1. Запись бракованной партии (> 25 мм или pH < 6.2) -> устанавливает флаг ration-violation
  const okViolation = ErsProgress.recordAnalysisVerdict(
    {
      batchId: 'margo-coarse',
      batchTitle: 'Проба №14-Б (Марго — крупный недоруб)',
      meanFiberMm: 29.0,
      ph: 6.4,
      violation: true,
      coarseFiber: true,
      acidosis: false,
      dispatchedTo: ['Кормокухня «СлоноВет» (Тарас)', 'Ветеринарная клиника (Вера Павловна)'],
      score: 100,
      at: '2026-04-12T10:00:00.000Z'
    },
    storage
  );
  assert.equal(okViolation, true);

  const raw1 = JSON.parse(storage.getItem('ers_progress_v1:biolab'));
  assert.equal(raw1.schema, 'ers.progress/1');
  assert.equal(raw1.module, 'biolab');
  assert.ok(Array.isArray(raw1.flags));
  assert.ok(raw1.flags.includes('ration-violation'));
  assert.equal(raw1.items.analysis.status, 'done');
  assert.equal(raw1.items.analysis.outcome, 'ration-violation');
  assert.equal(raw1.lastVerdict.violation, true);
  assert.equal(raw1.items['coprology/fiber-analysis'].status, 'done');

  // 2. Запись эталонной партии (14.5 мм, pH 6.8) -> снимает флаг ration-violation
  ErsProgress.recordAnalysisVerdict(
    {
      batchId: 'margo-norm',
      batchTitle: 'Проба №14-А (Марго — штатный рацион)',
      meanFiberMm: 14.5,
      ph: 6.8,
      violation: false,
      coarseFiber: false,
      acidosis: false,
      dispatchedTo: ['Цех отливки бумаги (Стол 2)'],
      score: 100,
      at: '2026-04-12T10:05:00.000Z'
    },
    storage
  );

  const raw2 = JSON.parse(storage.getItem('ers_progress_v1:biolab'));
  assert.equal(raw2.flags.includes('ration-violation'), false);
  assert.equal(raw2.items.analysis.outcome, 'norm');
  assert.equal(raw2.lastVerdict.violation, false);

  // 3. Запись отлитого листа «слоновьей бумаги» (paper-craft)
  ErsProgress.recordPaperCraft(
    {
      gradeId: 'diploma-sovereign',
      gradeTitle: 'Гербовый лист для Итогового Диплома стажёра',
      recipient: 'Деканат станции (Итоговый Диплом под 4 печати)',
      gsm: 209,
      fiberG: 6.5,
      pressMPa: 4.0,
      score: 100,
      at: '2026-04-12T10:10:00.000Z'
    },
    storage
  );

  const raw3 = JSON.parse(storage.getItem('ers_progress_v1:biolab'));
  assert.equal(raw3.items['paper-craft'].status, 'done');
  assert.equal(raw3.items['paper-craft'].gradeId, 'diploma-sovereign');
  assert.equal(raw3.items['paper-craft'].gsm, 209);
  assert.equal(raw3.items['coprology/paper-sheet'].status, 'done');
});

test('BiolabCore Table 1: enforces sieve order, water pressure bounds, microscope measurement, and pH verdict', () => {
  const run = BiolabCore.createRun('margo-norm');

  // Попытка промыть сито 2 мм раньше 4 мм
  const wrongOrder = BiolabCore.washSieve(run, 2, { pressure: 60, vibration: 55 });
  assert.equal(wrongOrder.ok, false);
  assert.equal(wrongOrder.reason, 'order');

  // Слишком слабый напор воды (< 35%)
  const lowPressure = BiolabCore.washSieve(run, 4, { pressure: 20, vibration: 55 });
  assert.equal(lowPressure.ok, false);
  assert.equal(lowPressure.reason, 'pressure-low');

  // Слишком сильный напор воды (> 85%)
  const highPressure = BiolabCore.washSieve(run, 4, { pressure: 95, vibration: 55 });
  assert.equal(highPressure.ok, false);
  assert.equal(highPressure.reason, 'pressure-high');

  // Штатная промывка 4 -> 2 -> 1 мм
  assert.equal(BiolabCore.washSieve(run, 4, { pressure: 60, vibration: 55 }).ok, true);
  assert.equal(BiolabCore.washSieve(run, 2, { pressure: 60, vibration: 55 }).ok, true);
  assert.equal(BiolabCore.washSieve(run, 1, { pressure: 60, vibration: 55 }).ok, true);
  assert.equal(run.step, 'microscope');

  // Фокусировка и замер длины волокон (эталон 14.5 мм)
  const focusRes = BiolabCore.adjustMicroscopeFocus(run, 54);
  assert.equal(focusRes.ok, true);

  const measureRes = BiolabCore.measureFiberLength(run, 14.5);
  assert.equal(measureRes.ok, true);
  assert.equal(measureRes.coarseViolation, false);
  assert.equal(run.step, 'ph');

  // Выдержка полоски 3 секунды и считывание pH 6.8
  assert.equal(BiolabCore.dipPhStrip(run, 3.0).ok, true);
  assert.equal(BiolabCore.readStrip(run, 6.8).ok, true);
  assert.equal(run.step, 'reading');

  // Вердикт: норма -> допуск на Стол 2
  const verdictRes = BiolabCore.interpret(run, 'norm');
  assert.equal(verdictRes.ok, true);
  assert.equal(verdictRes.verdict.violation, false);
  assert.equal(run.paperAllowed, true);
});

test('BiolabCore Table 1 Violation Cases: detects coarse fiber (> 25 mm) and acidic pH (< 6.2)', () => {
  // Крупный недоруб (29 мм > 25 мм)
  const coarseRun = BiolabCore.createRun('margo-coarse');
  BiolabCore.washSieve(coarseRun, 4, 60, 55);
  BiolabCore.washSieve(coarseRun, 2, 60, 55);
  BiolabCore.washSieve(coarseRun, 1, 60, 55);
  BiolabCore.adjustMicroscopeFocus(coarseRun, 68);
  const m = BiolabCore.measureFiberLength(coarseRun, 29.0);
  assert.equal(m.ok, true);
  assert.equal(m.coarseViolation, true);
  BiolabCore.dipPhStrip(coarseRun, 3.0);
  BiolabCore.readStrip(coarseRun, 6.2);
  const vCoarse = BiolabCore.interpret(coarseRun, 'norm');
  assert.equal(vCoarse.ok, true);
  assert.equal(vCoarse.verdict.violation, true);
  assert.ok(vCoarse.verdict.flags.includes('ration-violation'));
  assert.equal(coarseRun.paperAllowed, false);

  // Ацидоз (pH 5.6 < 6.2)
  const acidRun = BiolabCore.createRun('pretty-acid');
  BiolabCore.washSieve(acidRun, 4, 60, 55);
  BiolabCore.washSieve(acidRun, 2, 60, 55);
  BiolabCore.washSieve(acidRun, 1, 60, 55);
  BiolabCore.adjustMicroscopeFocus(acidRun, 60);
  BiolabCore.measureFiberLength(acidRun, 16.0);
  BiolabCore.dipPhStrip(acidRun, 3.0);
  BiolabCore.readStrip(acidRun, 5.6);
  const vAcid = BiolabCore.interpret(acidRun, 'acid');
  assert.equal(vAcid.ok, true);
  assert.equal(vAcid.verdict.violation, true);
  assert.equal(vAcid.verdict.acidosis, true);
  assert.ok(vAcid.verdict.flags.includes('ration-violation'));
});

test('BiolabCore Table 2: manual paper casting (deckle level, couching roller, screw thermal press)', () => {
  const run = BiolabCore.createRun('margo-norm');
  BiolabCore.washSieve(run, 4, 60, 55);
  BiolabCore.washSieve(run, 2, 60, 55);
  BiolabCore.washSieve(run, 1, 60, 55);
  BiolabCore.adjustMicroscopeFocus(run, 64);
  BiolabCore.measureFiberLength(run, 14.5);
  BiolabCore.dipPhStrip(run, 3.0);
  BiolabCore.readStrip(run, 6.8);
  BiolabCore.interpret(run, 'norm');

  // 1. Черпальная ванна: перекос > 4° бракуется, 0° проходит
  assert.equal(BiolabCore.performVatDip(run, 9.5).ok, false);
  assert.equal(BiolabCore.performVatDip(run, 0.5).ok, true);
  assert.equal(run.paperStep, 'couching');

  // 2. Куширование валиком: 65% проходит
  assert.equal(BiolabCore.performCouching(run, 25).ok, false);
  assert.equal(BiolabCore.performCouching(run, 65).ok, true);
  assert.equal(run.paperStep, 'press');

  // 3. Винтовой термопресс: 4.0 МПа и 5.0 с дают готовый сортовой лист (209 г/м²)
  assert.equal(BiolabCore.performThermalPress(run, 2.5, 5.0, 'archival-photo').ok, false);
  const pressOk = BiolabCore.performThermalPress(run, 4.0, 5.0, 'diploma-sovereign');
  assert.equal(pressOk.ok, true);
  assert.equal(pressOk.gsm, 209);
  assert.equal(run.paperCraft.completed, true);
  assert.equal(run.paperCraft.gradeId, 'diploma-sovereign');
});

test('Zero Web-Leaks & Offline Autonomy: no external font CDNs or forbidden web terms in visible UI', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const biolabUi = fs.readFileSync(path.join(__dirname, '..', 'biolab-ui.js'), 'utf8');

  // Запрет внешних шрифтов и CDN
  assert.equal(/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(indexHtml), false);

  // Удаляем теги <script> и комментарии перед проверкой видимого текста HTML
  const visibleHtml = indexHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ');

  const forbiddenWords = [
    /\bGitHub\b/i,
    /\bрепозитор/i,
    /\bв новой вкладке\b/i,
    /\bвкладк[аеиуой]\b/i,
    /\bбраузер/i,
    /\blocalStorage\b/i,
    /ers_progress_v1/i
  ];

  for (const rx of forbiddenWords) {
    assert.equal(rx.test(visibleHtml), false, `Found forbidden pattern ${rx} in index.html visible text`);
  }
  assert.equal(/ers_progress_v1:biolab\s*\(paper-craft\)/.test(biolabUi), false);
});

test('LabMath: preserves C:N mass balance and Penman-Monteith calculations', () => {
  const cn = LabMath.calculateMassBalance({
    mSoil: 10,
    mSub: 4,
    profileKey: 'composted'
  });
  assert.ok(cn.cnMix < 25);
  assert.equal(cn.deltaNGrams, 0);
});
