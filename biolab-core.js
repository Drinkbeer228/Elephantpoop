/**
 * Чистая физическая и геймдизайнерская логика Эко-лаборатории (`biolab-core.js`).
 * Реализует:
 * - Ведущего персонажа: биохимик Алиса (живые реплики на каждый шаг стажёра)
 * - Стол 1 (Копрограмма и биохимия пробы из бункера Манежа):
 *   1) Промывка на каскаде вибросит 4 мм → 2 мм → 1 мм (управление напором воды и вибрацией)
 *   2) Микроскопия волокон с настройкой фокуса и замером длины окулярной линейкой
 *   3) Экспресс-тест pH (погружение индикаторной полоски на 3 с и считывание оттенка)
 *   4) Вердикт Алисы: норма (допуск на Стол 2) ИЛИ нарушение рациона (`ration-violation` при длине > 25 мм или pH < 6.2)
 *      с отправкой протокола Тарасу в «СлоноВет» и Вере Павловне в Клинику.
 * - Стол 2 (Цех ручной отливки «слоновьей бумаги»):
 *   1) Черпальная ванна (декель и сетка): удержание водяного пузырька горизонтального уровня
 *   2) Куширование: перенос влажного слоя на войлок и прокатка валиком без пузырей
 *   3) Винтовой термопресс: закрутка штурвала до зелёной зоны манометра (3.5–4.5 МПа) и сушка 5 с
 *   4) Выдача готового листа одного из 3 целевых сортов станции.
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

  /**
   * Партии проб, привезённые электрокаром из бункера Манежа.
   * Поддерживают как эталонную пробу, так и кейсы нарушения рациона (грубая резка > 25 мм и кислый pH < 6.2).
   */
  const BATCH_PRESETS = {
    'margo-norm': {
      id: 'margo-norm',
      title: 'Проба №14-А · Слониха Марго (утренний сбор)',
      originNote: 'Электрокар доставил контейнер с пандуса Манежа: сбалансированное луговое сено, отава и ветки ивы.',
      massG: 100,
      fractions: { 4: 26, 2: 39, 1: 21, fines: 14 },
      meanFiberMm: 14.5,
      dominantClass: '10-20',
      ph: 6.8,
      optimalFocus: 54,
      fibers: [
        { id: 'f1', lengthMm: 15.0, x: 24, y: 34, angle: 18, major: true },
        { id: 'f2', lengthMm: 16.5, x: 58, y: 46, angle: -24, major: true },
        { id: 'f3', lengthMm: 12.0, x: 42, y: 68, angle: 35, major: true },
        { id: 'f4', lengthMm: 9.5, x: 72, y: 28, angle: 65, major: false },
        { id: 'f5', lengthMm: 14.0, x: 32, y: 54, angle: -12, major: false },
        { id: 'f6', lengthMm: 18.0, x: 64, y: 72, angle: 8, major: false },
        { id: 'f7', lengthMm: 7.5, x: 22, y: 74, angle: -48, major: false },
        { id: 'f8', lengthMm: 13.5, x: 50, y: 24, angle: 14, major: false }
      ]
    },
    'margo-coarse': {
      id: 'margo-coarse',
      title: 'Проба №15-Б · Слониха Марго (после спешки на кормокухне)',
      originNote: 'В бункере заметны крупные куски кормовой свёклы, тыквы и неперемятая грубая солома.',
      massG: 100,
      fractions: { 4: 48, 2: 24, 1: 16, fines: 12 },
      meanFiberMm: 29.0,
      dominantClass: 'gt25',
      ph: 6.2,
      optimalFocus: 62,
      fibers: [
        { id: 'f1', lengthMm: 31.0, x: 34, y: 36, angle: 12, major: true },
        { id: 'f2', lengthMm: 28.5, x: 54, y: 52, angle: -18, major: true },
        { id: 'f3', lengthMm: 27.5, x: 46, y: 72, angle: 22, major: true },
        { id: 'f4', lengthMm: 26.0, x: 66, y: 30, angle: -35, major: false },
        { id: 'f5', lengthMm: 19.0, x: 25, y: 60, angle: 44, major: false },
        { id: 'f6', lengthMm: 30.0, x: 52, y: 22, angle: 6, major: false }
      ]
    },
    'pretty-acid': {
      id: 'pretty-acid',
      title: 'Проба №16-В · Слониха Претти (поилка №2 и избыток каши)',
      originNote: 'Влажный болюс с резким запахом брожения: на кормокухне пересыпали сладких гранул и запаренной каши.',
      massG: 100,
      fractions: { 4: 22, 2: 31, 1: 25, fines: 22 },
      meanFiberMm: 16.0,
      dominantClass: '10-20',
      ph: 5.6,
      optimalFocus: 46,
      fibers: [
        { id: 'f1', lengthMm: 17.0, x: 30, y: 38, angle: -15, major: true },
        { id: 'f2', lengthMm: 15.5, x: 62, y: 48, angle: 28, major: true },
        { id: 'f3', lengthMm: 15.5, x: 44, y: 66, angle: -8, major: true },
        { id: 'f4', lengthMm: 11.0, x: 70, y: 26, angle: 52, major: false },
        { id: 'f5', lengthMm: 18.0, x: 28, y: 70, angle: 19, major: false }
      ]
    }
  };

  const SAMPLE = BATCH_PRESETS['margo-norm'];

  const LENGTH_CLASSES = [
    { id: 'lt10', label: 'Короче 10 мм (мелкий перетир)', min: 0, max: 10, repMm: 7.5 },
    { id: '10-20', label: '10–20 мм (эталонная мацерация ~14,5 мм)', min: 10, max: 25, repMm: 14.5 },
    { id: 'gt25', label: 'Длиннее 25 мм (грубый недоруб > 25 мм)', min: 25, max: Infinity, repMm: 29.0 }
  ];

  const PH_SCALE = [
    { ph: 5.6, color: '#C86D2D', label: '5,6', name: 'кирпично-оранжевая (кислая, pH < 6,2)' },
    { ph: 6.2, color: '#C4A634', label: '6,2', name: 'жёлто-оливковая (нижняя граница)' },
    { ph: 6.8, color: '#6E983B', label: '6,8', name: 'травянисто-зелёная (норма 6,2–7,0)' },
    { ph: 7.4, color: '#2F7D67', label: '7,4', name: 'сине-зелёная (щелочной сдвиг > 7,0)' }
  ];

  const SAMPLE_PH = 6.8;

  const PH_READINGS = [
    {
      id: 'acid',
      label: 'Ацидоз слепой кишки (pH < 6,2): брожение углеводов, спазм и вздутие — срочный сигнал в Клинику и СлоноВет',
      test: (ph) => ph < 6.2
    },
    {
      id: 'norm',
      label: 'Физиологическая норма (pH 6,2–7,0): симбиотическая ферментация клетчатки идёт ровно',
      test: (ph) => ph >= 6.2 && ph <= 7.0
    },
    {
      id: 'alk',
      label: 'Щелочной сдвиг (pH > 7,0): вялая ферментация и дефицит летучих жирных кислот',
      test: (ph) => ph > 7.0
    }
  ];

  /**
   * Сорта крафтовой слоновьей бумаги, которые реально работают в экономике станции (MASTER-ROADMAP §3).
   */
  const PAPER_GRADES = {
    'archival-photo': {
      id: 'archival-photo',
      title: 'Архивный лист слоновой кости (для фототипии в Читальном зале)',
      recipient: 'Элеонора Яковлевна · Читальный зал',
      purpose: 'Печать архивных негативов 1998 года под фотоувеличителем и вклейка открытки в Студенческий билет.',
      targetGsm: 209,
      finishNote: 'Гладкий лист ручного отлива с водяным знаком станции и мягким волокнистым просветом.'
    },
    'duty-waterproof': {
      id: 'duty-waterproof',
      title: 'Плотный водостойкий формуляр (для ночного наряда Михалычу)',
      recipient: 'Михалыч · Корпус Манежа',
      purpose: 'Выписка «Наряда на бесконтактный тренинг» и допуска к ночному дежурству (наблюдение за REM-сном слонов).',
      targetGsm: 235,
      finishNote: 'Армированный лист высокой плотности с добавлением лубяных волокон коры.'
    },
    'diploma-sovereign': {
      id: 'diploma-sovereign',
      title: 'Гербовый лист высшего сорта (для Итогового Диплома стажёра)',
      recipient: 'Совет наставников станции (4 чернильные печати)',
      purpose: 'Оформление Свидетельства исследователя слонов с подписями Элеоноры Яковлевны, Бориса Сергеевича, Михалыча и Веры Павловны.',
      targetGsm: 220,
      finishNote: 'Эталонное полотно с филигранным тиснением и золотистыми вкраплениями стеблей.'
    }
  };

  /**
   * Живые реплики ведущего биохимика Алисы в зависимости от этапа и результата.
   */
  function getAlisaSpeech(state) {
    if (!state) {
      return {
        mood: 'welcome',
        badge: 'Приёмка пробы из Манежа',
        quote:
          '«Привет! Электрокар только что привёз свежую партию из бункера Манежа. Ставь навеску на верхнее сито 4 мм: подавай воду без перехлёста и качай каскад, чтобы отделить чистую целлюлозу от ила».',
        hint: 'Крыло А · Шаг 1: установите напор струи в зелёный коридор (45–75%) и промойте сита 4 → 2 → 1 мм.'
      };
    }

    if (state.activeWing === 'paper') {
      if (state.paperCraft && state.paperCraft.completed) {
        const g = PAPER_GRADES[state.paperCraft.gradeId] || PAPER_GRADES['archival-photo'];
        return {
          mood: 'praise',
          badge: 'Крыло Б · Лист готов и опечатан',
          quote: `«Послушай, как звенит на просвет! Плотность ${state.paperCraft.gsm} г/м², ни единого подпала и ровный край декеля. Это «${g.title}» — смело неси адресату (${g.recipient})!»`,
          hint: 'Результат записан в формуляр станции и зачётную книжку стажёра.'
        };
      }
      if (state.paperStep === 'vat') {
        return {
          mood: 'craft',
          badge: 'Крыло Б · Шаг 1: Черпальная ванна',
          quote:
            '«Опускаем рамку с декелем в тёплую пульпу. Когда поднимаешь — следи за водяным пузырьком уровня! Дёрнешь криво — целлюлоза ляжет клином, а нам нужен ровный переплёт волокон».',
          hint: 'Удерживайте наклон рамки около 0° (в пределах ±4°) и плавно поднимите декель.'
        };
      }
      if (state.paperStep === 'couching') {
        return {
          mood: 'craft',
          badge: 'Крыло Б · Шаг 2: Куширование на войлок',
          quote:
            '«Перевернули рамку на мокрое сукно. Теперь прокатай деревянным валиком с усилием 55–75%: недожмёшь — лист порвётся на сетке, передавишь — вобьёшь волокно в войлок. Слушай характерный влажный „чпок“!»',
          hint: 'Выберите оптимальный нажим валика (55–75%) и прокатите полотно.'
        };
      }
      return {
        mood: 'craft',
        badge: 'Крыло Б · Шаг 3: Винтовой термопресс',
        quote:
          '«Финал: зажимаем стопку под чугунным штурвалом до зелёной зоны манометра (3,5–4,5 МПа) и держим пар ровно 5 секунд. Не передержи, иначе покроется коричневыми подпалинами!»',
        hint: 'Выставьте давление 3,5–4,5 МПа и выдержите сушку 5 секунд.'
      };
    }

    // Крыло А: Научный стол
    if (state.step === 'sieve') {
      const washedCount = state.washed ? state.washed.length : 0;
      if (state.lastError === 'pressure-low') {
        return {
          mood: 'warn',
          badge: 'Крыло А · Каскад вибросит',
          quote:
            '«Напор совсем слабый, и каскад почти не трясётся! Густая масса забила ячейки сетки — прибавь струю воды до 50–70% и активнее раскачивай сито».',
          hint: 'Оптимальный напор воды: 45–75%, амплитуда вибрации: 40–80%.'
        };
      }
      if (state.lastError === 'pressure-high') {
        return {
          mood: 'warn',
          badge: 'Крыло А · Перехлёст через бортик!',
          quote:
            '«Осторожнее со шлангом! Струя бьёт так, что вода перехлёстывает через бортик и смывает мелкую фракцию мимо уловителя. Сбавь напор до 60%».',
          hint: 'Снизьте напор воды в рабочий коридор 45–75%.'
        };
      }
      if (state.lastError === 'order') {
        return {
          mood: 'warn',
          badge: 'Крыло А · Нарушен порядок сит',
          quote:
            '«Стоп-стоп! Нельзя лить неразмытую пробу сразу на мелкую сетку — она мгновенно забьётся крупными стеблями. Идём строго сверху вниз: 4 мм → 2 мм → 1 мм».',
          hint: `Следующее сито по регламенту: ${SIEVES[washedCount]} мм.`
        };
      }
      return {
        mood: 'welcome',
        badge: `Крыло А · Ситовый каскад (${washedCount}/3)`,
        quote:
          washedCount === 0
            ? '«Партия из Манежа на столе. Подавай струю воды из распылителя и покачивай каскад: сначала отсекаем крупную фракцию на сите 4 мм, затем 2 мм и 1 мм».'
            : `«Чисто сработано! Вода светлеет. Переходи к ситу ${SIEVES[washedCount]} мм, удерживая напор без перехлёста».`,
        hint: 'Регулируйте напор воды (45–75%) и вибрацию (40–80%) перед промывкой каждого сита.'
      };
    }

    if (state.step === 'microscope') {
      if (!state.focusLocked) {
        return {
          mood: 'science',
          badge: 'Крыло А · Окуляр микроскопа (Фокусировка)',
          quote:
            '«Капля суспензии под объективом. Крути микрометрический винт, пока контуры сосудистых пучков не станут бритвенно резкими, а потом приложи окулярную линейку к самым крупным стеблям».',
          hint: `Настройте винт фокуса около ${state.batch.optimalFocus}% (до чёткости ≥ 85%).`
        };
      }
      return {
        mood: 'science',
        badge: 'Крыло А · Замер длины волокон (мм)',
        quote:
          '«Резкость поймана! Одно деление сетки окуляра — 5 мм. Протяни линейку поперёк трёх крупных волокон и зафиксируй среднюю длину в миллиметрах».',
        hint: 'Замерьте волокна окулярной линейкой и подтвердите среднюю длину (мм).'
      };
    }

    if (state.step === 'ph' || state.step === 'reading') {
      if (!state.stripDipped) {
        return {
          mood: 'science',
          badge: 'Крыло А · Экспресс-тест pH (ЛЖК)',
          quote:
            '«Берём пинцетом индикаторную полоску и опускаем в центрифугат ровно на 3 секунды. Смотри на таймер: передержишь или недодержишь — оттенок соврёт на полтона».',
          hint: 'Нажмите и удерживайте (или запустите) погружение полоски на 3,0 с.'
        };
      }
      return {
        mood: 'science',
        badge: 'Крыло А · Сверка со шкалой pH',
        quote:
          '«Полоска проявилась! Поднеси её к эталонной шкале под лампой и выбери точный показатель pH и клинический вывод».',
        hint: 'Сопоставьте цвет и текстовое описание оттенка с эталонной шкалой.'
      };
    }

    // Шаг 'done' — Вердикт Алисы
    if (state.verdict && state.verdict.violation) {
      if (state.verdict.coarseFiber && state.verdict.acidosis) {
        return {
          mood: 'alert',
          badge: 'ВЕРДИКТ: Двойное нарушение рациона',
          quote:
            '«Тревога по двум фронтам! Волокна длиннее 25 мм и кислый pH ниже 6,2. Кто-то рубил корнеплоды топором для дров и перекормил слоних кашей. Записываю тревогу по рациону и отправляю экстренный протокол Тарасу в „СлоноВет“ и Вере Павловне в Клинику!»',
          hint: 'Сигнал тревоги записан в формуляр станции. Переход к чистовому отливу заблокирован до нормализации пробы.'
        };
      }
      if (state.verdict.coarseFiber) {
        return {
          mood: 'alert',
          badge: 'ВЕРДИКТ: Грубая резка / Недоруб корма',
          quote:
            '«Смотри на сито 4 мм: волокна длиннее 25 мм! Либо у Марго заклинило моляр и болит челюсть, либо кто-то на кормокухне в Манеже рубил тыкву и свёклу топором для дров. Отправляю сводку Тарасу в „СлоноВет“ — пусть проверит корморезку и прослушает перистальтику стетоскопом!»',
          hint: 'Протокол нарушения резки корма отправлен в «СлоноВет» и Клинику.'
        };
      }
      return {
        mood: 'alert',
        badge: 'ВЕРДИКТ: Ацидоз слепой кишки',
        quote:
          '«Полоска ушла в тревожный кирпично-оранжевый (pH < 6,2)! В слепой кишке брожение из-за избытка крахмала или пустой поилки. Передаю экстренный сигнал Вере Павловне в Клинику и Тарасу в „СлоноВет“ — Претти нужен мягкий фасциальный релиз и буферное сено!»',
        hint: 'Протокол ацидоза отправлен в Клинику и «СлоноВет».'
      };
    }

    return {
      mood: 'praise',
      badge: 'ВЕРДИКТ: Эталонная биохимия и перетир',
      quote:
        '«Хоть на выставку отправляй! Перетир ровный (14,5 мм), pH 6,8 — симбионты слепой кишки работают как часы. Михалыч в Манеже будет доволен. Промытая целлюлоза допущена во второе крыло — пойдём в Бумажную мастерскую отольём лист эко-бумаги!»',
      hint: 'Проба допущена к переработке: откройте Стол 2 (Цех ручной отливки «слоновьей бумаги»).'
    };
  }

  /**
   * Создаёт новую сессию лаборатории для выбранной партии из бункера.
   */
  function createRun(batchKeyOrSeed) {
    const presetKey =
      typeof batchKeyOrSeed === 'string' && BATCH_PRESETS[batchKeyOrSeed]
        ? batchKeyOrSeed
        : 'margo-norm';
    const batch = BATCH_PRESETS[presetKey];

    return {
      batchId: batch.id,
      batch,
      activeWing: 'analysis', // 'analysis' | 'paper'
      step: 'sieve', // 'sieve' | 'microscope' | 'ph' | 'reading' | 'done'
      washed: [],
      waterPressure: 60, // Оптимум 45..75%
      vibrationAmp: 60,  // Оптимум 40..80%
      sieveLog: {},
      focusVal: 20,      // Оптимум batch.optimalFocus (±12)
      focusLocked: false,
      measuredFibers: [],
      measuredMeanMm: batch.meanFiberMm,
      fiberClass: null,
      fibers: batch.fibers.map((f) => Object.assign({}, f)),
      dipSeconds: 0,
      stripDipped: false,
      phPicked: null,
      reading: null,
      mistakes: 0,
      lastError: null,
      done: false,
      verdict: null,
      // Крыло Б: Бумажная мастерская
      paperAllowed: false,
      paperStep: 'vat', // 'vat' | 'couching' | 'press' | 'done'
      selectedGradeId: 'archival-photo',
      deckleTiltDeg: 0, // Оптимум -4..+4 град
      vatDone: false,
      couchPressurePct: 65, // Оптимум 50..80%
      couchDone: false,
      pressMPa: 4.0, // Оптимум 3.5..4.5 МПа
      pressSeconds: 5.0, // Оптимум 4.5..5.5 с
      paper: null,
      paperCraft: null
    };
  }

  /**
   * Шаг 1 Крыла А: Промывка очередного сита (4 → 2 → 1 мм) с проверкой напора воды и вибрации.
   */
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
      return {
        ok: false,
        reason: 'pressure-low',
        message: 'Напор струи или вибрация слишком слабые: волокна не отмылись от тонкого ила.'
      };
    }

    if (pressure > 85) {
      run.mistakes++;
      run.lastError = 'pressure-high';
      return {
        ok: false,
        reason: 'pressure-high',
        message: 'Слишком сильный напор! Струя перехлестнула через бортик и смыла мелкую фракцию.'
      };
    }

    run.lastError = null;
    run.washed.push(mm);
    const retainedPct = run.batch.fractions[mm];
    run.sieveLog[mm] = { retainedPct, pressure, vibration };

    if (run.washed.length === SIEVES.length) {
      run.step = 'microscope';
    }
    return {
      ok: true,
      retainedPct,
      finished: run.step === 'microscope'
    };
  }

  /**
   * Настройка фокуса микроскопа (0..100). Возвращает чёткость изображения (0..100%).
   */
  function adjustMicroscopeFocus(run, focusValue) {
    const val = Math.max(0, Math.min(100, Number(focusValue) || 0));
    run.focusVal = val;
    const target = run.batch ? run.batch.optimalFocus : 54;
    const diff = Math.abs(val - target);
    const clarityPct = Math.max(0, Math.round(100 - diff * 1.8));
    run.focusLocked = clarityPct >= 80;
    return {
      ok: run.focusLocked,
      focusVal: val,
      clarityPct,
      optimalFocus: target
    };
  }

  /**
   * Замер длины волокна окулярной линейкой или выбор класса длины.
   */
  function measureFiberLength(run, measuredMm) {
    if (run.step !== 'microscope') return { ok: false, reason: 'step' };
    const actual = run.batch.meanFiberMm;
    const val = Number(measuredMm);
    if (!Number.isFinite(val)) return { ok: false, reason: 'invalid' };

    if (Math.abs(val - actual) > 4.5) {
      run.mistakes++;
      return {
        ok: false,
        reason: 'inaccurate',
        expectedMm: actual,
        message: `Линейка показывает около ${actual.toFixed(1).replace('.', ',')} мм. Проверьте деления окулярной шкалы (1 клетка = 5 мм).`
      };
    }

    run.focusLocked = true;
    run.measuredMeanMm = val;
    run.fiberClass = val > 25 ? 'gt25' : val >= 10 ? '10-20' : 'lt10';
    run.step = 'ph';
    return {
      ok: true,
      meanMm: val,
      fiberClass: run.fiberClass,
      coarseViolation: val > 25
    };
  }

  /**
   * Совместимость с классическим выбором класса длины (`pickFiberClass`).
   */
  function pickFiberClass(run, classId) {
    if (run.step !== 'microscope') return { ok: false, reason: 'step' };
    const expected = run.batch ? run.batch.dominantClass : dominantClass(run.fibers);
    if (classId !== expected) {
      run.mistakes++;
      return { ok: false, reason: 'wrong', expected };
    }
    run.focusLocked = true;
    run.fiberClass = classId;
    run.measuredMeanMm = run.batch ? run.batch.meanFiberMm : meanLength(run.fibers);
    run.step = 'ph';
    return { ok: true, meanMm: run.measuredMeanMm };
  }

  /**
   * Погружение индикаторной полоски pH на 3 секунды (допуск 2.4–3.8 с).
   */
  function dipPhStrip(run, seconds) {
    if (run.step !== 'ph' && run.step !== 'reading') {
      return { ok: false, reason: 'step' };
    }
    const sec = Number(seconds);
    run.dipSeconds = sec;
    if (sec < 2.3) {
      run.mistakes++;
      return {
        ok: false,
        reason: 'too-short',
        message: 'Полоска вынута слишком рано (< 3 с): реагент не успел проявиться.'
      };
    }
    if (sec > 4.0) {
      run.mistakes++;
      return {
        ok: false,
        reason: 'too-long',
        message: 'Полоска передержана в центрифугате (> 4 с): индикатор начал вымываться.'
      };
    }
    run.stripDipped = true;
    return {
      ok: true,
      seconds: sec,
      actualPh: run.batch.ph
    };
  }

  /**
   * Считывание значения pH по эталонной шкале.
   */
  function readStrip(run, ph) {
    if (run.step !== 'ph') return { ok: false, reason: 'step' };
    const expectedPh = run.batch ? run.batch.ph : SAMPLE_PH;
    if (Number(ph) !== expectedPh) {
      run.mistakes++;
      return { ok: false, reason: 'wrong', expectedPh };
    }
    run.stripDipped = true;
    run.phPicked = expectedPh;
    run.step = 'reading';
    return { ok: true, ph: expectedPh };
  }

  /**
   * Формирование итогового вердикта Стола 1 (норма или `ration-violation`).
   */
  function interpret(run, readingId) {
    if (run.step !== 'reading') return { ok: false, reason: 'step' };
    const actualPh = run.batch ? run.batch.ph : SAMPLE_PH;
    const expectedReading = phReading(actualPh);
    if (readingId !== expectedReading) {
      run.mistakes++;
      return { ok: false, reason: 'wrong', expectedReading };
    }

    run.reading = readingId;
    run.step = 'done';
    run.done = true;

    const meanMm = run.measuredMeanMm || (run.batch ? run.batch.meanFiberMm : 14.5);
    const coarseFiber = meanMm > 25 || run.fiberClass === 'gt25';
    const acidosis = actualPh < 6.2;
    const violation = coarseFiber || acidosis;

    run.verdict = {
      batchId: run.batchId,
      meanFiberMm: meanMm,
      ph: actualPh,
      coarseFiber,
      acidosis,
      violation,
      flags: violation ? ['ration-violation'] : [],
      dispatchedTo: violation ? ['Тарас («СлоноВет»)', 'Вера Павловна (Клиника)'] : ['Цех отливки бумаги (Стол 2)'],
      score: score(run)
    };
    run.paperAllowed = !violation;

    return {
      ok: true,
      score: run.verdict.score,
      verdict: run.verdict
    };
  }

  /**
   * Стол 2 · Этап 1: Черпальная ванна (подъём рамки с удержанием водяного пузырька уровня).
   */
  function performVatDip(run, tiltDeg) {
    if (!run.done) return { ok: false, reason: 'analysis-required' };
    if (run.verdict && run.verdict.violation) {
      return { ok: false, reason: 'ration-violation' };
    }
    const tilt = Number(tiltDeg);
    run.deckleTiltDeg = tilt;
    if (Math.abs(tilt) > 4.5) {
      run.mistakes++;
      return {
        ok: false,
        reason: 'tilt-wedge',
        message: `Рамка наклонена на ${tilt.toFixed(1)}°! Пузырёк уровня ушёл от центра — пульпа легла клином.`
      };
    }
    run.vatDone = true;
    run.paperStep = 'couching';
    return { ok: true, tiltDeg: tilt };
  }

  /**
   * Стол 2 · Этап 2: Куширование (перенос влажного слоя на сукно и прокатка валиком без пузырей).
   */
  function performCouching(run, rollerPressurePct) {
    if (!run.vatDone) return { ok: false, reason: 'vat-required' };
    const press = Number(rollerPressurePct);
    run.couchPressurePct = press;
    if (press < 45) {
      run.mistakes++;
      return {
        ok: false,
        reason: 'underpressed',
        message: 'Слишком слабый нажим валика (< 45%): под слоем остались воздушные пузыри, край остался на сетке.'
      };
    }
    if (press > 82) {
      run.mistakes++;
      return {
        ok: false,
        reason: 'overpressed',
        message: 'Чрезмерный нажим (> 82%): сырые волокна вбились в ворс войлока.'
      };
    }
    run.couchDone = true;
    run.paperStep = 'press';
    return { ok: true, rollerPressurePct: press };
  }

  /**
   * Стол 2 · Этап 3: Винтовой термопресс (закрутка манометра до 3.5–4.5 МПа и сушка) + выдача готового листа.
   */
  function performThermalPress(run, pressureMPa, holdSeconds, gradeId) {
    if (!run.couchDone) return { ok: false, reason: 'couching-required' };
    const mpa = Number(pressureMPa);
    const sec = Number(holdSeconds);
    run.pressMPa = mpa;
    run.pressSeconds = sec;

    if (mpa < 3.2 || sec < 4.0) {
      run.mistakes++;
      return {
        ok: false,
        reason: 'undercooked',
        message: 'Недокручен штурвал (< 3,2 МПа) или короткая сушка: лист остался рыхлым и влажным.'
      };
    }
    if (mpa > 4.8 || sec > 6.5) {
      run.mistakes++;
      return {
        ok: false,
        reason: 'scorched',
        message: 'Перегрев под прессом! Лист покрылся коричневыми подпалинами и стал ломким.'
      };
    }

    const chosenGrade = PAPER_GRADES[gradeId || run.selectedGradeId] || PAPER_GRADES['archival-photo'];
    run.selectedGradeId = chosenGrade.id;

    const fr = run.batch.fractions;
    const fiberG = Math.round(((fr[4] + fr[2]) / 100) * run.batch.massG * 0.2 * 0.5 * 10) / 10;
    const areaM2 = 0.148 * 0.21;
    const gsm = Math.round(fiberG / areaM2);

    const craftScore = Math.max(60, 100 - Math.round(Math.abs(run.deckleTiltDeg) * 3 + Math.abs(mpa - 4.0) * 10));

    run.paperStep = 'done';
    run.paper = { fiberG, gsm, gradeId: chosenGrade.id };
    run.paperCraft = {
      completed: true,
      fiberG,
      gsm,
      gradeId: chosenGrade.id,
      gradeTitle: chosenGrade.title,
      recipient: chosenGrade.recipient,
      purpose: chosenGrade.purpose,
      score: craftScore
    };

    return {
      ok: true,
      fiberG,
      gsm,
      grade: chosenGrade,
      score: craftScore
    };
  }

  /**
   * Быстрый отлив листа (совместимость с `castPaperSheet(run)`).
   */
  function castPaperSheet(run, gradeId) {
    if (!run.done) return { ok: false, reason: 'step' };
    if (run.verdict && run.verdict.violation) {
      return { ok: false, reason: 'ration-violation' };
    }
    run.vatDone = true;
    run.couchDone = true;
    return performThermalPress(run, 4.0, 5.0, gradeId || run.selectedGradeId);
  }

  function lengthClassOf(mm) {
    if (mm < 10) return 'lt10';
    if (mm <= 25) return '10-20';
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
    return Math.max(40, 100 - (run.mistakes || 0) * 10);
  }

  function summaryItems(run, now) {
    const at = now || new Date().toISOString();
    const out = {};
    if (run.done) {
      const sc = score(run);
      out.analysis = {
        kind: 'analysis',
        status: 'done',
        at,
        score: sc,
        outcome: run.verdict && run.verdict.violation ? 'ration-violation' : 'norm'
      };
      out[ITEM_ID] = { kind: 'analysis', status: 'done', at, score: sc };
    }
    if (run.paper) {
      const pScore = (run.paperCraft && run.paperCraft.score) || 100;
      out['paper-craft'] = {
        kind: 'craft',
        status: 'done',
        at,
        score: pScore,
        grade: run.paper.gradeId,
        gsm: run.paper.gsm
      };
      out[PAPER_ID] = {
        kind: 'practice',
        status: 'done',
        at,
        score: pScore,
        grade: run.paper.gradeId,
        gsm: run.paper.gsm
      };
    }
    return out;
  }

  return {
    ITEM_ID,
    PAPER_ID,
    SIEVES,
    BATCH_PRESETS,
    SAMPLE,
    LENGTH_CLASSES,
    PH_SCALE,
    SAMPLE_PH,
    PH_READINGS,
    PAPER_GRADES,
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
