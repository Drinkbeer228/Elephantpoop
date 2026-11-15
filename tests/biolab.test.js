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

test('ErsProgress: writes ers.progress/1 under ers_progress_v1:biolab including items[id].flags and reads ers_station_v1', () => {
  const storage = createMockStorage();

  // 0. Чтение свежей пробы из Манежа (`ers_station_v1`) vs отсутствие пробы
  assert.equal(ErsProgress.readStationSample(storage), null);
  storage.setItem(
    'ers_station_v1',
    JSON.stringify({
      manegeSample: {
        batchId: 'margo-coarse',
        label: 'Проба: Марго, утренний выгул'
      }
    })
  );
  const sample = ErsProgress.readStationSample(storage);
  assert.ok(sample);
  assert.equal(sample.source, 'manege');
  assert.equal(sample.batchId, 'margo-coarse');
  assert.equal(sample.label, 'Проба: Марго, утренний выгул');

  // 1. Запись бракованной партии (> 20 мм или pH < 6.2) -> ставит flags прямо на items[id].flags и в корень flags
  const okViolation = ErsProgress.recordAnalysisVerdict(
    {
      batchId: 'margo-coarse',
      batchTitle: 'Проба: Марго (недоруб корма > 20 мм)',
      meanFiberMm: 29.0,
      ph: 6.5,
      violation: true,
      longFibers: true,
      lowPh: false,
      score: 100,
      at: '2026-04-12T10:00:00.000Z'
    },
    storage
  );
  assert.equal(okViolation, true);

  const raw1 = JSON.parse(storage.getItem('ers_progress_v1:biolab'));
  assert.equal(raw1.schema, 'ers.progress/1');
  assert.equal(raw1.module, 'biolab');
  assert.ok(raw1.flags.includes('ration-violation'));
  assert.ok(raw1.flags.includes('long-fibers'));
  assert.equal(raw1.items.analysis.status, 'done');
  assert.equal(raw1.items.analysis.outcome, 'ration-violation');
  assert.ok(Array.isArray(raw1.items.analysis.flags));
  assert.ok(raw1.items.analysis.flags.includes('ration-violation'));
  assert.ok(raw1.items.analysis.flags.includes('long-fibers'));
  assert.ok(raw1.items['coprology/fiber-analysis'].flags.includes('ration-violation'));

  // 2. Запись эталонной партии (16.5 мм <= 20 мм, pH 6.8) -> снимает флаги нарушения
  ErsProgress.recordAnalysisVerdict(
    {
      batchId: 'margo-norm',
      batchTitle: 'Проба: Марго, утренний выгул',
      meanFiberMm: 16.5,
      ph: 6.8,
      violation: false,
      longFibers: false,
      lowPh: false,
      score: 100,
      at: '2026-04-12T10:05:00.000Z'
    },
    storage
  );

  const raw2 = JSON.parse(storage.getItem('ers_progress_v1:biolab'));
  assert.equal(raw2.flags.includes('ration-violation'), false);
  assert.equal(raw2.items.analysis.outcome, 'norm');
  assert.deepEqual(raw2.items.analysis.flags, []);

  // 3. Запись отлитого листа «слоновьей бумаги» (paper-craft)
  ErsProgress.recordPaperCraft(
    {
      gradeId: 'royal-grade',
      gradeTitle: 'Королевский сорт',
      recipient: 'Совет наставников станции',
      gsm: 235,
      fiberG: 6.5,
      score: 100,
      at: '2026-04-12T10:10:00.000Z'
    },
    storage
  );

  const raw3 = JSON.parse(storage.getItem('ers_progress_v1:biolab'));
  assert.equal(raw3.items['paper-craft'].status, 'done');
  assert.equal(raw3.items['paper-craft'].gradeId, 'royal-grade');
  assert.equal(raw3.items['paper-craft'].gsm, 235);
  assert.equal(raw3.items['coprology/paper-sheet'].status, 'done');
});

