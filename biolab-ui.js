/**
 * Интерактивный тактильный интерфейс Био-лаборатории станции (`biolab-ui.js`).
 * Отрисовывает:
 * - Шапку лаборатории с портретом и живыми репликами ведущего биохимика Алисы (задача C4)
 * - Переключатель проб из бункера Манежа и двух рабочих столов (Стол 1 и Стол 2)
 * - Стол 1 (Научный анализ пробы, задача C3):
 *   1. Каскад вибросит (4 мм → 2 мм → 1 мм) с управлением напором воды и вибрацией
 *   2. Окуляр микроскопа с фокусировкой и окулярной линейкой (замер длины волокон в мм)
 *   3. Экспресс-тест pH (таймер 3 секунды + эталонная цветовая шкала с текстовыми подписями)
 *   4. Вердикт Алисы (флаг `ration-violation` в `ers_progress_v1:biolab` с отправкой Тарасу и Вере Павловне, либо допуск на Стол 2)
 * - Стол 2 (Цех ручной отливки «слоновьей бумаги», задача C4):
 *   1. Черпальная ванна и рамка-декель с водяным пузырьком уровня
 *   2. Куширование на войлочное сукно и прокатка деревянным валиком
 *   3. Винтовой термопресс с манометром и паровой сушкой 5 секунд
 *   4. Выдача готового листа выбранного сорта (для Михалыча, Элеоноры Яковлевны или Итогового Диплома).
 */
