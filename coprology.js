/**
 * Копрограмма и ситовый анализ (Био-лаборатория станции): чистая логика без DOM.
 * Партия сырья приезжает из Манежа; стажёр отмывает пробу на ситах 4 → 2 → 1 мм, оценивает под микроскопом
 * длину волокон, делает экспресс-тест pH (летучие жирные кислоты) и по желанию отливает лист «слоновьей бумаги».
 * Итог — запись `coprology/fiber-analysis` в сводке `ers_progress_v1:biolab` (research-station: CONTRACT.md §2).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Coprology = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const ITEM_ID = 'coprology/fiber-analysis';
  const PAPER_ID = 'coprology/paper-sheet';

  /** Сита по порядку отмывки: от крупного к мелкому, иначе мелкое сито забьётся грубой фракцией. */
  const SIEVES = [4, 2, 1];

  /** Проба 100 г (сырая масса) из партии Манежа: доля, оставшаяся на каждом сите, и проход через 1 мм. */
  const SAMPLE = { massG: 100, fractions: { 4: 38, 2: 27, 1: 21, fines: 14 } };

  /** Классы длины волокон под микроскопом (мм). */
  const LENGTH_CLASSES = [
    { id: 'lt5', label: 'короче 5 мм', min: 0, max: 5 },
    { id: '5-10', label: '5–10 мм', min: 5, max: 10 },
    { id: '10-20', label: '10–20 мм', min: 10, max: 20 },
    { id: 'gt20', label: 'длиннее 20 мм', min: 20, max: Infinity },
  ];

  /** Экспресс-тест pH: цвет полоски по шкале и чтение результата. */
  const PH_SCALE = [
    { ph: 5.6, color: '#d9822b', label: '5,6', name: 'оранжевая' },
    { ph: 6.2, color: '#c9b22e', label: '6,2', name: 'жёлтая' },
    { ph: 6.8, color: '#7aa53a', label: '6,8', name: 'травянисто-зелёная' },
    { ph: 7.4, color: '#2f8a6e', label: '7,4', name: 'сине-зелёная' },
  ];
  const SAMPLE_PH = 6.8;

  /** Что значит pH пробы для заднекишечной ферментации слона. */
  const PH_READINGS = [
    { id: 'acid', label: 'Ацидоз: избыток ЛЖК, в рационе много крахмала и фруктов', test: (ph) => ph < 6.2 },
    { id: 'norm', label: 'Норма: ферментация клетчатки идёт ровно (pH 6,2–7,0)', test: (ph) => ph >= 6.2 && ph <= 7.0 },
    { id: 'alk', label: 'Слабая ферментация: мало ЛЖК, рацион беден легкодоступными углеводами', test: (ph) => ph > 7.0 },
  ];

  const MISTAKE_COST = 10;
  const MIN_SCORE = 40;

  /** Детерминированный генератор: одно и то же поле зрения при каждой загрузке и в тестах. */
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /** Волокна в поле зрения микроскопа: длина (мм), положение и угол. Преобладают 10–20 мм — грубый рацион из сена и веток. */
  function fieldOfView(seed = 2026) {
    const r = rng(seed);
    const fibers = [];
    const plan = [
      ['lt5', 4],
      ['5-10', 6],
      ['10-20', 11],
      ['gt20', 3],
    ];
    for (const [cls, n] of plan) {
      const c = LENGTH_CLASSES.find((x) => x.id === cls);
      const hi = Number.isFinite(c.max) ? c.max : 32;
      for (let i = 0; i < n; i++) {
        fibers.push({
          lengthMm: Math.round((c.min + 0.5 + r() * (hi - c.min - 1)) * 10) / 10,
          x: Math.round(8 + r() * 84),
          y: Math.round(8 + r() * 84),
          angle: Math.round(r() * 180),
        });
      }
    }
    // Перемешать, чтобы классы не шли полосами.
    for (let i = fibers.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [fibers[i], fibers[j]] = [fibers[j], fibers[i]];
    }
    return fibers;
  }

  function lengthClassOf(mm) {
    return LENGTH_CLASSES.find((c) => mm >= c.min && mm < c.max).id;
  }

  /** Класс, в который попадает больше всего волокон. */
  function dominantClass(fibers) {
    const counts = {};
    for (const f of fibers) {
      const id = lengthClassOf(f.lengthMm);
      counts[id] = (counts[id] || 0) + 1;
    }
    return LENGTH_CLASSES.reduce((best, c) => ((counts[c.id] || 0) > (counts[best] || 0) ? c.id : best), LENGTH_CLASSES[0].id);
  }

  function meanLength(fibers) {
    if (!fibers.length) return 0;
    return Math.round((fibers.reduce((s, f) => s + f.lengthMm, 0) / fibers.length) * 10) / 10;
  }

  function phReading(ph) {
    return PH_READINGS.find((r) => r.test(ph)).id;
  }

  /** Новый анализ: шаги по порядку, ошибки считаются для балла. */
  function createRun(seed) {
    return { step: 'sieve', washed: [], fibers: fieldOfView(seed), fiberClass: null, phPicked: null, reading: null, mistakes: 0, done: false, paper: null };
  }

  /** Отмыть пробу на сите. Не по порядку — ошибка, и сито не засчитывается. */
  function washSieve(run, mm) {
    if (run.step !== 'sieve') return { ok: false, reason: 'step' };
    const expected = SIEVES[run.washed.length];
    if (mm !== expected) {
      run.mistakes++;
      return { ok: false, reason: 'order', expected };
    }
    run.washed.push(mm);
    if (run.washed.length === SIEVES.length) run.step = 'microscope';
    return { ok: true, retainedPct: SAMPLE.fractions[mm], finished: run.step === 'microscope' };
  }

  /** Выбрать преобладающий класс длины волокон. */
  function pickFiberClass(run, classId) {
    if (run.step !== 'microscope') return { ok: false, reason: 'step' };
    const expected = dominantClass(run.fibers);
    if (classId !== expected) {
      run.mistakes++;
      return { ok: false, reason: 'wrong' };
    }
    run.fiberClass = classId;
    run.step = 'ph';
    return { ok: true, meanMm: meanLength(run.fibers) };
  }

  /** Сравнить полоску со шкалой: выбрать pH. */
  function readStrip(run, ph) {
    if (run.step !== 'ph') return { ok: false, reason: 'step' };
    if (ph !== SAMPLE_PH) {
      run.mistakes++;
      return { ok: false, reason: 'wrong' };
    }
    run.phPicked = ph;
    run.step = 'reading';
    return { ok: true };
  }

  /** Истолковать pH пробы; правильный ответ завершает анализ. */
  function interpret(run, readingId) {
    if (run.step !== 'reading') return { ok: false, reason: 'step' };
    if (readingId !== phReading(SAMPLE_PH)) {
      run.mistakes++;
      return { ok: false, reason: 'wrong' };
    }
    run.reading = readingId;
    run.step = 'done';
    run.done = true;
    return { ok: true, score: score(run) };
  }

  function score(run) {
    return Math.max(MIN_SCORE, 100 - run.mistakes * MISTAKE_COST);
  }

  /** Лист «слоновьей бумаги» из волокон с сит 4 и 2 мм: масса и плотность листа A5. Только после анализа. */
  function castPaperSheet(run) {
    if (!run.done) return { ok: false, reason: 'step' };
    // Сухое вещество — около 20 % сырой массы, выход целлюлозы после щелочной варки — около половины.
    const fiberG = Math.round(((SAMPLE.fractions[4] + SAMPLE.fractions[2]) / 100) * SAMPLE.massG * 0.2 * 0.5 * 10) / 10;
    const areaM2 = 0.148 * 0.21;
    const gsm = Math.round(fiberG / areaM2);
    run.paper = { fiberG, gsm };
    return { ok: true, fiberG, gsm };
  }

  /** Записи для сводки станции: только id, тип, статус, время и балл. */
  function summaryItems(run, now) {
    const at = now || new Date().toISOString();
    const out = {};
    if (run.done) out[ITEM_ID] = { kind: 'analysis', status: 'done', at, score: score(run) };
    if (run.paper) out[PAPER_ID] = { kind: 'practice', status: 'done', at };
    return out;
  }

  return {
    ITEM_ID,
    PAPER_ID,
    SIEVES,
    SAMPLE,
    LENGTH_CLASSES,
    PH_SCALE,
    SAMPLE_PH,
    PH_READINGS,
    fieldOfView,
    lengthClassOf,
    dominantClass,
    meanLength,
    phReading,
    createRun,
    washSieve,
    pickFiberClass,
    readStrip,
    interpret,
    score,
    castPaperSheet,
    summaryItems,
  };
});