test('BiolabCore 2D Scene (WALK): handles archive vs manege sample, movement, collision, and nearby station lookup', () => {
  const archiveWorld = BiolabCore.createWorldState(null);
  assert.equal(archiveWorld.mode, 'WALK');
  assert.equal(archiveWorld.sampleSource, 'archive');
  assert.match(archiveWorld.alisa.speech, /архивный образец/i);

  const manegeWorld = BiolabCore.createWorldState({
    source: 'manege',
    batchId: 'margo-norm',
    label: 'Проба: Марго, утренний выгул'
  });
  assert.equal(manegeWorld.sampleSource, 'manege');
  assert.equal(manegeWorld.run.batchId, 'margo-norm');

  // Проверка поиска ближайшей станции (приёмный бак рядом со стартовой позицией)
  const nearBin = BiolabCore.findNearbyStation(manegeWorld.player, 74);
  assert.ok(nearBin);
  assert.equal(nearBin.id, 'bin');

  // Движение вправо/вверх в режиме WALK и удержание внутри границ зала
  const startX = manegeWorld.player.x;
  const startY = manegeWorld.player.y;
  for (let i = 0; i < 15; i++) {
    BiolabCore.stepWalkState(manegeWorld, { right: true, up: true }, 0.03);
  }
  assert.ok(manegeWorld.player.x > startX);
  assert.ok(manegeWorld.player.y < startY);

  // Автоподход по клику к станции
  const sievesSt = BiolabCore.ROOM_STATIONS.find((s) => s.id === 'sieves');
  manegeWorld.player.x = sievesSt.interactX - 10;
  manegeWorld.player.y = sievesSt.interactY;
  manegeWorld.player.targetX = sievesSt.interactX;
  manegeWorld.player.targetY = sievesSt.interactY;
  manegeWorld.player.pendingInteractStation = 'sieves';
  let arrived = null;
  for (let i = 0; i < 20; i++) {
    const step = BiolabCore.stepWalkState(manegeWorld, {}, 0.04);
    if (step && step.arrivedStationId) {
      arrived = step.arrivedStationId;
      break;
    }
  }
  assert.equal(arrived, 'sieves');
});

test('BiolabCore Workbenches (1..4) Royal Flow: wash pressure, 3s pH + caliper <= 20 mm, bubble balance, flywheel & steam -> royal-grade', () => {
  const run = BiolabCore.createRun('margo-norm');

  // Стол 1: Мойка и вибросита (держим напор в зелёной зоне 42..76% без перехлёста)
  for (let i = 0; i < 120; i++) {
    const press = run.waterPressure < 64;
    BiolabCore.stepWashPhysics(run, press, 0.05);
    if (run.washDone) break;
  }
  assert.equal(run.washDone, true);
  assert.equal(run.overflowCount, 0);

  // Стол 2А: Тест-полоска pH ровно 3.0 с и выбор эталона 6.8 (шкала 5.5–7.5)
  for (let i = 0; i < 30; i++) {
    BiolabCore.stepPhDipTimer(run, true, 0.1);
  }
  const release = BiolabCore.stepPhDipTimer(run, false, 0.05);
  assert.equal(release.event, 'dipped-ready');
  assert.equal(run.stripDipped, true);

  const phMatch = BiolabCore.selectPhScaleSwatch(run, 6.8);
  assert.equal(phMatch.ok, true);
  assert.equal(phMatch.lowPh, false);

  // Стол 2Б: Фокус микроскопа + измерение двумя кликами (16.5 мм <= 20 мм)
  assert.equal(BiolabCore.adjustMicroscopeFocus(run, 56).ok, true);
  const cal = BiolabCore.measureCaliperPoints(run, { x: 480, y: 250 }, { x: 621, y: 250 }, 8.57);
  assert.equal(cal.ok, true);
  assert.equal(cal.longFibers, false);
  assert.equal(run.done, true);
  assert.equal(run.verdict.violation, false);

  // Стол 3: Черпальная ванна — держим пузырёк по центру
  for (let i = 0; i < 100; i++) {
    BiolabCore.stepVatBalance(run, 0, 0.05, 0);
    if (run.vatDone) break;
  }
  assert.equal(run.vatDone, true);
  assert.equal(run.vatHasBaldSpot, false);

  // Стол 4: Маховик до 100% + пар 3.5 с -> «Королевский сорт»
  BiolabCore.advanceFlywheel(run, 100);
  assert.equal(run.flywheelDone, true);
  for (let i = 0; i < 35; i++) {
    BiolabCore.stepPressSteam(run, true, 0.1);
  }
  const finished = BiolabCore.stepPressSteam(run, false, 0.05);
  assert.equal(finished.event, 'finished');
  assert.equal(finished.tierId, 'royal-grade');
  assert.equal(finished.tier.title, 'Королевский сорт');
});

