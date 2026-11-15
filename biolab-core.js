/**
 * Чистая логика 2D-симулятора Эколаборатории (`biolab-core.js`).
 * Полностью отделена от DOM и Canvas API для юнит-тестирования в Node (`node:test`).
 *
 * Реализует:
 * - Архитектуру сцены `WALK` ↔ `INTERACTING` (план зала 960×560, столкновения, приёмный бак и `ers_station_v1`)
 * - 4 тактильных рабочих стола (800×600):
 *   1) Стол 1: Мойка и вибросита (манометр напора воды, перехлёст через борт)
 *   2) Стол 2: Химический стол (тест-полоска pH 5.5–7.5 ровно на 3 с + микроскоп с фокусом и линейкой 2 кликами)
 *   3) Стол 3: Черпальная ванна (пузырьковый уровень, баланс влево-вправо)
 *   4) Стол 4: Винтовой пресс и сушка (вращение маховика + рычаг пара 3–4 с)
 * - Нарушения рациона (`ration-violation`, `long-fibers` > 20 мм, `low-ph` < 6.2)
 * - Три сорта готовой бумаги («Брак / вторичка», «Стандартный крафт», «Королевский сорт»)
 * - Живые реплики биохимика Алисы
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BiolabCore = api;
    root.Coprology = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  const ITEM_ID = 'coprology/fiber-analysis';
  const PAPER_ID = 'coprology/paper-sheet';
  const SIEVES = [4, 2, 1];
  const LONG_FIBER_THRESHOLD_MM = 20;
  const LOW_PH_THRESHOLD = 6.2;

  const WORLD_WIDTH = 960;
  const WORLD_HEIGHT = 560;
  const WORKBENCH_WIDTH = 800;
  const WORKBENCH_HEIGHT = 600;

  const ALISA_LINES = {
    welcomeManege:
      'Электрокар из Манежа оставил свежий бак у двери. Зачерпни навеску совком и неси в мерный таз к Столу 1!',
    welcomeArchive:
      'Свежей пробы из Манежа сейчас нет — возьми из приёмного бака «архивный образец со склада» для тренировки.',
    scoopPicked:
      'Отлично, навеска в совке! Неси её к Столу 1 (Мойка и вибросита) и высыпай в мерный таз.',
    overflow:
      'Осторожнее, половину мелкой фракции в канализацию смыл!',
    weakPressure:
      'Напор слишком слабый — слизь не отмывается от волокон. Поддай давления в зелёную зону!',
    washDone:
      'Чистая целлюлоза! Переходим за Стол 2: проверим pH полоской и замерим длину волокон под микроскопом.',
    phBleed:
      'Передержал полоску — краситель расплылся! Возьми свежую полоску и вытащи ровно на 3,0 с.',
    phEarly:
      'Рано вытащил! Индикатор не успел среагировать с кислотами. Держи ровно 3 секунды.',
    longFibers:
      'Ого, какие брёвна! Марго опять заглатывала ветки целиком, или ты на кормокухне баклажаны не порезал? Тарасу в СлоноВет я маякнула, пусть проверит её челюсть.',
    lowPh:
      'Кислятина. Кто-то пересыпал сладких концентратов и забыл про чистую воду. Смотри, подстилка в Манеже сегодня будет "весёлая".',
    chemDoneNorm:
      'Показатели в физиологической норме! Неси промытую пульпу в Черпальную ванну (Стол 3).',
    vatBaldSpot:
      'Рамка пошла винтом! На полотне образовалась залысина и клин — держи пузырёк уровня в центре.',
    vatDone:
      'Ровный ковёр волокон! Теперь переносим мокрый лист под чугунный винтовой пресс (Стол 4).',
    pressTear:
      'Недодержал пар — лист остался сырым и порвался при снятии с сукна.',
    pressScorch:
      'Передержал на пару! Появились бурые подпалины — волокно стало хрупким.',
    paperDoneRoyal:
      'Королевский сорт! Золотисто-кремовое полотно с аккуратными травинками. Ставим штамп лапы слона и мою подпись!',
    paperDoneStandard:
      'Добротный стандартный крафт цвета охры. Годен для журналов Манежа и нарядов.',
    paperDoneScrap:
      'Получился только брак / вторичка: ломкий лист из-за нарушений или огрехов отливки. Отправляю в компостный бурт.'
  };

  /**
   * План зала Эколаборатории (960×560) в стиле Elephant Keeper (вид сверху).
   */
  const ROOM_STATIONS = [
    {
      id: 'bin',
      label: 'Приёмный бак',
      shortTitle: 'Вход · Приёмный бак',
      x: 112,
      y: 382,
      w: 96,
      h: 112,
      interactX: 234,
      interactY: 438
    },
    {
      id: 'sieves',
      label: 'Стол 1 · Мойка и вибросита',
      shortTitle: 'Стол 1: Мойка и сита',
      x: 248,
      y: 138,
      w: 170,
      h: 100,
      interactX: 333,
      interactY: 266
    },
    {
      id: 'chem',
      label: 'Стол 2 · Химия и микроскоп',
      shortTitle: 'Стол 2: pH и микроскоп',
      x: 472,
      y: 138,
      w: 176,
      h: 100,
      interactX: 560,
      interactY: 266
    },
    {
      id: 'vat',
      label: 'Стол 3 · Черпальная ванна',
      shortTitle: 'Стол 3: Черпальная ванна',
      x: 334,
      y: 374,
      w: 176,
      h: 108,
      interactX: 422,
      interactY: 342
    },
    {
      id: 'press',
      label: 'Стол 4 · Винтовой пресс',
      shortTitle: 'Стол 4: Пресс и сушка',
      x: 616,
      y: 374,
      w: 184,
      h: 108,
      interactX: 708,
      interactY: 342
    },
    {
      id: 'board',
      label: 'Доска Алисы · Выбор пробы',
      shortTitle: 'Доска Алисы',
      x: 736,
      y: 122,
      w: 146,
      h: 88,
      interactX: 800,
      interactY: 246
    }
  ];

  const BATCH_PRESETS = {
    'margo-norm': {
      id: 'margo-norm',
      title: 'Проба: Марго, утренний выгул',
      originNote: 'Контейнер с пандуса Манежа: луговое сено, отава и тонкие побеги ивы.',
      massG: 100,
      fractions: { 4: 26, 2: 39, 1: 21, fines: 14 },
      meanFiberMm: 14.5,
      longestFiberMm: 16.5,
      dominantClass: '10-20',
      ph: 6.8,
      optimalFocus: 56,
      fibers: [
        { id: 'f1', lengthMm: 16.5, x1: 18, y1: 35, x2: 68, y2: 43, angle: 12, major: true },
        { id: 'f2', lengthMm: 14.0, x1: 28, y1: 62, x2: 70, y2: 56, angle: -10, major: true },
        { id: 'f3', lengthMm: 12.0, x1: 34, y1: 22, x2: 68, y2: 30, angle: 18, major: false },
        { id: 'f4', lengthMm: 9.5, x1: 48, y1: 72, x2: 74, y2: 78, angle: 24, major: false },
        { id: 'f5', lengthMm: 13.5, x1: 20, y1: 48, x2: 58, y2: 60, angle: 16, major: false }
      ]
    },
    'margo-coarse': {
      id: 'margo-coarse',
      title: 'Проба: Марго (недоруб корма > 20 мм)',
      originNote: 'В бункере крупные куски веток и нерезаных баклажанов с кормокухни.',
      massG: 100,
      fractions: { 4: 48, 2: 24, 1: 16, fines: 12 },
      meanFiberMm: 26.5,
      longestFiberMm: 29.0,
      dominantClass: 'gt25',
      ph: 6.5,
      optimalFocus: 62,
      fibers: [
        { id: 'f1', lengthMm: 29.0, x1: 10, y1: 42, x2: 90, y2: 56, angle: 10, major: true },
        { id: 'f2', lengthMm: 25.5, x1: 16, y1: 68, x2: 86, y2: 62, angle: -8, major: true },
        { id: 'f3', lengthMm: 23.0, x1: 22, y1: 24, x2: 84, y2: 34, angle: 12, major: false },
        { id: 'f4', lengthMm: 18.0, x1: 30, y1: 78, x2: 78, y2: 82, angle: 6, major: false }
      ]
    },
    'pretty-acid': {
      id: 'pretty-acid',
      title: 'Проба: Претти (избыток концентратов, pH 5.8)',
      originNote: 'Влажный болюс с резким запахом брожения от поилки №2.',
      massG: 100,
      fractions: { 4: 22, 2: 31, 1: 25, fines: 22 },
      meanFiberMm: 15.0,
      longestFiberMm: 17.0,
      dominantClass: '10-20',
      ph: 5.8,
      optimalFocus: 46,
      fibers: [
        { id: 'f1', lengthMm: 17.0, x1: 22, y1: 38, x2: 72, y2: 46, angle: 10, major: true },
        { id: 'f2', lengthMm: 14.5, x1: 30, y1: 60, x2: 72, y2: 54, angle: -8, major: true },
        { id: 'f3', lengthMm: 11.5, x1: 36, y1: 24, x2: 68, y2: 28, angle: 12, major: false },
        { id: 'f4', lengthMm: 12.5, x1: 24, y1: 70, x2: 60, y2: 74, angle: 8, major: false }
      ]
    },
    'archive-sample': {
      id: 'archive-sample',
      title: 'Архивный образец со склада №12',
      originNote: 'Контрольный сухой образец из хранилища лаборатории для отработки методики.',
      massG: 100,
      fractions: { 4: 28, 2: 38, 1: 20, fines: 14 },
      meanFiberMm: 13.5,
      longestFiberMm: 15.5,
      dominantClass: '10-20',
      ph: 6.8,
      optimalFocus: 52,
      fibers: [
        { id: 'f1', lengthMm: 15.5, x1: 24, y1: 42, x2: 70, y2: 48, angle: 8, major: true },
        { id: 'f2', lengthMm: 13.0, x1: 28, y1: 64, x2: 66, y2: 58, angle: -10, major: true },
        { id: 'f3', lengthMm: 11.0, x1: 38, y1: 26, x2: 70, y2: 30, angle: 7, major: false }
      ]
    }
  };

  const SAMPLE = BATCH_PRESETS['margo-norm'];

  const LENGTH_CLASSES = [
    { id: 'lt10', label: 'Короче 10 мм (мелкий перетир)', min: 0, max: 10, repMm: 7.5 },
    { id: '10-20', label: '10–20 мм (норма перетира ≤ 20 мм)', min: 10, max: 20, repMm: 14.5 },
    { id: 'gt25', label: 'Длиннее 20 мм (брёвна > 20 мм — long-fibers)', min: 20, max: Infinity, repMm: 29.0 }
  ];

  const PH_SCALE = [
    { ph: 5.5, color: '#C8523B', label: '5,5', name: 'ярко-терракотовая (резко кислая)' },
    { ph: 5.8, color: '#D47B34', label: '5,8', name: 'оранжево-медная (ацидоз < 6,2)' },
    { ph: 6.2, color: '#C7A93B', label: '6,2', name: 'жёлто-оливковая (нижняя граница)' },
    { ph: 6.5, color: '#99A83B', label: '6,5', name: 'светло-зелёная (норма)' },
    { ph: 6.8, color: '#4E8E4B', label: '6,8', name: 'травянисто-зелёная (эталон 6,8)' },
    { ph: 7.1, color: '#2E7D67', label: '7,1', name: 'хвойно-бирюзовая (слабощелочная)' },
    { ph: 7.5, color: '#2B5B78', label: '7,5', name: 'сине-сланцевая (щелочной сдвиг)' }
  ];

  const SAMPLE_PH = 6.8;

  const PH_READINGS = [
    {
      id: 'acid',
      label: 'Ацидоз (low-ph < 6,2): брожение углеводов — сигнал в Манеж и Клинику',
      test: (ph) => ph < 6.2
    },
    {
      id: 'norm',
      label: 'Физиологическая норма (pH 6,2–7,0): ферментация клетчатки в норме',
      test: (ph) => ph >= 6.2 && ph <= 7.0
    },
    {
      id: 'alk',
      label: 'Щелочной сдвиг (pH > 7,0): дефицит летучих жирных кислот',
      test: (ph) => ph > 7.0
    }
  ];

  const PAPER_TIERS = {
    scrap: {
      id: 'scrap',
      title: 'Брак / вторичка',
      subtitle: 'Ломкий лист с дефектами переплетения или нарушенным сырьём',
      bgFill: '#D4C7B2',
      fiberStroke: '#7A5E42',
      gsm: 155,
      stampColor: '#C86D51'
    },
    'standard-kraft': {
      id: 'standard-kraft',
      title: 'Стандартный крафт',
      subtitle: 'Плотная бумага цвета охры для рабочих журналов Манежа',
      bgFill: '#DFC99B',
      fiberStroke: '#8A6B3E',
      gsm: 205,
      stampColor: '#2E5A44'
    },
    'royal-grade': {
      id: 'royal-grade',
      title: 'Королевский сорт',
      subtitle: 'Золотисто-кремовая бумага с травинками и водяным знаком станции',
      bgFill: '#F4EBD3',
      fiberStroke: '#A07F45',
      gsm: 235,
      stampColor: '#2E5A44'
    }
  };

  // Сохранение совместимости с карточками сортов
  const PAPER_GRADES = {
    'archival-photo': {
      id: 'archival-photo',
      title: 'Стандартный крафт (для архива Читального зала)',
      recipient: 'Элеонора Яковлевна · Читальный зал',
      purpose: 'Плотная бумага цвета охры для архивных вклеек и фототипии.',
      targetGsm: 205
    },
    'duty-waterproof': {
      id: 'duty-waterproof',
      title: 'Стандартный крафт (формуляр Манежа)',
      recipient: 'Михалыч · Корпус Манежа',
      purpose: 'Плотный формуляр для ночного наряда.',
      targetGsm: 215
    },
    'diploma-sovereign': {
      id: 'diploma-sovereign',
      title: 'Королевский сорт (для Итогового Диплома)',
      recipient: 'Совет наставников станции (штамп лапы слона и подпись Алисы)',
      purpose: 'Золотисто-кремовая бумага с травинками для Свидетельства исследователя.',
      targetGsm: 235
    }
  };

  /**
   * Создаёт полное состояние 2D-симулятора лаборатории (`WALK` ↔ `INTERACTING`).
   */
  function createWorldState(stationSample) {
    const hasManege = Boolean(stationSample && stationSample.source === 'manege');
    const batchKey = hasManege && BATCH_PRESETS[stationSample.batchId]
      ? stationSample.batchId
      : hasManege
        ? 'margo-norm'
        : 'archive-sample';
    const sampleLabel = hasManege
      ? (stationSample.label || BATCH_PRESETS[batchKey].title)
      : 'Архивный образец со склада №12';

    const run = createRun(batchKey);
    run.sampleSource = hasManege ? 'manege' : 'archive';
    run.sampleLabel = sampleLabel;

    return {
      mode: 'WALK', // 'WALK' | 'INTERACTING'
      activeStationId: null,
      player: {
        x: 244,
        y: 438,
        vx: 0,
        vy: 0,
        speed: 270,
        facing: 0,
        walkPhase: 0,
        targetX: null,
        targetY: null,
        pendingInteractStation: null,
        carrying: null // null | 'scoop' | 'washed-pulp' | 'wet-sheet'
      },
      alisa: {
        x: 785,
        y: 238,
        mood: 'welcome',
        speech: hasManege ? ALISA_LINES.welcomeManege : ALISA_LINES.welcomeArchive
      },
      sampleSource: hasManege ? 'manege' : 'archive',
      sampleLabel,
      sampleScooped: false,
      sampleDeliveredToSieve: false,
      run
    };
  }

  /**
   * Шаг перемещения персонажа в режиме `WALK` с проверкой границ зала и столов.
   */
  function stepWalkState(world, input, dtSec) {
    if (!world || world.mode !== 'WALK') return world;
    const p = world.player;
    const dt = Math.min(0.05, Math.max(0.001, dtSec || 0.016));

    let dx = 0;
    let dy = 0;
    if (input) {
      if (input.left) dx -= 1;
      if (input.right) dx += 1;
      if (input.up) dy -= 1;
      if (input.down) dy += 1;
    }

    if (dx !== 0 || dy !== 0) {
      p.targetX = null;
      p.targetY = null;
      p.pendingInteractStation = null;
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    } else if (p.targetX != null && p.targetY != null) {
      const tx = p.targetX - p.x;
      const ty = p.targetY - p.y;
      const dist = Math.hypot(tx, ty);
      if (dist <= 14) {
        p.targetX = null;
        p.targetY = null;
        if (p.pendingInteractStation) {
          const stId = p.pendingInteractStation;
          p.pendingInteractStation = null;
          return { arrivedStationId: stId };
        }
      } else {
        dx = tx / dist;
        dy = ty / dist;
      }
    }

    if (dx !== 0 || dy !== 0) {
      p.facing = Math.atan2(dy, dx);
      p.walkPhase = (p.walkPhase + dt * 10) % (Math.PI * 2);
      const nextX = p.x + dx * p.speed * dt;
      const nextY = p.y + dy * p.speed * dt;

      if (!collidesWithRoom(nextX, p.y, 18)) p.x = nextX;
      if (!collidesWithRoom(p.x, nextY, 18)) p.y = nextY;
    } else {
      p.walkPhase = 0;
    }

    return { arrivedStationId: null };
  }

  function collidesWithRoom(cx, cy, r) {
    if (cx - r < 42 || cx + r > WORLD_WIDTH - 42 || cy - r < 76 || cy + r > WORLD_HEIGHT - 38) {
      return true;
    }
    for (const st of ROOM_STATIONS) {
      const nearestX = Math.max(st.x, Math.min(cx, st.x + st.w));
      const nearestY = Math.max(st.y, Math.min(cy, st.y + st.h));
      if (Math.hypot(cx - nearestX, cy - nearestY) < r) {
        return true;
      }
    }
    return false;
  }

  function findNearbyStation(player, maxDist) {
    const limit = maxDist || 72;
    let best = null;
    let bestDist = Infinity;
    for (const st of ROOM_STATIONS) {
      const cx = Math.max(st.x, Math.min(player.x, st.x + st.w));
      const cy = Math.max(st.y, Math.min(player.y, st.y + st.h));
      const d = Math.hypot(player.x - cx, player.y - cy);
      if (d <= limit && d < bestDist) {
        best = st;
        bestDist = d;
      }
    }
    return best;
  }

  // ===========================================================================
  // ФИЗИКА 4 РАБОЧИХ СТОЛОВ (800×600)
  // ===========================================================================

  /**
   * Стол 1: Мойка и вибросита — удержание мыши повышает напор,
   * зелёная зона (42..76%) моет волокна, > 80% перехлёстывает взвесь через борт.
   */
  function stepWashPhysics(run, isPressing, dtSec) {
    const dt = Math.min(0.1, Math.max(0.001, dtSec || 0.016));
    if (run.washDone) return { status: 'done', overflowTriggered: false };

    if (isPressing) {
      run.waterPressure = Math.min(100, run.waterPressure + dt * 58);
    } else {
      run.waterPressure = Math.max(8, run.waterPressure - dt * 42);
    }

    const p = run.waterPressure;
    let overflowTriggered = false;
    let status = 'idle';

    if (p > 80) {
      status = 'overflow';
      run.overflowAccum += dt;
      if (run.overflowAccum >= 0.35) {
        run.overflowAccum = 0;
        run.overflowCount++;
        run.mistakes++;
        overflowTriggered = true;
      }
      run.washProgress = Math.min(100, run.washProgress + dt * 10);
    } else if (p >= 42 && p <= 76) {
      status = 'optimal';
      run.washProgress = Math.min(100, run.washProgress + dt * 28);
    } else if (p >= 22) {
      status = 'weak';
      run.washProgress = Math.min(100, run.washProgress + dt * 5);
    }

    if (run.washProgress >= 100 && !run.washDone) {
      run.washDone = true;
      run.washed = [4, 2, 1];
      run.step = 'microscope';
      status = 'done';
    }

    return { status, overflowTriggered, pressure: p, progress: run.washProgress };
  }

  /**
   * Стол 2А: Тест-полоска pH — опустить на ~3.0 с, затем сопоставить со шкалой 5.5–7.5.
   */
  function stepPhDipTimer(run, isDipping, dtSec) {
    const dt = Math.min(0.1, Math.max(0.001, dtSec || 0.016));
    if (!run.phDipActive && !isDipping) return { event: 'idle' };

    if (isDipping) {
      run.phDipActive = true;
      run.dipSeconds = Math.min(5.0, run.dipSeconds + dt);
      if (run.dipSeconds > 3.8 && !run.phDyeBleed) {
        run.phDyeBleed = true;
        run.mistakes++;
        return { event: 'bleed', seconds: run.dipSeconds };
      }
      return { event: 'dipping', seconds: run.dipSeconds };
    }

    // Пользователь отпустил пинцет
    if (run.phDipActive) {
      run.phDipActive = false;
      if (run.phDyeBleed) {
        run.dipSeconds = 0;
        run.phDyeBleed = false;
        return { event: 'bleed-reset' };
      }
      if (run.dipSeconds < 2.2) {
        run.dipSeconds = 0;
        return { event: 'too-short' };
      }
      run.stripDipped = true;
      return { event: 'dipped-ready', seconds: run.dipSeconds };
    }
    return { event: 'idle' };
  }

  /**
   * Стол 2Б: Измерение длины самого длинного волокна двумя кликами по окуляру.
   * Окуляр: радиус 150 px соответствует 35 мм поля зрения (pxPerMm = 300 / 35 ≈ 8.57).
   */
  function measureCaliperPoints(run, pt1, pt2, pxPerMm) {
    if (!pt1 || !pt2) return { ok: false, reason: 'points' };
    const scale = pxPerMm || 8.57;
    const distPx = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);
    const measuredMm = Math.round((distPx / scale) * 10) / 10;

    run.caliperP1 = pt1;
    run.caliperP2 = pt2;
    run.measuredMeanMm = measuredMm;
    run.microscopeDone = true;

    const targetLongest = run.batch.longestFiberMm || run.batch.meanFiberMm;
    const effectiveLongest = Math.max(measuredMm, targetLongest);
    const longFibers = effectiveLongest > LONG_FIBER_THRESHOLD_MM;

    if (Math.abs(measuredMm - targetLongest) > 6.5 && measuredMm < 6) {
      run.mistakes++;
    }

    run.longFibersDetected = longFibers;
    if (run.phMatched) {
      finalizeChemVerdict(run);
    }

    return {
      ok: true,
      measuredMm,
      targetLongest,
      longFibers
    };
  }

  function selectPhScaleSwatch(run, phValue) {
    const val = Number(phValue);
    run.phPicked = val;
    const actual = run.batch.ph;
    if (Math.abs(val - actual) > 0.35) {
      run.mistakes++;
      return { ok: false, picked: val, actual };
    }
    run.phMatched = true;
    run.lowPhDetected = actual < LOW_PH_THRESHOLD;
    if (run.microscopeDone) {
      finalizeChemVerdict(run);
    }
    return { ok: true, picked: val, actual, lowPh: run.lowPhDetected };
  }

  function finalizeChemVerdict(run) {
    const longestMm = Math.max(run.measuredMeanMm || 0, run.batch.longestFiberMm || run.batch.meanFiberMm);
    const longFibers = longestMm > LONG_FIBER_THRESHOLD_MM;
    const lowPh = run.batch.ph < LOW_PH_THRESHOLD;
    const violation = longFibers || lowPh;

    const flags = [];
    if (violation) flags.push('ration-violation');
    if (longFibers) flags.push('long-fibers');
    if (lowPh) flags.push('low-ph');

    run.done = true;
    run.step = 'done';
    run.paperAllowed = true; // В 2D-симуляторе можно отлить лист даже из бракованного сырья, но он выйдет сортом «Брак / вторичка»!
    run.verdict = {
      batchId: run.batchId,
      batchTitle: run.batch.title,
      meanFiberMm: run.measuredMeanMm || run.batch.longestFiberMm,
      ph: run.batch.ph,
      violation,
      longFibers,
      coarseFiber: longFibers,
      lowPh,
      acidosis: lowPh,
      flags,
      dispatchedTo: violation
        ? ['Кормокухня «СлоноВет» (Тарас)', 'Ветеринарная клиника (Вера Павловна)']
        : ['Цех отливки бумаги (Стол 3)'],
      score: score(run)
    };
    return run.verdict;
  }

  /**
   * Стол 3: Черпальная ванна — баланс пузырькового уровня при стекании воды.
   */
  function stepVatBalance(run, targetTiltDeg, dtSec, timeSec) {
    const dt = Math.min(0.1, Math.max(0.001, dtSec || 0.016));
    if (run.vatDone) return { status: 'done', tiltDeg: 0, progress: 100 };

    // Лёгкое колыхание пульпы в ванне подталкивает рамку
    const turbulence = Math.sin((timeSec || 0) * 2.4) * 3.2 + Math.cos((timeSec || 0) * 1.3) * 1.6;
    const desired = Math.max(-12, Math.min(12, Number(targetTiltDeg) || 0));
    run.deckleTiltDeg = desired + turbulence * 0.45;

    const inCenter = Math.abs(run.deckleTiltDeg) <= 4.2;
    if (inCenter) {
      run.vatDrainProgress = Math.min(100, run.vatDrainProgress + dt * 26);
    } else {
      run.vatDrainProgress = Math.min(100, run.vatDrainProgress + dt * 14);
      run.vatImbalanceSec = (run.vatImbalanceSec || 0) + dt;
      if (run.vatImbalanceSec > 0.55) {
        run.vatHasBaldSpot = true;
      }
    }

    if (run.vatDrainProgress >= 100) {
      run.vatDone = true;
      run.couchDone = true;
      run.paperStep = 'press';
      if (run.vatHasBaldSpot) run.mistakes++;
      return { status: 'done', tiltDeg: run.deckleTiltDeg, progress: 100, baldSpot: run.vatHasBaldSpot };
    }

    return {
      status: inCenter ? 'balanced' : 'tilted',
      tiltDeg: run.deckleTiltDeg,
      progress: run.vatDrainProgress,
      baldSpot: run.vatHasBaldSpot
    };
  }

  /**
   * Стол 4А: Вращение маховика (кругом мышью или Space) до 100%.
   */
  function advanceFlywheel(run, deltaPercent) {
    if (run.flywheelDone) return { done: true, progress: 100 };
    run.flywheelProgress = Math.max(0, Math.min(100, (run.flywheelProgress || 0) + Math.abs(deltaPercent)));
    run.flywheelAngle = ((run.flywheelAngle || 0) + deltaPercent * 0.12) % (Math.PI * 2);
    if (run.flywheelProgress >= 100) {
      run.flywheelDone = true;
    }
    return { done: run.flywheelDone, progress: run.flywheelProgress };
  }

  /**
   * Стол 4Б: Зажатие рычага пара по термо-стрелке на 3–4 секунды.
   */
  function stepPressSteam(run, isHoldingSteam, dtSec) {
    const dt = Math.min(0.1, Math.max(0.001, dtSec || 0.016));
    if (!run.flywheelDone || run.pressDone) return { event: 'idle' };

    if (isHoldingSteam) {
      run.steamActive = true;
      run.steamSeconds = Math.min(6.0, (run.steamSeconds || 0) + dt);
      if (run.steamSeconds > 4.4) {
        run.pressScorched = true;
      }
      return {
        event: 'steaming',
        seconds: run.steamSeconds,
        zone: run.steamSeconds < 2.8 ? 'heating' : run.steamSeconds <= 4.3 ? 'optimal' : 'scorch'
      };
    }

    if (run.steamActive) {
      run.steamActive = false;
      const sec = run.steamSeconds || 0;
      if (sec < 2.7) {
        run.pressTorn = true;
        run.mistakes++;
      } else if (sec > 4.4) {
        run.pressScorched = true;
        run.mistakes++;
      }
      return finalizePaperSheet(run);
    }

    return { event: 'idle' };
  }

  function computeFinalPaperGrade(run) {
    const hasViolation = Boolean(run.verdict && run.verdict.violation);
    const finalScore = Math.max(
      20,
      100 -
        (run.overflowCount || 0) * 12 -
        (run.phDyeBleed ? 8 : 0) -
        (run.vatHasBaldSpot ? 18 : 0) -
        (run.pressTorn ? 25 : 0) -
        (run.pressScorched ? 25 : 0) -
        (run.mistakes || 0) * 5
    );

    let tierId = 'standard-kraft';
    if (hasViolation || run.pressTorn || run.pressScorched || finalScore < 55) {
      tierId = 'scrap';
    } else if (finalScore >= 85 && !run.vatHasBaldSpot && (run.overflowCount || 0) === 0) {
      tierId = 'royal-grade';
    }

    const tier = PAPER_TIERS[tierId];
    return {
      tierId,
      tier,
      score: finalScore
    };
  }

  function finalizePaperSheet(run) {
    const res = computeFinalPaperGrade(run);
    const fr = run.batch.fractions;
    const fiberG = Math.round(((fr[4] + fr[2]) / 100) * run.batch.massG * 0.2 * 0.5 * 10) / 10;

    run.pressDone = true;
    run.paperStep = 'done';
    run.paper = {
      fiberG,
      gsm: res.tier.gsm,
      gradeId: res.tierId
    };
    run.paperCraft = {
      completed: true,
      fiberG,
      gsm: res.tier.gsm,
      gradeId: res.tierId,
      gradeTitle: res.tier.title,
      recipient: res.tierId === 'royal-grade'
        ? 'Совет наставников станции (штамп лапы слона и подпись Алисы)'
        : res.tierId === 'standard-kraft'
          ? 'Михалыч · Журнал Манежа'
          : 'Компостный бурт (вторичная переработка)',
      purpose: res.tier.subtitle,
      score: res.score,
      torn: Boolean(run.pressTorn),
      scorched: Boolean(run.pressScorched),
      baldSpot: Boolean(run.vatHasBaldSpot)
    };

    return {
      event: 'finished',
      tierId: res.tierId,
      tier: res.tier,
      score: res.score,
      paperCraft: run.paperCraft
    };
  }

  // ===========================================================================
  // БАЗОВОЕ СОСТОЯНИЕ И СОВМЕСТИМЫЕ МЕТОДЫ С ЭТАПОВ 1–4
  // ===========================================================================

  function createRun(batchKeyOrSeed) {
    const presetKey =
      typeof batchKeyOrSeed === 'string' && BATCH_PRESETS[batchKeyOrSeed]
        ? batchKeyOrSeed
        : 'margo-norm';
    const batch = BATCH_PRESETS[presetKey];

    return {
      batchId: batch.id,
      batch,
      activeWing: 'analysis',
      step: 'sieve',
      washed: [],
      waterPressure: 25,
      vibrationAmp: 60,
      washProgress: 0,
      washDone: false,
      overflowCount: 0,
      overflowAccum: 0,
      sieveLog: {},
      focusVal: 20,
      focusLocked: false,
      measuredFibers: [],
      measuredMeanMm: batch.longestFiberMm || batch.meanFiberMm,
      caliperP1: null,
      caliperP2: null,
      microscopeDone: false,
      longFibersDetected: false,
      lowPhDetected: false,
      fiberClass: null,
      fibers: batch.fibers.map((f) => Object.assign({}, f)),
      dipSeconds: 0,
      phDipActive: false,
      phDyeBleed: false,
      stripDipped: false,
      phMatched: false,
      phPicked: null,
      reading: null,
      mistakes: 0,
      lastError: null,
      done: false,
      verdict: null,
      paperAllowed: false,
      paperStep: 'vat',
      selectedGradeId: 'diploma-sovereign',
      deckleTiltDeg: 0,
      vatDrainProgress: 0,
      vatImbalanceSec: 0,
      vatHasBaldSpot: false,
      vatDone: false,
      couchPressurePct: 65,
      couchDone: false,
      flywheelProgress: 0,
      flywheelAngle: 0,
      flywheelDone: false,
      steamActive: false,
      steamSeconds: 0,
      pressTorn: false,
      pressScorched: false,
      pressDone: false,
      pressMPa: 4.0,
      pressSeconds: 3.5,
      paper: null,
      paperCraft: null
    };
  }

  function getAlisaSpeech(state) {
    if (!state) {
      return {
        mood: 'welcome',
        badge: 'Приёмка пробы',
        quote: `«${ALISA_LINES.welcomeManege}»`,
        hint: 'Подойдите к баку у двери и нажмите E.'
      };
    }
    if (state.verdict && state.verdict.longFibers) {
      return {
        mood: 'alert',
        badge: 'Тревога рациона · long-fibers',
        quote: `«${ALISA_LINES.longFibers}»`,
        hint: 'Длина волокон > 20 мм.'
      };
    }
    if (state.verdict && state.verdict.lowPh) {
      return {
        mood: 'alert',
        badge: 'Тревога рациона · low-ph',
        quote: `«${ALISA_LINES.lowPh}»`,
        hint: 'Кислотность pH < 6,2.'
      };
    }
    if (state.paperCraft && state.paperCraft.completed) {
      const q =
        state.paperCraft.gradeId === 'royal-grade'
          ? ALISA_LINES.paperDoneRoyal
          : state.paperCraft.gradeId === 'standard-kraft'
            ? ALISA_LINES.paperDoneStandard
            : ALISA_LINES.paperDoneScrap;
      return {
        mood: state.paperCraft.gradeId === 'scrap' ? 'warn' : 'praise',
        badge: state.paperCraft.gradeTitle,
        quote: `«${q}»`,
        hint: 'Лист опечатан штампом станции.'
      };
    }
    return {
      mood: 'welcome',
      badge: 'Эколаборатория станции',
      quote: `«${ALISA_LINES.welcomeManege}»`,
      hint: 'Проведите пробу через все 4 стола.'
    };
  }

  function washSieve(run, mm, options, maybeVibration) {
    if (run.step !== 'sieve') return { ok: false, reason: 'step' };
    const pressure =
      typeof options === 'number'
        ? options
        : options && typeof options.pressure === 'number'
          ? options.pressure
          : run.waterPressure;
    const vibration =
      typeof maybeVibration === 'number'
        ? maybeVibration
        : options && typeof options.vibration === 'number'
          ? options.vibration
          : run.vibrationAmp;

    run.waterPressure = pressure;
    run.vibrationAmp = vibration;

    const expected = SIEVES[run.washed.length];
    if (mm !== expected) {
      run.mistakes++;
      run.lastError = 'order';
      return { ok: false, reason: 'order', expected };
    }
    if (pressure < 35 || vibration < 25) {
      run.mistakes++;
      run.lastError = 'pressure-low';
      return { ok: false, reason: 'pressure-low', message: ALISA_LINES.weakPressure };
    }
    if (pressure > 85) {
      run.mistakes++;
      run.lastError = 'pressure-high';
      return { ok: false, reason: 'pressure-high', message: ALISA_LINES.overflow };
    }
    run.lastError = null;
    run.washed.push(mm);
    const retainedPct = run.batch.fractions[mm];
    run.sieveLog[mm] = { retainedPct, pressure, vibration };
    if (run.washed.length === SIEVES.length) {
      run.washDone = true;
      run.washProgress = 100;
      run.step = 'microscope';
    }
    return { ok: true, retainedPct, finished: run.step === 'microscope' };
  }

  function adjustMicroscopeFocus(run, focusValue) {
    const val = Math.max(0, Math.min(100, Number(focusValue) || 0));
    run.focusVal = val;
    const target = run.batch ? run.batch.optimalFocus : 56;
    const diff = Math.abs(val - target);
    const clarityPct = Math.max(0, Math.round(100 - diff * 1.8));
    run.focusLocked = clarityPct >= 78;
    return {
      ok: run.focusLocked,
      focusVal: val,
      clarityPct,
      optimalFocus: target
    };
  }

  function measureFiberLength(run, measuredMm) {
    if (run.step !== 'microscope') return { ok: false, reason: 'step' };
    const actual = run.batch.longestFiberMm || run.batch.meanFiberMm;
    const val = Number(measuredMm);
    if (!Number.isFinite(val)) return { ok: false, reason: 'invalid' };
    if (Math.abs(val - actual) > 6.5) {
      run.mistakes++;
      return { ok: false, reason: 'mismatch', actual };
    }
    run.measuredMeanMm = val;
    run.microscopeDone = true;
    run.fiberClass = lengthClassOf(val);
    run.longFibersDetected = val > LONG_FIBER_THRESHOLD_MM;
    run.step = 'ph';
    return { ok: true, meanMm: val, coarseViolation: run.longFibersDetected };
  }

  function pickFiberClass(run, classId) {
    if (run.step !== 'microscope') return { ok: false, reason: 'step' };
    const expected = dominantClass(run.fibers);
    if (classId !== expected) {
      run.mistakes++;
      return { ok: false, reason: 'mismatch', expected };
    }
    run.fiberClass = classId;
    run.microscopeDone = true;
    run.measuredMeanMm = run.batch.longestFiberMm || run.batch.meanFiberMm;
    run.longFibersDetected = run.measuredMeanMm > LONG_FIBER_THRESHOLD_MM;
    run.step = 'ph';
    return { ok: true, classId, meanMm: run.measuredMeanMm };
  }

  function dipPhStrip(run, seconds) {
    const sec = Number(seconds) || 3.0;
    run.dipSeconds = sec;
    if (sec < 2.2) return { ok: false, reason: 'too-short', message: ALISA_LINES.phEarly };
    if (sec > 3.8) {
      run.mistakes++;
      return { ok: false, reason: 'too-long', message: ALISA_LINES.phBleed };
    }
    run.stripDipped = true;
    return { ok: true, ph: run.batch.ph };
  }

  function readStrip(run, ph) {
    if (!run.stripDipped) return { ok: false, reason: 'not-dipped' };
    if (Math.abs(ph - run.batch.ph) > 0.25) {
      run.mistakes++;
      return { ok: false, reason: 'mismatch', actual: run.batch.ph };
    }
    run.phPicked = ph;
    run.phMatched = true;
    run.lowPhDetected = ph < LOW_PH_THRESHOLD;
    run.step = 'reading';
    return { ok: true, ph };
  }

  function interpret(run, readingId) {
    const expected = phReading(run.batch.ph);
    if (readingId !== expected) {
      run.mistakes++;
      return { ok: false, reason: 'mismatch', expected };
    }
    run.reading = readingId;
    finalizeChemVerdict(run);
    return { ok: true, verdict: run.verdict, score: run.verdict.score };
  }

  function performVatDip(run, tiltDeg) {
    const tilt = Number(tiltDeg);
    run.deckleTiltDeg = tilt;
    if (Math.abs(tilt) > 4.2) {
      run.mistakes++;
      run.vatHasBaldSpot = true;
      return { ok: false, reason: 'tilt', message: ALISA_LINES.vatBaldSpot };
    }
    run.vatDone = true;
    run.vatDrainProgress = 100;
    run.paperStep = 'couching';
    return { ok: true, tilt };
  }

  function performCouching(run, pressurePct) {
    if (!run.vatDone) return { ok: false, reason: 'vat-required' };
    const p = Number(pressurePct);
    run.couchPressurePct = p;
    if (p < 50 || p > 80) {
      run.mistakes++;
      return { ok: false, reason: 'pressure', message: 'Неоптимальный нажим валика.' };
    }
    run.couchDone = true;
    run.paperStep = 'press';
    return { ok: true, pressurePct: p };
  }

  function performThermalPress(run, pressureMPa, holdSeconds, gradeId) {
    if (!run.couchDone) return { ok: false, reason: 'couching-required' };
    const mpa = Number(pressureMPa);
    const sec = Number(holdSeconds);
    run.pressMPa = mpa;
    run.pressSeconds = sec;
    if (mpa < 3.2 || sec < 3.0) {
      run.mistakes++;
      return { ok: false, reason: 'undercooked', message: ALISA_LINES.pressTear };
    }
    if (mpa > 4.8 || sec > 5.5) {
      run.mistakes++;
      return { ok: false, reason: 'scorched', message: ALISA_LINES.pressScorch };
    }
    const chosen = PAPER_GRADES[gradeId || run.selectedGradeId] || PAPER_GRADES['diploma-sovereign'];
    run.selectedGradeId = chosen.id;
    run.flywheelDone = true;
    run.pressDone = true;
    run.paperStep = 'done';

    const fr = run.batch.fractions;
    const fiberG = Math.round(((fr[4] + fr[2]) / 100) * run.batch.massG * 0.2 * 0.5 * 10) / 10;
    const gsm = Math.round(fiberG / (0.148 * 0.21));
    const craftScore = computeFinalPaperGrade(run).score;

    run.paper = { fiberG, gsm, gradeId: chosen.id };
    run.paperCraft = {
      completed: true,
      fiberG,
      gsm,
      gradeId: chosen.id,
      gradeTitle: chosen.title,
      recipient: chosen.recipient,
      purpose: chosen.purpose,
      score: craftScore
    };
    return { ok: true, fiberG, gsm, grade: chosen, score: craftScore };
  }

  function castPaperSheet(run, gradeId) {
    if (!run.done) return { ok: false, reason: 'step' };
    if (run.verdict && run.verdict.violation) return { ok: false, reason: 'ration-violation' };
    run.vatDone = true;
    run.couchDone = true;
    return performThermalPress(run, 4.0, 3.5, gradeId || run.selectedGradeId);
  }

  function lengthClassOf(mm) {
    if (mm < 10) return 'lt10';
    if (mm <= LONG_FIBER_THRESHOLD_MM) return '10-20';
    return 'gt25';
  }

  function dominantClass(fibers) {
    const counts = {};
    for (const f of fibers || []) {
      const id = lengthClassOf(f.lengthMm);
      counts[id] = (counts[id] || 0) + 1;
    }
    return LENGTH_CLASSES.reduce(
      (best, c) => ((counts[c.id] || 0) > (counts[best] || 0) ? c.id : best),
      LENGTH_CLASSES[1].id
    );
  }

  function meanLength(fibers) {
    if (!fibers || !fibers.length) return 0;
    return Math.round((fibers.reduce((s, f) => s + f.lengthMm, 0) / fibers.length) * 10) / 10;
  }

  function fieldOfView(batchKey) {
    const preset = BATCH_PRESETS[batchKey] || BATCH_PRESETS['margo-norm'];
    return preset.fibers.map((f) => Object.assign({}, f));
  }

  function phReading(ph) {
    const found = PH_READINGS.find((r) => r.test(ph));
    return found ? found.id : 'norm';
  }

  function score(run) {
    return Math.max(30, 100 - (run.mistakes || 0) * 10);
  }

  function summaryItems(run, now) {
    const at = now || new Date().toISOString();
    const out = {};
    if (run.done && run.verdict) {
      const sc = run.verdict.score || score(run);
      const flags = Array.isArray(run.verdict.flags) ? run.verdict.flags.slice() : [];
      out.analysis = {
        kind: 'analysis',
        status: 'done',
        at,
        score: sc,
        outcome: run.verdict.violation ? 'ration-violation' : 'norm',
        flags
      };
      out[ITEM_ID] = {
        kind: 'analysis',
        status: 'done',
        at,
        score: sc,
        flags
      };
    }
    if (run.paper) {
      const pScore = (run.paperCraft && run.paperCraft.score) || 100;
      const itemFlags = run.verdict && Array.isArray(run.verdict.flags) ? run.verdict.flags.slice() : [];
      out['paper-craft'] = {
        kind: 'craft',
        status: 'done',
        at,
        score: pScore,
        grade: run.paper.gradeId,
        gradeId: run.paper.gradeId,
        gsm: run.paper.gsm,
        flags: itemFlags
      };
      out[PAPER_ID] = {
        kind: 'practice',
        status: 'done',
        at,
        score: pScore,
        grade: run.paper.gradeId,
        gradeId: run.paper.gradeId,
        gsm: run.paper.gsm,
        flags: itemFlags
      };
    }
    return out;
  }

  return {
    ITEM_ID,
    PAPER_ID,
    SIEVES,
    LONG_FIBER_THRESHOLD_MM,
    LOW_PH_THRESHOLD,
    WORLD_WIDTH,
    WORLD_HEIGHT,
    WORKBENCH_WIDTH,
    WORKBENCH_HEIGHT,
    ROOM_STATIONS,
    ALISA_LINES,
    BATCH_PRESETS,
    SAMPLE,
    LENGTH_CLASSES,
    PH_SCALE,
    SAMPLE_PH,
    PH_READINGS,
    PAPER_TIERS,
    PAPER_GRADES,
    createWorldState,
    stepWalkState,
    findNearbyStation,
    stepWashPhysics,
    stepPhDipTimer,
    measureCaliperPoints,
    selectPhScaleSwatch,
    finalizeChemVerdict,
    stepVatBalance,
    advanceFlywheel,
    stepPressSteam,
    computeFinalPaperGrade,
    finalizePaperSheet,
    getAlisaSpeech,
    fieldOfView,
    lengthClassOf,
    dominantClass,
    meanLength,
    phReading,
    createRun,
    washSieve,
    adjustMicroscopeFocus,
    measureFiberLength,
    pickFiberClass,
    dipPhStrip,
    readStrip,
    interpret,
    performVatDip,
    performCouching,
    performThermalPress,
    castPaperSheet,
    score,
    summaryItems
  };
});