(function () {
  const C = window.BiolabCore || window.Coprology;
  const P = window.ErsProgress || window.ErsStation;
  const root = document.getElementById('coprology-lab');
  if (!C || !root) return;

  let run = C.createRun('margo-norm');
  let statusMsg = '';
  let statusTone = '';
  let dipTimerId = null;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function btn(cls, text, onClick, attrs) {
    const b = el('button', cls, text);
    b.type = 'button';
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        b.setAttribute(k, v);
      }
    }
    b.addEventListener('click', onClick);
    return b;
  }

  function say(text, tone) {
    statusMsg = text || '';
    statusTone = tone || '';
    const stEl = document.getElementById('biolab-live-status');
    if (stEl) {
      stEl.textContent = statusMsg;
      stEl.dataset.tone = statusTone;
    }
  }

  function buildAlisaSvg(mood) {
    const accent = mood === 'alert' ? '#9A3412' : mood === 'praise' ? '#1B5E3A' : '#B87333';
    return `
      <svg viewBox="0 0 88 88" class="alisa-avatar-svg" role="img" aria-label="Ведущий биохимик Алиса">
        <circle cx="44" cy="44" r="41" fill="#E8E4DA" stroke="${accent}" stroke-width="2.5"/>
        <!-- Тёплый ореол настольной лампы -->
        <circle cx="44" cy="36" r="28" fill="rgba(217, 155, 67, 0.16)"/>
        <!-- Халат биохимика -->
        <path d="M18 80 C20 62, 68 62, 70 80" fill="#F4F1EA" stroke="#2C302E" stroke-width="2"/>
        <path d="M36 62 L44 75 L52 62" fill="none" stroke="#1B5E3A" stroke-width="2"/>
        <!-- Шея и голова -->
        <rect x="39" y="50" width="10" height="12" rx="4" fill="#E6C6A8"/>
        <ellipse cx="44" cy="38" rx="15" ry="17" fill="#F0D3B8" stroke="#2C302E" stroke-width="1.8"/>
        <!-- Причёска (собранный пучок с карандашом) -->
        <path d="M27 36 C26 20, 62 20, 61 36 C58 26, 30 26, 27 36 Z" fill="#4A3525"/>
        <circle cx="44" cy="17" r="7" fill="#4A3525"/>
        <line x1="33" y1="15" x2="56" y2="19" stroke="#B87333" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Лабораторные очки в тонкой оправе -->
        <circle cx="38" cy="38" r="5.5" fill="rgba(255,255,255,0.55)" stroke="#2C302E" stroke-width="1.6"/>
        <circle cx="50" cy="38" r="5.5" fill="rgba(255,255,255,0.55)" stroke="#2C302E" stroke-width="1.6"/>
        <line x1="43.5" y1="38" x2="44.5" y2="38" stroke="#2C302E" stroke-width="1.6"/>
        <circle cx="38" cy="38" r="1.7" fill="#2C302E"/>
        <circle cx="50" cy="38" r="1.7" fill="#2C302E"/>
        <!-- Мимика -->
        ${
          mood === 'alert'
            ? '<path d="M39 47 Q44 43 49 47" fill="none" stroke="#9A3412" stroke-width="2" stroke-linecap="round"/>'
            : '<path d="M39 46 Q44 50 49 46" fill="none" stroke="#2C302E" stroke-width="2" stroke-linecap="round"/>'
        }
      </svg>
    `;
  }

  function renderAlisaBanner() {
    const speech = C.getAlisaSpeech(run);
    const banner = el('div', `alisa-banner mood-${speech.mood}`);

    const avatarWrap = el('div', 'alisa-avatar-wrap');
    avatarWrap.innerHTML = buildAlisaSvg(speech.mood);

    const content = el('div', 'alisa-speech-box');
    const topRow = el('div', 'alisa-top-row');
    topRow.append(
      el('strong', 'alisa-name', 'Алиса · Ведущий биохимик станции'),
      el('span', 'alisa-stage-tag mono-meta', speech.badge)
    );

    const quote = el('p', 'alisa-quote', speech.quote);
    const hint = el('div', 'alisa-hint mono-meta', speech.hint);

    content.append(topRow, quote, hint);
    banner.append(avatarWrap, content);
    return banner;
  }

  function renderTopControlsBar() {
    const bar = el('div', 'biolab-top-controls');

    // Выбор пробы из бункера Манежа
    const batchGroup = el('div', 'biolab-batch-picker');
    const batchLabel = el('label', 'mono-meta', 'Партия сырья из бункера Манежа:');
    batchLabel.setAttribute('for', 'biolab-batch-select');

    const select = el('select', 'lab-select');
    select.id = 'biolab-batch-select';
    for (const preset of Object.values(C.BATCH_PRESETS)) {
      const opt = el('option', '', preset.title);
      opt.value = preset.id;
      if (preset.id === run.batchId) opt.selected = true;
      select.append(opt);
    }
    select.addEventListener('change', () => {
      run = C.createRun(select.value);
      say(`Загружена ${run.batch.title}. ${run.batch.originNote}`, 'ok');
      render();
    });
    batchGroup.append(batchLabel, select);

    // Переключатель двух столов (Крыло А и Крыло Б)
    const wingsNav = el('div', 'biolab-wings-tabs');
    wingsNav.setAttribute('role', 'tablist');
    wingsNav.setAttribute('aria-label', 'Рабочие столы Био-лаборатории');

    const btnWingA = btn(
      `wing-tab-btn ${run.activeWing === 'analysis' ? 'active' : ''}`,
      'Стол 1 · Научный анализ пробы (Копрограмма)',
      () => {
        run.activeWing = 'analysis';
        render();
      },
      {
        role: 'tab',
        'aria-selected': run.activeWing === 'analysis' ? 'true' : 'false',
        id: 'tab-wing-analysis'
      }
    );

    const canOpenPaper = run.done && run.paperAllowed;
    const btnWingB = btn(
      `wing-tab-btn ${run.activeWing === 'paper' ? 'active' : ''}`,
      canOpenPaper
        ? 'Стол 2 · Бумажная мастерская (Отлив открыт)'
        : 'Стол 2 · Бумажная мастерская (После допуска пробы)',
      () => {
        if (!run.done) {
          say('Сначала завершите копрограмму и экспресс-тест pH на Столе 1, чтобы получить промытую клетчатку.', 'warn');
          return;
        }
        if (!run.paperAllowed) {
          say('Партия забракована: сырьё с недорубом или ацидозом не допускается в чан чистового отлива.', 'warn');
          return;
        }
        run.activeWing = 'paper';
        render();
      },
      {
        role: 'tab',
        'aria-selected': run.activeWing === 'paper' ? 'true' : 'false',
        id: 'tab-wing-paper'
      }
    );

    const closeStationBtn = btn(
      'btn-ghost station-return-btn',
      '← На станцию',
      () => {
        if (P) P.requestClose();
        say('Сигнал возврата отправлен дежурному по станции.', 'ok');
      },
      { id: 'biolab-return-station-btn' }
    );

    wingsNav.append(btnWingA, btnWingB, closeStationBtn);
    bar.append(batchGroup, wingsNav);
    return bar;
  }

  // ===========================================================================
  // КРЫЛО А (СТОЛ 1): НАУЧНЫЙ АНАЛИЗ ПРОБЫ НАВОЗА ИЗ БУНКЕРА
  // ===========================================================================
  function renderWingAStepper() {
    const steps = [
      { id: 'sieve', title: '1. Каскад вибросит (4 → 2 → 1 мм)' },
      { id: 'microscope', title: '2. Микроскопия и линейка (мм)' },
      { id: 'ph', title: '3. Экспресс-тест pH (3 с)' },
      { id: 'done', title: '4. Вердикт Алисы и протокол' }
    ];
    const ol = el('ol', 'copro-steps');
    const order = steps.map((s) => s.id);
    const curIdx = order.indexOf(run.step === 'reading' ? 'ph' : run.step);

    steps.forEach((s, idx) => {
      const cls = idx < curIdx ? 'is-done' : idx === curIdx ? 'is-current' : '';
      const li = el('li', cls, s.title);
      if (idx === curIdx) li.setAttribute('aria-current', 'step');
      ol.append(li);
    });
    return ol;
  }

  function renderSieveStage() {
    const p = el('div', 'copro-panel');
    p.append(
      el(
        'p',
        'copro-lead',
        `${run.batch.title} (${run.batch.massG} г). ${run.batch.originNote} Отрегулируйте напор струи и вибрацию каскада, затем промойте сита строго сверху вниз: 4 мм → 2 мм → 1 мм.`
      )
    );

    // Панель управления физикой промывки (напор воды + амплитуда вибрации)
    const controlsGrid = el('div', 'tactile-controls-grid');

    // 1. Напор струи воды
    const pressBox = el('div', 'tactile-control-card');
    const pressHeader = el('div', 'slider-label-row');
    const pressLbl = el('label', '', 'Напор водяной струи из шланга (норма 45–75%)');
    pressLbl.setAttribute('for', 'sieve-water-pressure');
    const pressVal = el('span', 'mono-num', `${run.waterPressure}%`);
    pressHeader.append(pressLbl, pressVal);

    const pressInput = el('input', 'lab-slider');
    pressInput.type = 'range';
    pressInput.id = 'sieve-water-pressure';
    pressInput.min = '10';
    pressInput.max = '100';
    pressInput.step = '5';
    pressInput.value = String(run.waterPressure);

    const pressHint = el(
      'div',
      'tactile-zone-indicator mono-meta',
      run.waterPressure < 35
        ? '▲ Слабый напор: масса забивает ячейки'
        : run.waterPressure > 85
          ? '▲ Перехлёст через бортик: смыв мелкой фракции!'
          : '● Рабочий напор струи (чистое разделение)'
    );

    pressInput.addEventListener('input', () => {
      run.waterPressure = Number(pressInput.value);
      pressVal.textContent = `${run.waterPressure}%`;
      pressHint.textContent =
        run.waterPressure < 35
          ? '▲ Слабый напор: масса забивает ячейки'
          : run.waterPressure > 85
            ? '▲ Перехлёст через бортик: смыв мелкой фракции!'
            : '● Рабочий напор струи (чистое разделение)';
    });
    pressBox.append(pressHeader, pressInput, pressHint);

    // 2. Вибрация каскада
    const vibBox = el('div', 'tactile-control-card');
    const vibHeader = el('div', 'slider-label-row');
    const vibLbl = el('label', '', 'Ручное покачивание виброкаскада (норма 40–80%)');
    vibLbl.setAttribute('for', 'sieve-vibration-amp');
    const vibVal = el('span', 'mono-num', `${run.vibrationAmp}%`);
    vibHeader.append(vibLbl, vibVal);

    const vibInput = el('input', 'lab-slider');
    vibInput.type = 'range';
    vibInput.id = 'sieve-vibration-amp';
    vibInput.min = '10';
    vibInput.max = '100';
    vibInput.step = '5';
    vibInput.value = String(run.vibrationAmp);

    const vibHint = el('div', 'tactile-zone-indicator mono-meta', '● Равномерная раскладка волокон по сетке');
    vibInput.addEventListener('input', () => {
      run.vibrationAmp = Number(vibInput.value);
      vibVal.textContent = `${run.vibrationAmp}%`;
    });
    vibBox.append(vibHeader, vibInput, vibHint);

    controlsGrid.append(pressBox, vibBox);
    p.append(controlsGrid);

    // Три сита (расположены 1, 4, 2 мм для проверки внимательности стажёра)
    const row = el('div', 'copro-sieves');
    for (const mm of [1, 4, 2]) {
      const washed = run.washed.includes(mm);
      const card = el('div', `copro-sieve${washed ? ' is-washed' : ''}`);
      card.append(el('div', 'copro-sieve-mesh', `${mm} мм`));
      if (washed) {
        card.append(el('div', 'copro-sieve-result', `осталось ${run.batch.fractions[mm]} %`));
      } else {
        card.append(
          btn('btn-secondary', `Промыть на сите ${mm} мм`, () => {
            const r = C.washSieve(run, mm, {
              pressure: run.waterPressure,
              vibration: run.vibrationAmp
            });
            if (!r.ok) {
              if (r.reason === 'order') {
                say(`Сначала сито ${r.expected} мм: мелкая сетка забьётся грубой фракцией.`, 'warn');
              } else {
                say(r.message, 'warn');
              }
            } else if (r.finished) {
              say(
                `Проход через 1 мм — ${run.batch.fractions.fines} %. Вода прозрачная, на ситах чистые фракции — переходим к микроскопу!`,
                'ok'
              );
            } else {
              say(`Сито ${mm} мм промыто: задержано ${r.retainedPct} % навески.`, 'ok');
            }
            render();
          })
        );
      }
      row.append(card);
    }
    p.append(row);
    return p;
  }

  function renderMicroscopeStage() {
    const p = el('div', 'copro-panel');
    p.append(
      el(
        'p',
        'copro-lead',
        'Шаг 2: Настройте резкость окуляра микрометрическим винтом, затем замерьте среднюю длину непереваренных волокон по миллиметровой шкале (1 деление сетки = 5 мм).'
      )
    );

    const focusInfo = C.adjustMicroscopeFocus(run, run.focusLocked ? run.batch.optimalFocus : run.focusVal);
    const blurPx = Math.max(0, ((100 - focusInfo.clarityPct) / 22)).toFixed(1);

    const scopeLayout = el('div', 'microscope-Split-layout');

    // Окуляр с сеткой и линейкой
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'copro-scope');
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      `Окуляр микроскопа: средняя длина волокон около ${run.batch.meanFiberMm} мм на шкале с шагом 5 мм`
    );

    const fiberGroup = document.createElementNS(svgNS, 'g');
    fiberGroup.setAttribute('id', 'microscope-fiber-layer');
    fiberGroup.style.filter = `blur(${blurPx}px)`;

    for (let g = 0; g <= 100; g += 12.5) {
      for (const [x1, y1, x2, y2] of [
        [g, 0, g, 100],
        [0, g, 100, g]
      ]) {
        const l = document.createElementNS(svgNS, 'line');
        l.setAttribute('x1', String(x1));
        l.setAttribute('y1', String(y1));
        l.setAttribute('x2', String(x2));
        l.setAttribute('y2', String(y2));
        l.setAttribute('class', 'copro-grid');
        svg.append(l);
      }
    }

    for (const f of run.fibers) {
      const len = Math.min(78, f.lengthMm * 2.2);
      const a = (f.angle * Math.PI) / 180;
      const dx = (Math.cos(a) * len) / 2;
      const dy = (Math.sin(a) * len) / 2;
      const l = document.createElementNS(svgNS, 'line');
      l.setAttribute('x1', (f.x - dx).toFixed(1));
      l.setAttribute('y1', (f.y - dy).toFixed(1));
      l.setAttribute('x2', (f.x + dx).toFixed(1));
      l.setAttribute('y2', (f.y + dy).toFixed(1));
      l.setAttribute('class', f.major ? 'copro-fiber major-fiber' : 'copro-fiber');
      fiberGroup.append(l);
    }
    svg.append(fiberGroup);

    // Окулярная миллиметровая линейка поверх центра
    const rulerLine = document.createElementNS(svgNS, 'line');
    rulerLine.setAttribute('x1', '15');
    rulerLine.setAttribute('y1', '50');
    rulerLine.setAttribute('x2', '85');
    rulerLine.setAttribute('y2', '50');
    rulerLine.setAttribute('stroke', '#1B5E3A');
    rulerLine.setAttribute('stroke-width', '0.8');
    rulerLine.setAttribute('stroke-dasharray', '2,1');
    svg.append(rulerLine);

    // Правая панель настройки фокуса и окулярной линейки
    const rightCol = el('div', 'microscope-controls-col');

    const focusBox = el('div', 'tactile-control-card');
    const focusRow = el('div', 'slider-label-row');
    const focusLbl = el('label', '', '1. Микрометрический винт фокуса окуляра');
    focusLbl.setAttribute('for', 'microscope-focus-slider');
    const focusReadout = el('span', 'mono-num', `Чёткость: ${focusInfo.clarityPct}%`);
    focusRow.append(focusLbl, focusReadout);

    const focusSlider = el('input', 'lab-slider');
    focusSlider.type = 'range';
    focusSlider.id = 'microscope-focus-slider';
    focusSlider.min = '0';
    focusSlider.max = '100';
    focusSlider.step = '2';
    focusSlider.value = String(run.focusLocked ? run.batch.optimalFocus : run.focusVal);

    const focusQuickBtn = btn('btn-ghost', 'Автофокус на срез ксилемы', () => {
      C.adjustMicroscopeFocus(run, run.batch.optimalFocus);
      say('Фокус наведён: отчётливо видны сосудистые пучки и деления окулярной шкалы.', 'ok');
      render();
    });

    focusSlider.addEventListener('input', () => {
      const res = C.adjustMicroscopeFocus(run, Number(focusSlider.value));
      focusReadout.textContent = `Чёткость: ${res.clarityPct}%`;
      const bPx = Math.max(0, ((100 - res.clarityPct) / 22)).toFixed(1);
      fiberGroup.style.filter = `blur(${bPx}px)`;
    });

    focusBox.append(focusRow, focusSlider, focusQuickBtn);

    // Окулярная линейка (замер в мм)
    const rulerBox = el('div', 'tactile-control-card');
    const rulerRow = el('div', 'slider-label-row');
    const rulerLbl = el('label', '', '2. Замер окулярной линейкой (средняя длина, мм)');
    rulerLbl.setAttribute('for', 'microscope-ruler-mm');
    const rulerVal = el('span', 'mono-num', `${run.measuredMeanMm.toFixed(1).replace('.', ',')} мм`);
    rulerRow.append(rulerLbl, rulerVal);

    const rulerSlider = el('input', 'lab-slider');
    rulerSlider.type = 'range';
    rulerSlider.id = 'microscope-ruler-mm';
    rulerSlider.min = '5';
    rulerSlider.max = '35';
    rulerSlider.step = '0.5';
    rulerSlider.value = String(run.measuredMeanMm);

    rulerSlider.addEventListener('input', () => {
      run.measuredMeanMm = Number(rulerSlider.value);
      rulerVal.textContent = `${run.measuredMeanMm.toFixed(1).replace('.', ',')} мм`;
    });

    const rulerNote = el(
      'div',
      'mono-meta',
      `Контрольный ориентир по сетке для этой пробы: ~${String(run.batch.meanFiberMm).replace('.', ',')} мм (порог брака > 25 мм).`
    );

    const confirmRulerBtn = btn('btn-primary', 'Зафиксировать замер линейкой (мм)', () => {
      C.adjustMicroscopeFocus(run, run.batch.optimalFocus);
      const r = C.measureFiberLength(run, run.measuredMeanMm);
      if (!r.ok) {
        say(r.message, 'warn');
      } else if (r.coarseViolation) {
        say(
          `Зафиксирована крупная фракция ${String(r.meanMm).replace('.', ',')} мм (> 25 мм — недоруб корма!). Переходим к тесту pH.`,
          'warn'
        );
      } else {
        say(
          `Замер точен: средняя длина ${String(r.meanMm).replace('.', ',')} мм (норма 10–20 мм). Переходим к тесту pH.`,
          'ok'
        );
      }
      render();
    });

    rulerBox.append(rulerRow, rulerSlider, rulerNote, confirmRulerBtn);

    // Кнопки быстрого выбора класса длины (для клавиатурной и скринридерной доступности)
    const classChoices = el('div', 'copro-choices');
    for (const c of C.LENGTH_CLASSES) {
      classChoices.append(
        btn('btn-secondary', c.label, () => {
          C.adjustMicroscopeFocus(run, run.batch.optimalFocus);
          const r = C.pickFiberClass(run, c.id);
          if (!r.ok) {
            say('Сверьтесь с сеткой окуляра (1 клетка = 5 мм) и выберите преобладающий размер.', 'warn');
          } else {
            say(`Зафиксирована средняя длина ${String(r.meanMm).replace('.', ',')} мм. Переходим к экспресс-тесту pH.`, 'ok');
          }
          render();
        })
      );
    }

    rightCol.append(focusBox, rulerBox, classChoices);
    scopeLayout.append(svg, rightCol);
    p.append(scopeLayout);

    const listing = el('details', 'copro-listing');
    listing.append(el('summary', '', 'Текстовая расшифровка поля зрения микроскопа'));
    const ul = el('ul', '');
    for (const f of run.fibers) {
      ul.append(el('li', '', `${String(f.lengthMm).replace('.', ',')} мм (${(f.lengthMm / 5).toFixed(1).replace('.', ',')} кл.)`));
    }
    listing.append(ul);
    p.append(listing);

    return p;
  }

  function renderPhStage() {
    const p = el('div', 'copro-panel');
    const actualPh = run.batch.ph;
    const sample = C.PH_SCALE.find((s) => s.ph === actualPh) || C.PH_SCALE[2];

    if (run.step === 'ph') {
      p.append(
        el(
          'p',
          'copro-lead',
          'Шаг 3: Опустите индикаторную полоску пинцетом в центрифугат ровно на 3 секунды, затем сопоставьте проявившийся оттенок с эталонной шкалой.'
        )
      );

      const dipCard = el('div', 'tactile-control-card ph-dip-card');
      const dipStatus = el(
        'div',
        'mono-num',
        run.stripDipped
          ? `● Полоска выдержана 3,0 с — оттенок проявился (${sample.name})`
          : '○ Полоска сухая — опустите в центрифугат на 3,0 с'
      );

      const dipBtn = btn(
        run.stripDipped ? 'btn-secondary' : 'btn-primary',
        run.stripDipped ? 'Повторить выдержку (3,0 с)' : 'Опустить полоску в пробу на 3 секунды',
        () => {
          if (dipTimerId) clearInterval(dipTimerId);
          C.dipPhStrip(run, 3.0);
          say(`Выдержка 3,0 с завершена: полоска окрасилась (${sample.name}). Выберите соответствующий эталон на шкале.`, 'ok');
          render();
        }
      );
      dipCard.append(dipStatus, dipBtn);
      p.append(dipCard);

      const stripWrap = el('div', 'ph-visual-row');
      const strip = el('div', 'copro-strip');
      strip.style.setProperty('--strip', run.stripDipped ? sample.color : '#D8D3C8');
      strip.setAttribute('role', 'img');
      strip.setAttribute(
        'aria-label',
        run.stripDipped ? `Полоска после теста: ${sample.name}` : 'Индикаторная полоска до погружения'
      );

      const scale = el('div', 'copro-scale');
      for (const s of C.PH_SCALE) {
        const b = btn('copro-swatch', `pH ${s.label} · ${s.name}`, () => {
          const r = C.readStrip(run, s.ph);
          if (!r.ok) {
            say(`Оттенок не совпадает (в пробе ${sample.name}). Сравните полоску со шкалой ещё раз.`, 'warn');
          } else {
            say(`Верно: pH ${s.label}. Теперь сформулируйте биохимический вывод для протокола.`, 'ok');
          }
          render();
        });
        b.style.setProperty('--swatch', s.color);
        b.setAttribute('aria-label', `pH ${s.label}, ${s.name}`);
        scale.append(b);
      }

      stripWrap.append(strip, scale);
      p.append(stripWrap);
    } else {
      p.append(el('p', 'copro-lead', `Показатель пробы — pH ${sample.label} (${sample.name}). Какой вердикт вносим в журнал станции?`));
      const choices = el('div', 'copro-choices copro-choices-col');
      for (const r of C.PH_READINGS) {
        choices.append(
          btn('btn-secondary', r.label, () => {
            const res = C.interpret(run, r.id);
            if (!res.ok) {
              say('Сверьтесь с физиологическим коридором заднекишечных ферментеров: норма pH 6,2–7,0, ниже 6,2 — ацидоз.', 'warn');
            } else {
              const savedOk = saveToStationContract();
              if (res.verdict.violation) {
                say(
                  `Зафиксировано нарушение рациона! Протокол отправлен Тарасу в «СлоноВет» и Вере Павловне в Клинику.${savedOk ? '' : ' (Память недоступна)'}`,
                  'warn'
                );
              } else {
                say(
                  `Анализ завершён (${res.score} баллов): показатели в норме! Промытая клетчатка допущена на Стол 2 (Бумажная мастерская).`,
                  'ok'
                );
              }
            }
            render();
          })
        );
      }
      p.append(choices);
    }
    return p;
  }

  function renderVerdictStage() {
    const p = el('div', 'copro-panel');
    const fr = run.batch.fractions;
    const v = run.verdict || {
      meanFiberMm: run.measuredMeanMm,
      ph: run.batch.ph,
      violation: false,
      flags: [],
      dispatchedTo: ['Цех отливки бумаги (Стол 2)'],
      score: C.score(run)
    };

    const card = el('div', `verdict-summary-card ${v.violation ? 'is-violation' : 'is-norm'}`);
    card.append(
      el(
        'h3',
        '',
        v.violation
          ? 'Протокол копрограммы: Выявлено нарушение рациона'
          : 'Протокол копрограммы: Физиологическая норма (Сырьё допущено к отливу)'
      )
    );

    const dl = el('dl', 'copro-report');
    const rows = [
      ['Партия из Манежа', run.batch.title],
      ['Ситовый расклад', `4 мм — ${fr[4]} %, 2 мм — ${fr[2]} %, 1 мм — ${fr[1]} %, проход — ${fr.fines} %`],
      [
        'Средняя длина волокна',
        `${String(v.meanFiberMm).replace('.', ',')} мм ${v.coarseFiber ? '(▲ Превышен порог 25 мм — недоруб корма!)' : '(● Норма перетира 10–20 мм)'}`
      ],
      [
        'Кислотность (pH ЛЖК)',
        `pH ${String(v.ph).replace('.', ',')} ${v.acidosis ? '(▲ Ацидоз < 6,2 — брожение!)' : '(● Буферная норма 6,2–7,0)'}`
      ],
      ['Отметка в формуляре станции', v.violation ? 'Тревога по рациону (передано в Кормокухню и Клинику)' : 'Допуск к отливу бумаги (чистая проба)'],
      ['Маршрут протокола', v.dispatchedTo.join(' + ')],
      ['Итоговый балл точности', `${v.score} из 100`]
    ];
    for (const [k, val] of rows) {
      dl.append(el('dt', '', k), el('dd', '', val));
    }
    card.append(dl);
    p.append(card);

    const actions = el('div', 'copro-actions');
    if (!v.violation) {
      actions.append(
        btn('btn-primary', 'Перейти за Стол 2: Отлить лист «слоновьей бумаги» →', () => {
          run.activeWing = 'paper';
          say('Добро пожаловать в Бумажную мастерскую! Выберите целевой сорт листа и опустите рамку в черпальную ванну.', 'ok');
          render();
        })
      );
    } else {
      actions.append(
        btn('btn-secondary', 'Взять эталонную пробу Марго (после коррекции рациона)', () => {
          run = C.createRun('margo-norm');
          say('Загружена эталонная проба №14-А после исправления резки на кормокухне.', 'ok');
          render();
        })
      );
    }

    actions.append(
      btn('btn-ghost', 'Повторить анализ текущей пробы', () => {
        run = C.createRun(run.batchId);
        say('');
        render();
      })
    );

    if (P && P.embedded()) {
      actions.append(btn('btn-secondary', '← Вернуться на станцию', () => P.requestClose()));
    }

    p.append(actions);
    return p;
  }

  // ===========================================================================
  // КРЫЛО Б (СТОЛ 2): ЦЕХ РУЧНОЙ ОТЛИВКИ «СЛОНОВЬЕЙ БУМАГИ»
  // ===========================================================================
  function renderPaperWorkshopWing() {
    const p = el('div', 'copro-panel paper-workshop-panel');

    if (!run.done || (run.verdict && run.verdict.violation)) {
      p.append(
        el(
          'p',
          'copro-lead',
          'Бумажная мастерская принимает только проверенную и промытую целлюлозу с сит 4 и 2 мм без признаков ацидоза и грубого недоруба.'
        ),
        btn('btn-primary', '← Вернуться за Стол 1 (Научный анализ пробы)', () => {
          run.activeWing = 'analysis';
          render();
        })
      );
      return p;
    }

    // Шаговый индикатор Стола 2
    const steps = [
      { id: 'vat', title: '1. Черпальная ванна и уровень декеля' },
      { id: 'couching', title: '2. Куширование на сукно валиком' },
      { id: 'press', title: '3. Винтовой термопресс (манометр)' },
      { id: 'done', title: '4. Готовый сортовой лист станции' }
    ];
    const ol = el('ol', 'copro-steps');
    const order = steps.map((s) => s.id);
    const curIdx = order.indexOf(run.paperStep);
    steps.forEach((s, i) => {
      const li = el('li', i < curIdx ? 'is-done' : i === curIdx ? 'is-current' : '', s.title);
      if (i === curIdx) li.setAttribute('aria-current', 'step');
      ol.append(li);
    });
    p.append(ol);

    // Выбор целевого сорта бумаги (для Михалыча, Элеоноры Яковлевны или Итогового Диплома)
    const gradePicker = el('div', 'tactile-control-card');
    const gradeLbl = el('label', '', 'Назначение отливаемого листа в экономике станции:');
    gradeLbl.setAttribute('for', 'paper-grade-select');
    const gradeSelect = el('select', 'lab-select');
    gradeSelect.id = 'paper-grade-select';
    for (const g of Object.values(C.PAPER_GRADES)) {
      const opt = el('option', '', `${g.title} — ${g.recipient}`);
      opt.value = g.id;
      if (g.id === run.selectedGradeId) opt.selected = true;
      gradeSelect.append(opt);
    }
    const activeGrade = C.PAPER_GRADES[run.selectedGradeId] || C.PAPER_GRADES['archival-photo'];
    const gradePurpose = el('div', 'mono-meta', activeGrade.purpose);
    gradeSelect.addEventListener('change', () => {
      run.selectedGradeId = gradeSelect.value;
      render();
    });
    gradePicker.append(gradeLbl, gradeSelect, gradePurpose);
    p.append(gradePicker);

    if (run.paperStep === 'vat') {
      const card = el('div', 'tactile-control-card');
      card.append(
        el(
          'h4',
          '',
          'Этап 1: Черпальная ванна — удержание горизонтального уровня рамки (декеля)'
        ),
        el(
          'p',
          '',
          'Поднимите сетчатую рамку из тёплой пульпы, удерживая водяной пузырёк уровня строго по центру (допуск наклона от −4° до +4°), чтобы лист A5 не вышел клином.'
        )
      );

      const row = el('div', 'slider-label-row');
      const lbl = el('label', '', 'Наклон отливной рамки (водяной уровень)');
      lbl.setAttribute('for', 'vat-tilt-slider');
      const val = el('span', 'mono-num', `${run.deckleTiltDeg.toFixed(1)}°`);
      row.append(lbl, val);

      const slider = el('input', 'lab-slider');
      slider.type = 'range';
      slider.id = 'vat-tilt-slider';
      slider.min = '-12';
      slider.max = '12';
      slider.step = '0.5';
      slider.value = String(run.deckleTiltDeg);

      const bubbleTrack = el('div', 'bubble-level-track');
      const bubbleDot = el('div', 'bubble-level-dot');
      bubbleDot.style.transform = `translateX(${run.deckleTiltDeg * 6}px)`;
      bubbleTrack.append(bubbleDot);

      slider.addEventListener('input', () => {
        run.deckleTiltDeg = Number(slider.value);
        val.textContent = `${run.deckleTiltDeg.toFixed(1)}°`;
        bubbleDot.style.transform = `translateX(${run.deckleTiltDeg * 6}px)`;
      });

      const dipBtn = btn('btn-primary', 'Поднять рамку и переплести волокна', () => {
        const r = C.performVatDip(run, run.deckleTiltDeg);
        if (!r.ok) {
          say(r.message, 'warn');
        } else {
          say('Волокна легли ровным изотропным ковром без клина! Переходим к кушированию на войлок.', 'ok');
        }
        render();
      });

      card.append(row, slider, bubbleTrack, dipBtn);
      p.append(card);
    } else if (run.paperStep === 'couching') {
      const card = el('div', 'tactile-control-card');
      card.append(
        el('h4', '', 'Этап 2: Куширование — перенос на влажное сукно и прокатка деревянным валиком'),
        el(
          'p',
          '',
          'Прижмите перевёрнутую сетку к войлоку и прокатите валиком с усилием 50–80%, чтобы выгнать пузыри воздуха и услышать чистый влажный «чпок».'
        )
      );

      const row = el('div', 'slider-label-row');
      const lbl = el('label', '', 'Усилие нажима деревянного валика (норма 50–80%)');
      lbl.setAttribute('for', 'couch-pressure-slider');
      const val = el('span', 'mono-num', `${run.couchPressurePct}%`);
      row.append(lbl, val);

      const slider = el('input', 'lab-slider');
      slider.type = 'range';
      slider.id = 'couch-pressure-slider';
      slider.min = '20';
      slider.max = '95';
      slider.step = '5';
      slider.value = String(run.couchPressurePct);

      slider.addEventListener('input', () => {
        run.couchPressurePct = Number(slider.value);
        val.textContent = `${run.couchPressurePct}%`;
      });

      const couchBtn = btn('btn-primary', 'Прокатать валиком и снять декель', () => {
        const r = C.performCouching(run, run.couchPressurePct);
        if (!r.ok) {
          say(r.message, 'warn');
        } else {
          say('Чпок! Сетка чисто отошла от мокрого полотна без единого пузыря. Переходим к винтовому термопрессу.', 'ok');
        }
        render();
      });

      card.append(row, slider, couchBtn);
      p.append(card);
    } else if (run.paperStep === 'press') {
      const card = el('div', 'tactile-control-card');
      card.append(
        el('h4', '', 'Этап 3: Чугунный винтовой термопресс и паровая сушка'),
        el(
          'p',
          '',
          'Закрутите штурвал с противовесами до зелёной зоны манометра (3,5–4,5 МПа) и выдержите нагрев 5,0 секунд.'
        )
      );

      const mpaRow = el('div', 'slider-label-row');
      const mpaLbl = el('label', '', 'Давление манометра пресса (зелёная зона 3,5–4,5 МПа)');
      mpaLbl.setAttribute('for', 'press-mpa-slider');
      const mpaVal = el('span', 'mono-num', `${run.pressMPa.toFixed(1)} МПа`);
      mpaRow.append(mpaLbl, mpaVal);

      const mpaSlider = el('input', 'lab-slider');
      mpaSlider.type = 'range';
      mpaSlider.id = 'press-mpa-slider';
      mpaSlider.min = '2.0';
      mpaSlider.max = '5.5';
      mpaSlider.step = '0.1';
      mpaSlider.value = String(run.pressMPa);

      mpaSlider.addEventListener('input', () => {
        run.pressMPa = Number(mpaSlider.value);
        mpaVal.textContent = `${run.pressMPa.toFixed(1)} МПа`;
      });

      const pressBtn = btn('btn-primary', 'Опрессовать и высушить лист (5,0 с)', () => {
        const r = C.performThermalPress(run, run.pressMPa, 5.0, run.selectedGradeId);
        if (!r.ok) {
          say(r.message, 'warn');
        } else {
          const savedOk = saveToStationContract();
          say(
            `Лист готов: ${r.gsm} г/м² («${r.grade.title}» для адресата: ${r.grade.recipient}). Записано в формуляр станции!${savedOk ? '' : ' (Память недоступна)'}`,
            'ok'
          );
        }
        render();
      });

      card.append(mpaRow, mpaSlider, pressBtn);
      p.append(card);
    } else {
      // Готовый лист бумаги
      const info = run.paperCraft;
      const sheetCard = el('div', 'crafted-sheet-showcase');

      const sheetVisual = el('div', 'copro-sheet stamped-sheet');
      sheetVisual.append(
        el('div', 'sheet-watermark mono-meta', 'ERS · BIO-LAB SEAL'),
        el('strong', '', `Лист A5 · ${info.gsm} г/м²`),
        el('span', 'sheet-grade-name', info.gradeTitle),
        el('small', '', `${String(info.fiberG).replace('.', ',')} г чистой целлюлозы с сит 4 и 2 мм`)
      );

      const details = el('div', 'crafted-sheet-details');
      details.append(
        el('h4', '', `Готовый артефакт: ${info.gradeTitle}`),
        el('p', '', `Адресат на станции: ${info.recipient}`),
        el('p', 'copro-note', info.purpose),
        el('div', 'mono-meta', `Оценка качества отлива: ${info.score} / 100 · Внесено в формуляр станции и Студенческий билет`)
      );

      const actions = el('div', 'copro-actions');
      actions.append(
        btn('btn-secondary', 'Отлить ещё один лист (другого сорта)', () => {
          run.paperStep = 'vat';
          run.vatDone = false;
          run.couchDone = false;
          render();
        }),
        btn('btn-ghost', '← К протоколу Стола 1', () => {
          run.activeWing = 'analysis';
          render();
        })
      );
      if (P && P.embedded()) {
        actions.append(btn('btn-primary', '← Вернуться на станцию', () => P.requestClose()));
      }
      details.append(actions);

      sheetCard.append(sheetVisual, details);
      p.append(sheetCard);
    }

    return p;
  }

  /**
   * Сохраняет состояние Стола 1 и Стола 2 в `ers_progress_v1:biolab` через `ers-progress.js`.
   */
  function saveToStationContract() {
    if (!P) return false;
    const nowIso = new Date().toISOString();
    let ok = true;
    if (run.done && run.verdict) {
      ok = P.recordAnalysisVerdict(Object.assign({}, run.verdict, { at: nowIso })) && ok;
    }
    if (run.paperCraft && run.paperCraft.completed) {
      ok = P.recordPaperCraft(Object.assign({}, run.paperCraft, { at: nowIso })) && ok;
    }
    const items = C.summaryItems(run, nowIso);
    for (const [id, item] of Object.entries(items)) {
      ok = P.recordItem(id, item) && ok;
    }
    return ok;
  }

  function render() {
    const statusEl = el('p', 'copro-status', statusMsg);
    statusEl.id = 'biolab-live-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.dataset.tone = statusTone;

    const alisaBanner = renderAlisaBanner();
    const topControls = renderTopControlsBar();

    let stageContent;
    if (run.activeWing === 'paper') {
      stageContent = renderPaperWorkshopWing();
    } else {
      const stepper = renderWingAStepper();
      const body =
        run.step === 'sieve'
          ? renderSieveStage()
          : run.step === 'microscope'
            ? renderMicroscopeStage()
            : run.step === 'done'
              ? renderVerdictStage()
              : renderPhStage();
      stageContent = el('div', 'wing-a-container');
      stageContent.append(stepper, body);
    }

    root.replaceChildren(alisaBanner, topControls, stageContent, statusEl);
  }

  render();
})();