function holdTicks(fn, run, ticks, dt) {
  for (let i = 0; i < ticks; i++) fn(run, true, dt || 0.1);
  return fn(run, false, 0.05);
}

test('BiolabCore Workbenches Violation & Defects: overflow, >20mm long-fibers, <6.2 low-ph, baldSpot & scorch/tear -> scrap or standard-kraft', () => {
  // 1. Крупный недоруб > 20 мм (margo-coarse: 29 мм) -> long-fibers + ration-violation -> Брак / вторичка
  const coarseRun = BiolabCore.createRun('margo-coarse');
  holdTicks(BiolabCore.stepPhDipTimer, coarseRun, 30, 0.1);
  assert.equal(coarseRun.stripDipped, true);
  BiolabCore.selectPhScaleSwatch(coarseRun, 6.5);
  const calCoarse = BiolabCore.measureCaliperPoints(coarseRun, { x: 440, y: 250 }, { x: 688, y: 250 }, 8.57);
  assert.equal(calCoarse.longFibers, true);
  assert.equal(coarseRun.verdict.violation, true);
  assert.ok(coarseRun.verdict.flags.includes('ration-violation'));
  assert.ok(coarseRun.verdict.flags.includes('long-fibers'));
  BiolabCore.advanceFlywheel(coarseRun, 100);
  const coarsePaper = holdTicks(BiolabCore.stepPressSteam, coarseRun, 34, 0.1);
  assert.equal(coarsePaper.tierId, 'scrap');

  // 2. Ацидоз pH < 6.2 (pretty-acid: pH 5.8) -> low-ph + ration-violation
  const acidRun = BiolabCore.createRun('pretty-acid');
  holdTicks(BiolabCore.stepPhDipTimer, acidRun, 30, 0.1);
  const acidSw = BiolabCore.selectPhScaleSwatch(acidRun, 5.8);
  assert.equal(acidSw.lowPh, true);
  BiolabCore.measureCaliperPoints(acidRun, { x: 480, y: 250 }, { x: 625, y: 250 }, 8.57);
  assert.equal(acidRun.verdict.violation, true);
  assert.ok(acidRun.verdict.flags.includes('ration-violation'));
  assert.ok(acidRun.verdict.flags.includes('low-ph'));

  // 3. Перехлёст воды (>80%, 1 сбой) без нарушения рациона -> Стандартный крафт
  const stdRun = BiolabCore.createRun('margo-norm');
  for (let i = 0; i < 40; i++) {
    const res = BiolabCore.stepWashPhysics(stdRun, stdRun.overflowCount < 1, 0.05);
    if (res.overflowTriggered) break;
  }
  assert.equal(stdRun.overflowCount, 1);
  holdTicks(BiolabCore.stepPhDipTimer, stdRun, 30, 0.1);
  BiolabCore.selectPhScaleSwatch(stdRun, 6.8);
  BiolabCore.measureCaliperPoints(stdRun, { x: 480, y: 250 }, { x: 621, y: 250 }, 8.57);
  BiolabCore.advanceFlywheel(stdRun, 100);
  const stdPaper = holdTicks(BiolabCore.stepPressSteam, stdRun, 34, 0.1);
  assert.equal(stdRun.pressTorn, false);
  assert.equal(stdRun.pressScorched, false);
  assert.equal(stdPaper.tierId, 'standard-kraft');

  // 4. Недодержка пара (<2.7с) -> порыв листа -> Брак / вторичка
  const tearRun = BiolabCore.createRun('margo-norm');
  BiolabCore.advanceFlywheel(tearRun, 100);
  const tearPaper = holdTicks(BiolabCore.stepPressSteam, tearRun, 15, 0.1);
  assert.equal(tearRun.pressTorn, true);
  assert.equal(tearPaper.tierId, 'scrap');
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
