/**
 * 2D Canvas Симулятор Эколаборатории (Elephantpoop)
 * Реализует:
 * - Режим ходьбы (WALK): вид сверху на зал лаборатории (#E8E4DA, сетка #D4CEBF, #2C302E, #2E5A44, #C86D51)
 * - Управление WASD / Стрелки + клик мыши по полу/станциям + кнопка E / Esc
 * - Приёмный бак с проверкой ers_station_v1 или архивным образцом со склада
 * - Режим работы за столом (INTERACTING): 800×600 Canvas с руками в перчатках на 4 столах + Доска Алисы
 * - Компактная панель «Справочник лаборанта» (переносит старые справочные статьи и Слонология.EDU в угол экрана)
 */
(function () {
  const root = document.getElementById('coprology-lab');
  if (!root || typeof window === 'undefined') return;

  const C = window.BiolabCore;
  const P = window.ErsProgress;
  if (!C) return;

  const PAL = {
    floor: '#E8E4DA',
    grid: '#D4CEBF',
    card: '#F4F1EA',
    ink: '#2C302E',
    muted: '#646B67',
    green: '#2E5A44',
    greenSoft: 'rgba(46, 90, 68, 0.14)',
    terra: '#C86D51',
    terraSoft: 'rgba(200, 109, 81, 0.16)',
    glove: '#FFFFFF',
    gloveShade: '#DCE4E2',
    brass: '#B8873D',
    wood: '#A9825A',
    woodDark: '#7C5A38'
  };

  const stationSample = P ? P.readStationSample() : null;
  let world = C.createWorldState(stationSample);

  // ===========================================================================
  // ПОСТРОЕНИЕ КАРКАСА ИНТЕРФЕЙСА (ЖИВАЯ ПАНЕЛЬ АЛИСЫ + CANVAS 2D + ОВЕРЛЕЙ СТОЛОВ)
  // ===========================================================================
  root.innerHTML = '';

  const shell = el('div', 'biolab-2d-shell');

  // 1. Шапка Алисы и текущий статус пробы
  const hudHeader = el('div', 'biolab-2d-hud');
  const alisaCard = el('div', 'alisa-hud-card');
  const alisaPortraitCanvas = document.createElement('canvas');
  alisaPortraitCanvas.width = 64;
  alisaPortraitCanvas.height = 64;
  alisaPortraitCanvas.className = 'alisa-mini-portrait';
  alisaPortraitCanvas.setAttribute('aria-label', 'Биохимик Алиса');
  drawAlisaPortrait(alisaPortraitCanvas);

  const alisaTextCol = el('div', 'alisa-hud-text');
  const alisaTopLine = el('div', 'alisa-hud-topline');
  const alisaTitle = el('strong', '', 'Алиса · Ведущий биохимик');
  const sampleTagEl = el('span', 'sample-status-tag mono-meta', '');
  alisaTopLine.append(alisaTitle, sampleTagEl);

  const alisaSpeechEl = el('p', 'alisa-hud-speech', world.alisa.speech);
  alisaTextCol.append(alisaTopLine, alisaSpeechEl);
  alisaCard.append(alisaPortraitCanvas, alisaTextCol);

  // 2. Компактные кнопки управления в углу (Справочник лаборанта + На станцию)
  const cornerControls = el('div', 'biolab-corner-controls');
  const guideBtn = btn('btn-secondary', 'Справочник лаборанта', () => toggleGuideDrawer(true), {
    id: 'open-lab-guide-btn'
  });
  const returnBtn = btn(
    'btn-ghost',
    '← На станцию',
    () => {
      if (P) P.requestClose();
      setAlisaSpeech('Сигнал возврата отправлен дежурному по станции.', 'welcome');
    },
    { id: 'biolab-return-station-btn' }
  );
  cornerControls.append(guideBtn, returnBtn);

  hudHeader.append(alisaCard, cornerControls);

  // 3. Основной 2D-холст (Вид сверху: WALK)
  const walkStageWrap = el('div', 'walk-stage-wrap');
  const walkCanvas = document.createElement('canvas');
  walkCanvas.id = 'biolab-walk-canvas';
  walkCanvas.width = C.WORLD_WIDTH;
  walkCanvas.height = C.WORLD_HEIGHT;
  walkCanvas.tabIndex = 0;
  walkCanvas.setAttribute('aria-label', 'План Эколаборатории: вид сверху');
  walkStageWrap.append(walkCanvas);

  // Подсказка и кнопка [E] под холстом (доступна и с клавиатуры, и кликом)
  const walkFooterBar = el('div', 'walk-footer-bar');
  const controlsHint = el(
    'span',
    'mono-meta',
    'Ходьба: WASD / Стрелки или клик по полу · Подойти и открыть стол: E · Выйти: Esc'
  );
  const interactActionBtn = btn('btn-primary', '[E] Подойти к приёмному баку', () => triggerNearbyInteract(), {
    id: 'biolab-interact-btn'
  });
  const resetSampleBtn = btn('btn-ghost', 'Новая проба', () => resetLabSession(world.run.batchId), {
    id: 'biolab-reset-btn'
  });
  walkFooterBar.append(controlsHint, interactActionBtn, resetSampleBtn);
  walkStageWrap.append(walkFooterBar);

  // 4. Модальный оверлей рабочего стола (INTERACTING: 800×600 Canvas 2D)
  const wbOverlay = el('div', 'workbench-overlay');
  wbOverlay.id = 'biolab-workbench-overlay';
  wbOverlay.hidden = true;

  const wbModal = el('div', 'workbench-modal');
  const wbTopBar = el('div', 'workbench-topbar');
  const wbTitleEl = el('h3', 'workbench-title', 'Стол 1');
  const wbQuickControls = el('div', 'workbench-quick-controls');
  const wbCloseBtn = btn('btn-secondary', 'Отойти от стола (Esc)', () => exitWorkbench(), {
    id: 'workbench-exit-btn'
  });
  wbTopBar.append(wbTitleEl, wbQuickControls, wbCloseBtn);

  const wbCanvas = document.createElement('canvas');
  wbCanvas.id = 'biolab-workbench-canvas';
  wbCanvas.width = C.WORKBENCH_WIDTH;
  wbCanvas.height = C.WORKBENCH_HEIGHT;
  wbCanvas.tabIndex = 0;

  const wbSubBar = el('div', 'workbench-subbar');
  const wbInstructionEl = el('span', 'wb-instruction', '');
  const wbActionPrimaryBtn = btn('btn-primary', 'Действие', () => handleWorkbenchAuxAction(), {
    id: 'wb-aux-action-btn',
    style: 'display:none'
  });
  wbSubBar.append(wbInstructionEl, wbActionPrimaryBtn);

  // Инструментальная док-панель под 800x600 Canvas (доступные контролы дублируют жесты мыши для клавиатуры/слайдеров)
  const wbControlsDock = el('div', 'workbench-controls-dock');
  wbControlsDock.id = 'wb-controls-dock';

  wbModal.append(wbTopBar, wbCanvas, wbSubBar, wbControlsDock);
  wbOverlay.append(wbModal);

  shell.append(hudHeader, walkStageWrap, wbOverlay);
  root.append(shell);

  // Переносим старые справочные секции в компактный выдвижной ящик «Справочник лаборанта»
  initGuideDrawer();

  // ===========================================================================
  // ВВОД С КЛАВИАТУРЫ И МЫШИ
  // ===========================================================================
  const keys = { up: false, down: false, left: false, right: false, space: false };
  let isPointerDownOnWb = false;
  let wbMouseX = 400;
  let wbMouseY = 300;
  let prevFlywheelAngle = null;
  let simTime = 0;
  let lastFrameTs = performance.now();

  // Эффект частиц (капли воды на Столе 1, пар на Столе 4)
  const particles = [];

  function spawnParticle(x, y, vx, vy, color, radius, life) {
    particles.push({ x, y, vx, vy, color, radius, life, maxLife: life });
  }

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if (e.key === 'Escape') {
      const guideDrawer = document.getElementById('lab-guide-drawer');
      if (guideDrawer && !guideDrawer.hidden) {
        toggleGuideDrawer(false);
        return;
      }
      if (world.mode === 'INTERACTING') {
        e.preventDefault();
        exitWorkbench();
        return;
      }
    }

    if (world.mode === 'WALK') {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц' || e.key === 'ArrowUp') {
        keys.up = true;
        e.preventDefault();
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы' || e.key === 'ArrowDown') {
        keys.down = true;
        e.preventDefault();
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф' || e.key === 'ArrowLeft') {
        keys.left = true;
        e.preventDefault();
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В' || e.key === 'ArrowRight') {
        keys.right = true;
        e.preventDefault();
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') {
        e.preventDefault();
        triggerNearbyInteract();
      }
    } else if (world.mode === 'INTERACTING') {
      if (e.code === 'Space') {
        e.preventDefault();
        keys.space = true;
        if (world.activeStationId === 'press' && !world.run.flywheelDone) {
          C.advanceFlywheel(world.run, 18);
        }
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        keys.left = true;
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        keys.right = true;
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц' || e.key === 'ArrowUp') keys.up = false;
    if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы' || e.key === 'ArrowDown') keys.down = false;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф' || e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В' || e.key === 'ArrowRight') keys.right = false;
    if (e.code === 'Space') keys.space = false;
  });

  // Клик по полу или столу в режиме WALK
  walkCanvas.addEventListener('click', (e) => {
    if (world.mode !== 'WALK') return;
    const pt = canvasPoint(walkCanvas, e);
    // Проверяем, кликнули ли прямо по станции
    const clickedSt = C.ROOM_STATIONS.find(
      (st) => pt.x >= st.x - 10 && pt.x <= st.x + st.w + 10 && pt.y >= st.y - 10 && pt.y <= st.y + st.h + 10
    );
    if (clickedSt) {
      const near = C.findNearbyStation(world.player, 74);
      if (near && near.id === clickedSt.id) {
        interactWithStation(clickedSt.id);
      } else {
        world.player.targetX = clickedSt.interactX;
        world.player.targetY = clickedSt.interactY;
        world.player.pendingInteractStation = clickedSt.id;
      }
    } else {
      world.player.targetX = Math.max(48, Math.min(C.WORLD_WIDTH - 48, pt.x));
      world.player.targetY = Math.max(82, Math.min(C.WORLD_HEIGHT - 44, pt.y));
      world.player.pendingInteractStation = null;
    }
  });

  // События мыши внутри рабочего стола 800×600 (INTERACTING)
  wbCanvas.addEventListener('mousedown', (e) => {
    if (world.mode !== 'INTERACTING') return;
    isPointerDownOnWb = true;
    const pt = canvasPoint(wbCanvas, e);
    wbMouseX = pt.x;
    wbMouseY = pt.y;
    handleWorkbenchPointerDown(pt);
  });

  wbCanvas.addEventListener('mousemove', (e) => {
    if (world.mode !== 'INTERACTING') return;
    const pt = canvasPoint(wbCanvas, e);
    wbMouseX = pt.x;
    wbMouseY = pt.y;
    handleWorkbenchPointerMove(pt);
  });

  window.addEventListener('mouseup', () => {
    isPointerDownOnWb = false;
    prevFlywheelAngle = null;
  });

  wbCanvas.addEventListener(
    'wheel',
    (e) => {
      if (world.mode !== 'INTERACTING' || world.activeStationId !== 'chem') return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 4 : -4;
      const res = C.adjustMicroscopeFocus(world.run, world.run.focusVal + delta);
      syncFocusDockSlider(res.focusVal);
    },
    { passive: false }
  );

  // ===========================================================================
  // ЛОГИКА ВЗАИМОДЕЙСТВИЯ СО СТАНЦИЯМИ И СТОЛАМИ
  // ===========================================================================
  function triggerNearbyInteract() {
    if (world.mode !== 'WALK') return;
    const st = C.findNearbyStation(world.player, 82);
    if (st) {
      interactWithStation(st.id);
    }
  }

  function interactWithStation(stationId) {
    const run = world.run;

    if (stationId === 'bin') {
      if (!world.sampleScooped) {
        world.sampleScooped = true;
        world.player.carrying = 'scoop';
        setAlisaSpeech(C.ALISA_LINES.scoopPicked, 'welcome');
      } else {
        setAlisaSpeech('Навеска уже у вас в совке! Несите её в мерный таз к Столу 1.', 'welcome');
      }
      refreshHudLabels();
      return;
    }

    if (stationId === 'sieves') {
      if (!world.sampleScooped) {
        // Если игрок сразу подошёл к Столу 1 — даём понятную подсказку и возможность зачерпнуть
        setAlisaSpeech(
          world.sampleSource === 'manege' ? C.ALISA_LINES.welcomeManege : C.ALISA_LINES.welcomeArchive,
          'warn'
        );
        return;
      }
      if (!world.sampleDeliveredToSieve) {
        world.sampleDeliveredToSieve = true;
        world.player.carrying = null;
      }
      openWorkbench('sieves');
      return;
    }

    if (stationId === 'chem') {
      if (!run.washDone) {
        setAlisaSpeech('Сначала отмойте пробу от слизи и ила на Столе 1 (Мойка и вибросита)!', 'warn');
        return;
      }
      openWorkbench('chem');
      return;
    }

    if (stationId === 'vat') {
      if (!run.done) {
        setAlisaSpeech('Прежде чем черпать пульпу, завершите анализ pH и микроскопию на Столе 2.', 'warn');
        return;
      }
      openWorkbench('vat');
      return;
    }

    if (stationId === 'press') {
      if (!run.vatDone) {
        setAlisaSpeech('Сначала сформируйте влажное полотно в Черпальной ванне (Стол 3)!', 'warn');
        return;
      }
      openWorkbench('press');
      return;
    }

    if (stationId === 'board') {
      openWorkbench('board');
    }
  }

  function openWorkbench(stationId) {
    world.mode = 'INTERACTING';
    world.activeStationId = stationId;
    isPointerDownOnWb = false;
    prevFlywheelAngle = null;
    wbOverlay.hidden = false;

    const meta = C.ROOM_STATIONS.find((s) => s.id === stationId);
    wbTitleEl.textContent = meta ? meta.label : 'Рабочий стол';
    rebuildWorkbenchDock(stationId);
    refreshHudLabels();
  }

  function exitWorkbench() {
    if (world.run.pressDone) {
      world.player.carrying = null;
    } else if (world.run.vatDone) {
      world.player.carrying = 'wet-sheet';
    } else if (world.run.washDone) {
      world.player.carrying = 'washed-pulp';
    }
    world.mode = 'WALK';
    world.activeStationId = null;
    isPointerDownOnWb = false;
    keys.space = false;
    wbOverlay.hidden = true;
    walkCanvas.focus();
    refreshHudLabels();
  }

  function handleWorkbenchAuxAction() {
    const st = world.activeStationId;
    if (st === 'sieves' && world.run.washDone) {
      exitWorkbench();
      world.player.carrying = 'washed-pulp';
      setAlisaSpeech(C.ALISA_LINES.washDone, 'ok');
    } else if (st === 'chem' && world.run.done) {
      exitWorkbench();
      world.player.carrying = 'washed-pulp';
    } else if (st === 'vat' && world.run.vatDone) {
      exitWorkbench();
      world.player.carrying = 'wet-sheet';
      setAlisaSpeech(C.ALISA_LINES.vatDone, 'ok');
    } else if (st === 'press' && world.run.pressDone) {
      exitWorkbench();
    }
  }

  // ===========================================================================
  // ДОК-ПАНЕЛЬ УПРАВЛЕНИЯ ПОД 800×600 CANVAS (ДЛЯ ТОЧНОСТИ И ДОСТУПНОСТИ)
  // ===========================================================================
  let focusDockSlider = null;
  function syncFocusDockSlider(val) {
    if (focusDockSlider) focusDockSlider.value = String(val);
  }

  function rebuildWorkbenchDock(stationId) {
    wbControlsDock.innerHTML = '';
    focusDockSlider = null;
    wbActionPrimaryBtn.style.display = 'none';

    if (stationId === 'sieves') {
      wbInstructionEl.textContent =
        'Зажмите кнопку мыши на холсте (или ПРОБЕЛ), удерживая стрелку манометра в зелёной зоне (42–76%).';
      const holdBtn = btn('btn-primary', 'Удерживать напор воды', null, { id: 'wb-hold-water-btn' });
      holdBtn.addEventListener('mousedown', () => { isPointerDownOnWb = true; });
      holdBtn.addEventListener('touchstart', (e) => { e.preventDefault(); isPointerDownOnWb = true; });
      window.addEventListener('touchend', () => { isPointerDownOnWb = false; });
      wbControlsDock.append(holdBtn);
      return;
    }

    if (stationId === 'chem') {
      wbInstructionEl.textContent =
        'Слева: удерживайте полоску pH в стакане ровно 3,0 с и выберите эталон (5.5–7.5). Справа: колёсиком мыши наведите фокус и кликните по двум концам самого длинного волокна.';

      // Быстрая панель доступности: фокус микроскопа + кнопка сброса замера
      const focusWrap = el('div', 'dock-focus-group');
      const focusLbl = el('label', 'mono-meta', 'Фокус микроскопа:');
      focusLbl.setAttribute('for', 'wb-focus-range');
      const focusRange = document.createElement('input');
      focusRange.type = 'range';
      focusRange.id = 'wb-focus-range';
      focusRange.className = 'lab-slider';
      focusRange.min = '0';
      focusRange.max = '100';
      focusRange.value = String(world.run.focusVal);
      focusRange.addEventListener('input', () => {
        C.adjustMicroscopeFocus(world.run, Number(focusRange.value));
      });
      focusDockSlider = focusRange;
      focusWrap.append(focusLbl, focusRange);

      const dipQuickBtn = btn('btn-secondary', 'Опустить / вытащить полоску pH', null, {
        id: 'wb-ph-dip-btn'
      });
      dipQuickBtn.addEventListener('mousedown', () => {
        isPointerDownOnWb = true;
        wbMouseX = 180;
        wbMouseY = 230;
      });
      dipQuickBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isPointerDownOnWb = true;
        wbMouseX = 180;
        wbMouseY = 230;
      });

      const resetCaliperBtn = btn('btn-ghost', 'Сбросить линейку', () => {
        world.run.caliperP1 = null;
        world.run.caliperP2 = null;
        world.run.microscopeDone = false;
      });

      wbControlsDock.append(focusWrap, dipQuickBtn, resetCaliperBtn);
      return;
    }

    if (stationId === 'vat') {
      wbInstructionEl.textContent =
        'Двигайте мышь влево-вправо (или A/D), удерживая зелёный пузырёк уровня по центру, пока стекает вода.';
      const tiltWrap = el('div', 'dock-focus-group');
      const tiltLbl = el('label', 'mono-meta', 'Баланс рамки:');
      tiltLbl.setAttribute('for', 'wb-vat-balance-range');
      const tiltRange = document.createElement('input');
      tiltRange.type = 'range';
      tiltRange.id = 'wb-vat-balance-range';
      tiltRange.className = 'lab-slider';
      tiltRange.min = '-10';
      tiltRange.max = '10';
      tiltRange.step = '0.5';
      tiltRange.value = '0';
      tiltRange.addEventListener('input', () => {
        wbMouseX = 400 + Number(tiltRange.value) * 28;
      });
      tiltWrap.append(tiltLbl, tiltRange);
      wbControlsDock.append(tiltWrap);
      return;
    }

    if (stationId === 'press') {
      wbInstructionEl.textContent =
        'Этап 1: вращайте маховик кругом мышью (или ПРОБЕЛ). Этап 2: зажмите рычаг пара по термо-стрелке на 3–4 с.';
      const spinBtn = btn('btn-secondary', 'Прокрутить маховик (+25%)', () => {
        C.advanceFlywheel(world.run, 25);
      }, { id: 'wb-spin-flywheel-btn' });
      const steamBtn = btn('btn-primary', 'Удерживать рычаг пара (3–4 с)', null, {
        id: 'wb-hold-steam-btn'
      });
      steamBtn.addEventListener('mousedown', () => {
        if (world.run.flywheelDone) {
          isPointerDownOnWb = true;
          wbMouseX = 560;
          wbMouseY = 260;
        }
      });
      steamBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (world.run.flywheelDone) {
          isPointerDownOnWb = true;
          wbMouseX = 560;
          wbMouseY = 260;
        }
      });
      wbControlsDock.append(spinBtn, steamBtn);
      return;
    }

    if (stationId === 'board') {
      wbInstructionEl.textContent =
        'Доска биохимика Алисы: выберите входящую пробу из Манежа или архивный образец со склада для тренировки.';
      for (const preset of Object.values(C.BATCH_PRESETS)) {
        const b = btn(
          world.run.batchId === preset.id ? 'btn-primary' : 'btn-secondary',
          preset.title,
          () => {
            resetLabSession(preset.id);
            rebuildWorkbenchDock('board');
          }
        );
        wbControlsDock.append(b);
      }
    }
  }

  // ===========================================================================
  // КЛИКИ ВНУТРИ 800×600 CANVAS (СТОЛ 2 pH-ШКАЛА И ОКУЛЯР, СТОЛ 4 МАХОВИК)
  // ===========================================================================
  function handleWorkbenchPointerDown(pt) {
    const st = world.activeStationId;

    if (st === 'chem') {
      // 1. Клик по эталонным квадратам pH 5.5–7.5 (x: 34..376, y: 455..520)
      if (world.run.stripDipped && pt.x >= 25 && pt.x <= 385 && pt.y >= 445 && pt.y <= 530) {
        const swW = 46;
        const gap = 5;
        const startX = 28;
        for (let i = 0; i < C.PH_SCALE.length; i++) {
          const sx = startX + i * (swW + gap);
          if (pt.x >= sx && pt.x <= sx + swW && pt.y >= 452 && pt.y <= 516) {
            const res = C.selectPhScaleSwatch(world.run, C.PH_SCALE[i].ph);
            if (!res.ok) {
              setAlisaSpeech(`Оттенок не совпадает! Внимательнее сравни полоску (нужно pH ${String(res.actual).replace('.', ',')}).`, 'warn');
            } else {
              onChemPartUpdated();
            }
            return;
          }
        }
      }

      // 2. Клик по окуляру микроскопа (cx: 590, cy: 255, r: 155) для замера длины волокна 2 точками
      const eyeCx = 590;
      const eyeCy = 255;
      const eyeR = 155;
      if (Math.hypot(pt.x - eyeCx, pt.y - eyeCy) <= eyeR) {
        if (!world.run.caliperP1 || (world.run.caliperP1 && world.run.caliperP2)) {
          world.run.caliperP1 = { x: pt.x, y: pt.y };
          world.run.caliperP2 = null;
        } else {
          const res = C.measureCaliperPoints(world.run, world.run.caliperP1, { x: pt.x, y: pt.y }, 8.57);
          if (res.ok) {
            onChemPartUpdated();
          }
        }
        return;
      }

      // 3. Клик по кнопкам фокуса [-] / [+] около регулятора (x: 520..660, y: 440..490)
      if (pt.y >= 440 && pt.y <= 490 && pt.x >= 490 && pt.x <= 545) {
        const r = C.adjustMicroscopeFocus(world.run, world.run.focusVal - 6);
        syncFocusDockSlider(r.focusVal);
      } else if (pt.y >= 440 && pt.y <= 490 && pt.x >= 635 && pt.x <= 690) {
        const r = C.adjustMicroscopeFocus(world.run, world.run.focusVal + 6);
        syncFocusDockSlider(r.focusVal);
      }
    }

    if (st === 'press' && !world.run.flywheelDone) {
      const hubX = 280;
      const hubY = 275;
      if (Math.hypot(pt.x - hubX, pt.y - hubY) <= 130) {
        prevFlywheelAngle = Math.atan2(pt.y - hubY, pt.x - hubX);
      }
    }
  }

  function handleWorkbenchPointerMove(pt) {
    if (world.activeStationId === 'press' && isPointerDownOnWb && !world.run.flywheelDone) {
      const hubX = 280;
      const hubY = 275;
      if (Math.hypot(pt.x - hubX, pt.y - hubY) <= 155) {
        const ang = Math.atan2(pt.y - hubY, pt.x - hubX);
        if (prevFlywheelAngle !== null) {
          let diff = ang - prevFlywheelAngle;
          if (diff > Math.PI) diff -= Math.PI * 2;
          if (diff < -Math.PI) diff += Math.PI * 2;
          C.advanceFlywheel(world.run, Math.abs(diff) * 28);
        }
        prevFlywheelAngle = ang;
      }
    }
  }

  function onChemPartUpdated() {
    const run = world.run;
    if (run.longFibersDetected && !run.phMatched) {
      setAlisaSpeech(C.ALISA_LINES.longFibers, 'alert');
    } else if (run.lowPhDetected && !run.microscopeDone) {
      setAlisaSpeech(C.ALISA_LINES.lowPh, 'alert');
    }

    if (run.done && run.verdict) {
      saveToStationStorage();
      if (run.verdict.longFibers) {
        setAlisaSpeech(C.ALISA_LINES.longFibers, 'alert');
      } else if (run.verdict.lowPh) {
        setAlisaSpeech(C.ALISA_LINES.lowPh, 'alert');
      } else {
        setAlisaSpeech(C.ALISA_LINES.chemDoneNorm, 'ok');
      }
    }
    refreshHudLabels();
  }

  // ===========================================================================
  // ИГРОВОЙ ЦИКЛ (REQUESTANIMATIONFRAME)
  // ===========================================================================
  function tick(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTs) / 1000));
    lastFrameTs = now;
    simTime += dt;

    // Обновляем частицы
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }

    if (world.mode === 'WALK') {
      const walkRes = C.stepWalkState(world, keys, dt);
      if (walkRes && walkRes.arrivedStationId) {
        interactWithStation(walkRes.arrivedStationId);
      }
      renderWalkCanvas();
      updateWalkPrompt();
    } else if (world.mode === 'INTERACTING') {
      stepActiveWorkbench(dt);
      renderWorkbenchCanvas();
    }

    requestAnimationFrame(tick);
  }

  function stepActiveWorkbench(dt) {
    const st = world.activeStationId;
    const run = world.run;

    if (st === 'sieves') {
      const pressing = isPointerDownOnWb || keys.space;
      const res = C.stepWashPhysics(run, pressing, dt);
      if (pressing) {
        const dropCount = run.waterPressure > 80 ? 3 : 1;
        for (let i = 0; i < dropCount; i++) {
          spawnParticle(
            360 + (Math.random() - 0.5) * 40,
            240 + (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * (run.waterPressure > 80 ? 220 : 70),
            (Math.random() - 0.5) * 90,
            run.waterPressure > 80 ? PAL.terra : '#6BA4B8',
            run.waterPressure > 80 ? 5 : 3,
            0.45
          );
        }
      }
      if (res.overflowTriggered) {
        setAlisaSpeech(C.ALISA_LINES.overflow, 'warn');
      } else if (res.status === 'done') {
        setAlisaSpeech(C.ALISA_LINES.washDone, 'ok');
        wbActionPrimaryBtn.style.display = 'inline-flex';
        wbActionPrimaryBtn.textContent = 'Завершить мойку и отойти →';
      }
    } else if (st === 'chem') {
      // Левая зона: опускание полоски pH (x < 385 и y < 440)
      const dippingWithMouse = isPointerDownOnWb && wbMouseX < 385 && wbMouseY < 440;
      const dipRes = C.stepPhDipTimer(run, dippingWithMouse, dt);
      if (dipRes.event === 'bleed') {
        setAlisaSpeech(C.ALISA_LINES.phBleed, 'warn');
      } else if (dipRes.event === 'too-short') {
        setAlisaSpeech(C.ALISA_LINES.phEarly, 'warn');
      } else if (dipRes.event === 'dipped-ready') {
        setAlisaSpeech('Полоска окрасилась! Теперь сопоставьте её со шкалой pH (5.5–7.5) ниже.', 'ok');
      }
      if (run.done) {
        wbActionPrimaryBtn.style.display = 'inline-flex';
        wbActionPrimaryBtn.textContent = 'Забрать пульпу к Столу 3 →';
      }
    } else if (st === 'vat') {
      let targetTilt = (wbMouseX - 400) / 28;
      if (keys.left) targetTilt = -6;
      if (keys.right) targetTilt = 6;
      const res = C.stepVatBalance(run, targetTilt, dt, simTime);
      if (res.baldSpot && Math.random() < 0.05) {
        setAlisaSpeech(C.ALISA_LINES.vatBaldSpot, 'warn');
      }
      if (res.status === 'done') {
        setAlisaSpeech(C.ALISA_LINES.vatDone, 'ok');
        wbActionPrimaryBtn.style.display = 'inline-flex';
        wbActionPrimaryBtn.textContent = 'Забрать лист под пресс (Стол 4) →';
      }
    } else if (st === 'press') {
      if (run.flywheelDone && !run.pressDone) {
        const holdingSteam = (isPointerDownOnWb && wbMouseX > 440) || keys.space;
        const steamRes = C.stepPressSteam(run, holdingSteam, dt);
        if (holdingSteam) {
          spawnParticle(
            520 + (Math.random() - 0.5) * 30,
            240,
            (Math.random() - 0.5) * 40,
            -90 - Math.random() * 40,
            'rgba(244, 241, 234, 0.85)',
            7 + Math.random() * 6,
            0.7
          );
        }
        if (steamRes.event === 'finished') {
          saveToStationStorage();
          if (run.pressTorn) setAlisaSpeech(C.ALISA_LINES.pressTear, 'warn');
          else if (run.pressScorched) setAlisaSpeech(C.ALISA_LINES.pressScorch, 'warn');
          else if (steamRes.tierId === 'royal-grade') setAlisaSpeech(C.ALISA_LINES.paperDoneRoyal, 'ok');
          else if (steamRes.tierId === 'standard-kraft') setAlisaSpeech(C.ALISA_LINES.paperDoneStandard, 'ok');
          else setAlisaSpeech(C.ALISA_LINES.paperDoneScrap, 'warn');

          wbActionPrimaryBtn.style.display = 'inline-flex';
          wbActionPrimaryBtn.textContent = 'Готово! Отойти от пресса →';
          const spinDockBtn = document.getElementById('wb-spin-flywheel-btn');
          const steamDockBtn = document.getElementById('wb-hold-steam-btn');
          if (spinDockBtn) spinDockBtn.style.display = 'none';
          if (steamDockBtn) steamDockBtn.style.display = 'none';
          refreshHudLabels();
        }
      }
    }
  }

  // ===========================================================================
  // ОТРИСОВКА ЗАЛА ЛАБОРАТОРИИ (WALK CANVAS 960×560)
  // ===========================================================================
  function renderWalkCanvas() {
    const ctx = walkCanvas.getContext('2d');
    const W = C.WORLD_WIDTH;
    const H = C.WORLD_HEIGHT;

    // 1. Пол (#E8E4DA) и сетка (#D4CEBF)
    ctx.fillStyle = PAL.floor;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 40; x <= W - 40; x += 40) {
      ctx.moveTo(x, 68);
      ctx.lineTo(x, H - 32);
    }
    for (let y = 68; y <= H - 32; y += 40) {
      ctx.moveTo(40, y);
      ctx.lineTo(W - 40, y);
    }
    ctx.stroke();

    // 2. Архитектурные стены зала
    ctx.fillStyle = '#DCD6C8';
    ctx.fillRect(0, 0, W, 68);
    ctx.fillRect(0, 0, 40, H);
    ctx.fillRect(W - 40, 0, 40, H);
    ctx.fillRect(0, H - 32, W, 32);

    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(40, 68, W - 80, H - 100);

    // Дверь Манежа слева снизу
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(26, 396, 18, 86);
    ctx.strokeRect(26, 396, 18, 86);
    ctx.fillStyle = PAL.ink;
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText('ПАНДУС МАНЕЖА', 46, 504);

    // Заголовок зала на верхней стене
    ctx.fillStyle = PAL.ink;
    ctx.font = '700 15px Georgia, serif';
    ctx.fillText('ЭКОЛАБОРАТОРИЯ · ELEPHANT RESEARCH STATION', 52, 42);

    const nearby = C.findNearbyStation(world.player, 74);

    // 3. Станции (Приёмный бак, 4 рабочих стола, Доска Алисы)
    for (const st of C.ROOM_STATIONS) {
      const isNear = nearby && nearby.id === st.id;
      drawTopDownStation(ctx, st, isNear);
    }

    // 4. Биохимик Алиса у доски
    drawTopDownPerson(ctx, world.alisa.x, world.alisa.y, Math.PI * 0.5, 0, '#F4F1EA', '#5A3A28', null, 'Алиса');

    // 5. Персонаж-стажёр
    drawTopDownPerson(
      ctx,
      world.player.x,
      world.player.y,
      world.player.facing,
      world.player.walkPhase,
      '#FFFFFF',
      PAL.ink,
      world.player.carrying,
      'Стажёр'
    );

    // 6. Всплывающая подсказка [E] над ближайшим столом
    if (nearby) {
      const bx = Math.max(120, Math.min(W - 120, nearby.x + nearby.w / 2));
      const by = Math.max(88, nearby.y - 24);
      const txt = `[E] ${nearby.shortTitle}`;
      ctx.font = '600 12px system-ui, sans-serif';
      const tw = ctx.measureText(txt).width + 20;
      ctx.fillStyle = PAL.card;
      ctx.strokeStyle = PAL.green;
      ctx.lineWidth = 2;
      ctx.fillRect(bx - tw / 2, by - 24, tw, 24);
      ctx.strokeRect(bx - tw / 2, by - 24, tw, 24);
      ctx.fillStyle = PAL.ink;
      ctx.textAlign = 'center';
      ctx.fillText(txt, bx, by - 8);
      ctx.textAlign = 'left';
    }
  }

  function drawTopDownStation(ctx, st, isNear) {
    const run = world.run;
    const isDone =
      (st.id === 'bin' && world.sampleScooped) ||
      (st.id === 'sieves' && run.washDone) ||
      (st.id === 'chem' && run.done) ||
      (st.id === 'vat' && run.vatDone) ||
      (st.id === 'press' && run.pressDone);

    // Мягкая подсветка лабораторной лампы
    if (isNear) {
      ctx.fillStyle = 'rgba(46, 90, 68, 0.14)';
      ctx.fillRect(st.x - 8, st.y - 8, st.w + 16, st.h + 16);
    }

    // Столешница
    ctx.fillStyle = PAL.card;
    ctx.strokeStyle = isNear ? PAL.green : PAL.ink;
    ctx.lineWidth = isNear ? 3 : 2;
    ctx.fillRect(st.x, st.y, st.w, st.h);
    ctx.strokeRect(st.x, st.y, st.w, st.h);

    // Детали каждого стола
    if (st.id === 'bin') {
      // Герметичный бак
      ctx.fillStyle = '#C9C4B8';
      ctx.beginPath();
      ctx.arc(st.x + st.w / 2, st.y + st.h / 2 - 8, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Бирка на баке
      ctx.fillStyle = world.sampleSource === 'manege' ? PAL.terra : '#D6CEBE';
      ctx.fillRect(st.x + 4, st.y + st.h - 24, st.w - 8, 18);
      ctx.strokeRect(st.x + 4, st.y + st.h - 24, st.w - 8, 18);
      ctx.fillStyle = world.sampleSource === 'manege' ? '#FFFFFF' : PAL.ink;
      ctx.font = '700 9.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(world.sampleSource === 'manege' ? 'МАРГО · СВЕЖАЯ' : 'СКЛАД · АРХИВ', st.x + st.w / 2, st.y + st.h - 11);
      ctx.textAlign = 'left';
    } else if (st.id === 'sieves') {
      // Мерный таз + 3 вибросита + шланг
      ctx.fillStyle = '#D2DDD9';
      ctx.fillRect(st.x + 14, st.y + 18, 52, 62);
      ctx.strokeRect(st.x + 14, st.y + 18, 52, 62);
      ctx.fillStyle = run.washDone ? '#DEC99D' : '#6F5534';
      ctx.beginPath();
      ctx.arc(st.x + 114, st.y + 50, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(st.x + 114, st.y + 50, 18, 0, Math.PI * 2);
      ctx.stroke();
    } else if (st.id === 'chem') {
      // Стакан pH + микроскоп
      ctx.fillStyle = '#BFE0DC';
      ctx.beginPath();
      ctx.arc(st.x + 44, st.y + 50, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PAL.brass;
      ctx.fillRect(st.x + 96, st.y + 24, 48, 52);
      ctx.strokeRect(st.x + 96, st.y + 24, 48, 52);
      ctx.fillStyle = '#F7F1DA';
      ctx.beginPath();
      ctx.arc(st.x + 120, st.y + 50, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (st.id === 'vat') {
      // Черпальная ванна с тёплой пульпой и рамкой
      ctx.fillStyle = '#D9C7A3';
      ctx.fillRect(st.x + 16, st.y + 16, st.w - 32, st.h - 32);
      ctx.strokeRect(st.x + 16, st.y + 16, st.w - 32, st.h - 32);
      ctx.strokeStyle = PAL.woodDark;
      ctx.lineWidth = 3;
      ctx.strokeRect(st.x + 40, st.y + 28, st.w - 80, st.h - 56);
    } else if (st.id === 'press') {
      // Чугунный винтовой пресс + маховик
      ctx.fillStyle = '#535856';
      ctx.fillRect(st.x + 22, st.y + 22, 68, 64);
      ctx.strokeRect(st.x + 22, st.y + 22, 68, 64);
      ctx.strokeStyle = PAL.ink;
      ctx.beginPath();
      ctx.arc(st.x + 56, st.y + 54, 22, 0, Math.PI * 2);
      ctx.stroke();
      // Стопка готовой бумаги
      ctx.fillStyle = '#EFE6CF';
      ctx.fillRect(st.x + 110, st.y + 26, 52, 56);
      ctx.strokeRect(st.x + 110, st.y + 26, 52, 56);
    } else if (st.id === 'board') {
      ctx.fillStyle = PAL.green;
      ctx.fillRect(st.x + 10, st.y + 10, st.w - 20, st.h - 20);
      ctx.strokeRect(st.x + 10, st.y + 10, st.w - 20, st.h - 20);
      ctx.fillStyle = '#F4F1EA';
      ctx.font = '500 10px ui-monospace, monospace';
      ctx.fillText('L <= 20 мм', st.x + 18, st.y + 34);
      ctx.fillText('pH 6.2 - 7.0', st.x + 18, st.y + 54);
    }

    // Подпись под/над столом + галочка выполнения
    ctx.fillStyle = PAL.ink;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(st.shortTitle, st.x, st.y - 6);

    if (isDone) {
      ctx.fillStyle = PAL.green;
      ctx.beginPath();
      ctx.arc(st.x + st.w - 10, st.y + 10, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText('✓', st.x + st.w - 14, st.y + 14);
    }
  }

  function drawTopDownPerson(ctx, x, y, angle, phase, coatColor, hairColor, carrying, name) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const bob = Math.sin(phase) * 2.5;

    // Тень
    ctx.fillStyle = 'rgba(44, 48, 46, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 17, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Плечи и лабораторный халат
    ctx.fillStyle = coatColor;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, bob * 0.3, 13, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Руки в перчатках
    ctx.fillStyle = PAL.glove;
    ctx.beginPath();
    ctx.arc(12, -11 + bob, 4.5, 0, Math.PI * 2);
    ctx.arc(12, 11 - bob, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Переносимый предмет в руках (совок / пульпа / мокрый лист)
    if (carrying === 'scoop') {
      ctx.fillStyle = '#B8B5AA';
      ctx.fillRect(14, -7, 13, 14);
      ctx.strokeRect(14, -7, 13, 14);
      ctx.fillStyle = '#6F5534';
      ctx.beginPath();
      ctx.arc(21, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (carrying === 'washed-pulp') {
      ctx.fillStyle = '#EFE3C6';
      ctx.beginPath();
      ctx.arc(19, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (carrying === 'wet-sheet') {
      ctx.fillStyle = '#F4EBD3';
      ctx.fillRect(14, -10, 12, 20);
      ctx.strokeRect(14, -10, 12, 20);
    }

    // Голова
    ctx.fillStyle = '#F2D2B6';
    ctx.beginPath();
    ctx.arc(2, 0, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Волосы
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(-2, 0, 9, Math.PI * 0.45, Math.PI * 1.55);
    ctx.fill();

    ctx.restore();

    if (name) {
      ctx.fillStyle = PAL.ink;
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, x, y + 28);
      ctx.textAlign = 'left';
    }
  }

  // ===========================================================================
  // ОТРИСОВКА РАБОЧИХ СТОЛОВ (800×600 CANVAS 2D)
  // ===========================================================================
  function renderWorkbenchCanvas() {
    const ctx = wbCanvas.getContext('2d');
    const W = C.WORKBENCH_WIDTH;
    const H = C.WORKBENCH_HEIGHT;

    // Единый фон коврика стола (#F4F1EA с рамкой #E8E4DA)
    ctx.fillStyle = PAL.floor;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAL.card;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(16, 16, W - 32, H - 32);
    ctx.strokeRect(16, 16, W - 32, H - 32);

    const st = world.activeStationId;
    if (st === 'sieves') drawTable1Sieves(ctx);
    else if (st === 'chem') drawTable2Chem(ctx);
    else if (st === 'vat') drawTable3Vat(ctx);
    else if (st === 'press') drawTable4Press(ctx);
    else if (st === 'board') drawAlisaBoardOverlay(ctx);

    // Отрисовка частиц (капли воды, пар)
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // --- СТОЛ 1: МОЙКА И ВИБРОСИТА (800×600) ---
  function drawTable1Sieves(ctx) {
    const run = world.run;
    const p = run.waterPressure;
    const prog = run.washProgress;
    const shakeX = p >= 42 ? Math.sin(simTime * 38) * (p > 80 ? 5 : 2.5) : 0;

    // Вибросито (центр)
    const sx = 360 + shakeX;
    const sy = 315;
    ctx.fillStyle = '#D9D3C4';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, 145, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Сетка сита
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, 128, 0, Math.PI * 2);
    ctx.clip();

    // Подложка цвета волокон (от тёмной грязи до чистой золотистой целлюлозы)
    const t = prog / 100;
    const r = Math.round(111 + (225 - 111) * t);
    const g = Math.round(85 + (205 - 85) * t);
    const b = Math.round(52 + (154 - 52) * t);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(sx - 130, sy - 130, 260, 260);

    // Сетчатые линии
    ctx.strokeStyle = 'rgba(44, 48, 46, 0.28)';
    ctx.lineWidth = 1;
    for (let gx = sx - 130; gx <= sx + 130; gx += 16) {
      ctx.beginPath();
      ctx.moveTo(gx, sy - 130);
      ctx.lineTo(gx, sy + 130);
      ctx.stroke();
    }
    for (let gy = sy - 130; gy <= sy + 130; gy += 16) {
      ctx.beginPath();
      ctx.moveTo(sx - 130, gy);
      ctx.lineTo(sx + 130, gy);
      ctx.stroke();
    }

    // Волокна на сите
    ctx.strokeStyle = prog >= 85 ? '#8D6E3E' : '#4A3620';
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      const ang = i * 0.72;
      const rad = 20 + (i % 5) * 20;
      const fx = sx + Math.cos(ang) * rad;
      const fy = sy + Math.sin(ang) * rad;
      ctx.beginPath();
      ctx.moveTo(fx - 14, fy - 6);
      ctx.lineTo(fx + 14, fy + 6);
      ctx.stroke();
    }
    ctx.restore();

    // Шланг в левой руке в перчатке
    const nozzleX = 165;
    const nozzleY = 235 + (isPointerDownOnWb || keys.space ? Math.sin(simTime * 28) * 3 : 0);
    drawGlovedHand(ctx, 115, nozzleY + 12, -0.2);

    ctx.fillStyle = PAL.brass;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(nozzleX - 24, nozzleY - 12, 48, 22);
    ctx.strokeRect(nozzleX - 24, nozzleY - 12, 48, 22);

    // Струя воды к ситу
    if (p > 22) {
      ctx.strokeStyle = p > 80 ? PAL.terra : '#4C8FA6';
      ctx.lineWidth = Math.max(2, p / 11);
      ctx.beginPath();
      ctx.moveTo(nozzleX + 24, nozzleY);
      ctx.quadraticCurveTo(270, nozzleY + 18, sx - 20, sy - 20);
      ctx.stroke();
    }

    // Манометр напора воды (справа сверху)
    const gx = 640;
    const gy = 175;
    const gr = 92;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Зоны на шкале (от 135° до 405°)
    drawGaugeArc(ctx, gx, gy, gr - 14, 0, 42, PAL.terra);
    drawGaugeArc(ctx, gx, gy, gr - 14, 42, 76, PAL.green);
    drawGaugeArc(ctx, gx, gy, gr - 14, 76, 100, PAL.terra);

    // Стрелка манометра
    const needleAng = (135 + (p / 100) * 270) * (Math.PI / 180);
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.cos(needleAng) * (gr - 20), gy + Math.sin(needleAng) * (gr - 20));
    ctx.stroke();
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.arc(gx, gy, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`НАПОР ${Math.round(p)}%`, gx, gy + 54);
    ctx.fillStyle = p > 80 ? PAL.terra : p >= 42 ? PAL.green : PAL.muted;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(
      p > 80 ? 'ПЕРЕХЛЁСТ!' : p >= 42 ? 'ЗЕЛЁНАЯ ЗОНА' : 'СЛАБЫЙ НАПОР',
      gx,
      gy + 72
    );

    // Полоса прогресса промывки внизу
    ctx.textAlign = 'left';
    drawProgressBar(ctx, 110, 515, 580, 26, prog, `Промывка каскада сит (4 → 2 → 1 мм): ${Math.round(prog)}%`);
  }

  function drawGaugeArc(ctx, cx, cy, r, pStart, pEnd, color) {
    const a1 = (135 + (pStart / 100) * 270) * (Math.PI / 180);
    const a2 = (135 + (pEnd / 100) * 270) * (Math.PI / 180);
    ctx.strokeStyle = color;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a1, a2);
    ctx.stroke();
  }

  // --- СТОЛ 2: ХИМИЧЕСКИЙ СТОЛ (pH-ПОЛОСКА + МИКРОСКОП, 800×600) ---
  function drawTable2Chem(ctx) {
    const run = world.run;

    // Разделитель двух зон на 800×600 столе
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(395, 36);
    ctx.lineTo(395, 560);
    ctx.stroke();

    // --- ЛЕВАЯ ЗОНА: ТЕСТ pH ---
    ctx.fillStyle = PAL.ink;
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText('1. Экспресс-тест pH (3,0 с)', 36, 56);

    // Стакан с раствором
    const bx = 98;
    const by = 225;
    ctx.fillStyle = '#D5E5E0';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2.5;
    ctx.fillRect(bx, by, 108, 145);
    ctx.strokeRect(bx, by, 108, 145);
    ctx.fillStyle = 'rgba(138, 122, 86, 0.35)';
    ctx.fillRect(bx + 3, by + 48, 102, 94);

    // Пинцет и полоска pH
    const stripY = run.phDipActive ? by + 18 : 115;
    const actualPhColor = (C.PH_SCALE.find((s) => Math.abs(s.ph - run.batch.ph) < 0.2) || C.PH_SCALE[4]).color;
    const stripColor = run.phDyeBleed
      ? '#9A8876'
      : run.stripDipped || (run.phDipActive && run.dipSeconds >= 2.4)
        ? actualPhColor
        : '#E8E0CB';

    drawGlovedHand(ctx, 178, stripY - 22, -0.35);
    ctx.fillStyle = '#F4F1EA';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.fillRect(141, stripY, 22, 96);
    ctx.strokeRect(141, stripY, 22, 96);
    ctx.fillStyle = stripColor;
    ctx.fillRect(142, stripY + 56, 20, 39);

    // Таймер выдержки (3.0 с) справа от стакана, с запасом до разделителя x=395
    ctx.fillStyle = PAL.ink;
    ctx.textAlign = 'center';
    ctx.font = '700 17px ui-monospace, monospace';
    const dipTxt = `${run.dipSeconds.toFixed(1).replace('.', ',')} / 3,0 с`;
    ctx.fillText(dipTxt, 304, 252);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = run.phDipActive && run.dipSeconds >= 2.4 && run.dipSeconds <= 3.6 ? PAL.green : PAL.muted;
    ctx.fillText(run.stripDipped ? 'Готово!' : 'Зажмите стакан', 304, 274);
    ctx.fillText(run.stripDipped ? 'Сверьте со шкалой' : 'на 3,0 секунды', 304, 290);
    ctx.textAlign = 'left';

    // Эталонная шкала 5.5 – 7.5
    ctx.fillStyle = PAL.ink;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('Эталонная шкала pH (5.5 — 7.5):', 32, 434);

    const swW = 46;
    const gap = 5;
    const startX = 28;
    for (let i = 0; i < C.PH_SCALE.length; i++) {
      const s = C.PH_SCALE[i];
      const sx = startX + i * (swW + gap);
      const selected = run.phPicked === s.ph && run.phMatched;

      ctx.fillStyle = s.color;
      ctx.fillRect(sx, 452, swW, 44);
      ctx.strokeStyle = selected ? PAL.green : PAL.ink;
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.strokeRect(sx, 452, swW, 44);

      ctx.fillStyle = PAL.card;
      ctx.fillRect(sx, 496, swW, 20);
      ctx.strokeRect(sx, 496, swW, 20);
      ctx.fillStyle = PAL.ink;
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, sx + swW / 2, 510);
    }
    ctx.textAlign = 'left';

    // --- ПРАВАЯ ЗОНА: МИКРОСКОП И ЛИНЕЙКА ---
    ctx.fillStyle = PAL.ink;
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText('2. Окуляр микроскопа и линейка', 425, 56);

    const eyeCx = 590;
    const eyeCy = 255;
    const eyeR = 155;

    // Корпус окуляра
    ctx.fillStyle = '#2C302E';
    ctx.beginPath();
    ctx.arc(eyeCx, eyeCy, eyeR + 10, 0, Math.PI * 2);
    ctx.fill();

    // Поле зрения окуляра
    ctx.save();
    ctx.beginPath();
    ctx.arc(eyeCx, eyeCy, eyeR, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#F7F0D8';
    ctx.fillRect(eyeCx - eyeR, eyeCy - eyeR, eyeR * 2, eyeR * 2);

    // Сетка 5 мм
    ctx.strokeStyle = 'rgba(44, 48, 46, 0.14)';
    ctx.lineWidth = 1;
    const stepPx = 42.8;
    for (let x = eyeCx - eyeR; x <= eyeCx + eyeR; x += stepPx) {
      ctx.beginPath();
      ctx.moveTo(x, eyeCy - eyeR);
      ctx.lineTo(x, eyeCy + eyeR);
      ctx.stroke();
    }
    for (let y = eyeCy - eyeR; y <= eyeCy + eyeR; y += stepPx) {
      ctx.beginPath();
      ctx.moveTo(eyeCx - eyeR, y);
      ctx.lineTo(eyeCx + eyeR, y);
      ctx.stroke();
    }

    // Резкость волокон в зависимости от фокуса
    const focusDiff = Math.abs(run.focusVal - run.batch.optimalFocus);
    const isSharp = focusDiff <= 12;
    const blurOffset = Math.max(0, (focusDiff - 8) * 0.22);

    for (const f of run.fibers) {
      const fx1 = eyeCx - eyeR + (f.x1 / 100) * (eyeR * 2);
      const fy1 = eyeCy - eyeR + (f.y1 / 100) * (eyeR * 2);
      const fx2 = eyeCx - eyeR + (f.x2 / 100) * (eyeR * 2);
      const fy2 = eyeCy - eyeR + (f.y2 / 100) * (eyeR * 2);

      if (!isSharp) {
        ctx.strokeStyle = 'rgba(110, 79, 38, 0.35)';
        ctx.lineWidth = f.major ? 9 + blurOffset : 6 + blurOffset;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(fx1 + blurOffset, fy1 - blurOffset);
        ctx.lineTo(fx2 + blurOffset, fy2 - blurOffset);
        ctx.stroke();
      } else {
        ctx.strokeStyle = f.major ? '#6A4922' : '#8A6B40';
        ctx.lineWidth = f.major ? 5.5 : 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(fx1, fy1);
        ctx.lineTo(fx2, fy2);
        ctx.stroke();
      }
    }

    // Линейка замера по двум кликам
    if (run.caliperP1) {
      ctx.fillStyle = PAL.terra;
      ctx.beginPath();
      ctx.arc(run.caliperP1.x, run.caliperP1.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (run.caliperP2) {
        ctx.strokeStyle = PAL.terra;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(run.caliperP1.x, run.caliperP1.y);
        ctx.lineTo(run.caliperP2.x, run.caliperP2.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(run.caliperP2.x, run.caliperP2.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Кнопки фокуса [-] [+] и шкала резкости
    ctx.fillStyle = PAL.card;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(495, 444, 46, 34);
    ctx.strokeRect(495, 444, 46, 34);
    ctx.fillRect(639, 444, 46, 34);
    ctx.strokeRect(639, 444, 46, 34);

    ctx.fillStyle = PAL.ink;
    ctx.font = '700 16px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('−', 518, 467);
    ctx.fillText('+', 662, 467);
    ctx.font = '600 12px ui-monospace, monospace';
    ctx.fillText(`ФОКУС ${run.focusVal}%`, 590, 465);

    ctx.font = '600 11.5px system-ui, sans-serif';
    ctx.fillStyle = isSharp ? PAL.green : PAL.terra;
    ctx.fillText(
      isSharp ? '● Резкость есть — кликните 2 конца волокна' : 'Крутите колёсико мыши или +/- для резкости',
      590,
      504
    );

    if (run.microscopeDone) {
      const mmTxt = `Замер: ${String(run.measuredMeanMm).replace('.', ',')} мм ${run.longFibersDetected ? '(▲ > 20 мм — long-fibers!)' : '(● Норма ≤ 20 мм)'}`;
      ctx.fillStyle = run.longFibersDetected ? PAL.terra : PAL.green;
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText(mmTxt, 590, 532);
    }
    ctx.textAlign = 'left';
  }

  // --- СТОЛ 3: ЧЕРПАЛЬНАЯ ВАННА (ПУЗЫРЬКОВЫЙ УРОВЕНЬ, 800×600) ---
  function drawTable3Vat(ctx) {
    const run = world.run;

    // Ванна с тёплой пульпой
    ctx.fillStyle = '#D8C59E';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 3;
    ctx.fillRect(90, 88, 620, 380);
    ctx.strokeRect(90, 88, 620, 380);

    // Плавающие волокна в чане
    ctx.strokeStyle = 'rgba(110, 82, 44, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const fx = 120 + ((i * 83) % 540);
      const fy = 120 + ((i * 57) % 310);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + 18, fy + 6);
      ctx.stroke();
    }

    // Деревянная сетчатая рамка (декель) с наклоном
    ctx.save();
    ctx.translate(400, 278);
    ctx.rotate((run.deckleTiltDeg * Math.PI) / 180);

    // Слой влажных волокон на сетке (если есть залысина — рисуем просвет)
    ctx.fillStyle = run.vatHasBaldSpot ? '#E5D9BD' : '#EFE5CC';
    ctx.fillRect(-190, -110, 380, 220);

    if (run.vatHasBaldSpot) {
      ctx.fillStyle = 'rgba(200, 109, 81, 0.35)';
      ctx.beginPath();
      ctx.ellipse(run.deckleTiltDeg > 0 ? -90 : 90, 0, 62, 74, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Деревянная рама декеля
    ctx.strokeStyle = PAL.woodDark;
    ctx.lineWidth = 14;
    ctx.strokeRect(-190, -110, 380, 220);
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(-197, -117, 394, 234);

    // Руки в перчатках держат рамку слева и справа
    drawGlovedHand(ctx, -214, 0, 0);
    drawGlovedHand(ctx, 214, 0, Math.PI);

    // Строительный пузырьковый уровень на верхней планке рамки
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(-110, -128, 220, 24);
    ctx.strokeRect(-110, -128, 220, 24);

    // Зелёная центральная зона уровня
    ctx.fillStyle = PAL.greenSoft;
    ctx.fillRect(-38, -127, 76, 22);
    ctx.strokeStyle = PAL.ink;
    ctx.beginPath();
    ctx.moveTo(-38, -128);
    ctx.lineTo(-38, -104);
    ctx.moveTo(38, -128);
    ctx.lineTo(38, -104);
    ctx.stroke();

    // Пузырёк уровня
    const bubbleX = Math.max(-92, Math.min(92, run.deckleTiltDeg * 9.5));
    const inCenter = Math.abs(run.deckleTiltDeg) <= 4.2;
    ctx.fillStyle = inCenter ? PAL.green : PAL.terra;
    ctx.beginPath();
    ctx.arc(bubbleX, -116, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    drawProgressBar(
      ctx,
      110,
      515,
      580,
      26,
      run.vatDrainProgress,
      `Стекание воды и переплёт полотна: ${Math.round(run.vatDrainProgress)}%`
    );
  }

  // --- СТОЛ 4: ВИНТОВОЙ ПРЕСС, СУШКА И ГОТОВЫЙ СОРТ С ШТАМПОМ (800×600) ---
  function drawTable4Press(ctx) {
    const run = world.run;

    if (run.pressDone && run.paperCraft) {
      drawFinishedSheetShowcase(ctx, run.paperCraft);
      return;
    }

    // Станина чугунного пресса
    ctx.fillStyle = '#4B504E';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 3;
    ctx.fillRect(120, 120, 320, 340);
    ctx.strokeRect(120, 120, 320, 340);

    // Плита пресса и стопка сукна
    const platenY = 300 + (run.flywheelProgress / 100) * 58;
    ctx.fillStyle = '#EFE6CF';
    ctx.fillRect(156, 388, 248, 36);
    ctx.strokeRect(156, 388, 248, 36);

    ctx.fillStyle = '#7C8280';
    ctx.fillRect(150, platenY, 260, 26);
    ctx.strokeRect(150, platenY, 260, 26);

    // Маховик с 4 спицами
    const hubX = 280;
    const hubY = 235;
    ctx.save();
    ctx.translate(hubX, hubY);
    ctx.rotate(run.flywheelAngle);
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = PAL.brass;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 86, Math.sin(a) * 86);
      ctx.stroke();
    }
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!run.flywheelDone) {
      drawGlovedHand(ctx, hubX + 86, hubY, Math.PI);
    }

    // Правая панель: Термо-стрелка и рычаг пара
    const tx = 610;
    const ty = 210;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Зоны сушки на термометре (0..5.5 с)
    drawGaugeArc(ctx, tx, ty, 76, 0, 50, '#D4CEBF');
    drawGaugeArc(ctx, tx, ty, 76, 52, 76, PAL.green);
    drawGaugeArc(ctx, tx, ty, 76, 76, 100, PAL.terra);

    const steamPct = Math.min(100, ((run.steamSeconds || 0) / 5.5) * 100);
    const sAng = (135 + (steamPct / 100) * 270) * (Math.PI / 180);
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(sAng) * 70, ty + Math.sin(sAng) * 70);
    ctx.stroke();

    ctx.fillStyle = PAL.ink;
    ctx.textAlign = 'center';
    ctx.font = '700 14px ui-monospace, monospace';
    ctx.fillText(`ПАР: ${(run.steamSeconds || 0).toFixed(1).replace('.', ',')} с`, tx, ty + 54);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('Цель: 3,0 — 4,2 с', tx, ty + 72);

    // Рычаг пара справа
    ctx.fillStyle = run.flywheelDone ? PAL.terra : '#B8B4A8';
    ctx.fillRect(555, 345, 110, 52);
    ctx.strokeRect(555, 345, 110, 52);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(run.flywheelDone ? 'РЫЧАГ ПАРА' : 'СНАЧАЛА МАХОВИК', tx, 376);
    ctx.textAlign = 'left';

    drawProgressBar(
      ctx,
      110,
      515,
      580,
      26,
      run.flywheelProgress,
      run.flywheelDone ? 'Прижим маховиком 100% · Зажмите рычаг пара на 3–4 с!' : `Зажим маховика: ${Math.round(run.flywheelProgress)}%`
    );
  }

  function drawFinishedSheetShowcase(ctx, craft) {
    const tier = C.PAPER_TIERS[craft.gradeId] || C.PAPER_TIERS['standard-kraft'];

    // Лист бумаги формата A5 по центру 800×600
    const sx = 230;
    const sy = 56;
    const sw = 340;
    const sh = 460;

    ctx.fillStyle = 'rgba(44, 48, 46, 0.14)';
    ctx.fillRect(sx + 8, sy + 10, sw, sh);

    ctx.fillStyle = tier.bgFill;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeRect(sx, sy, sw, sh);

    // Травинки и волокна в структуре листа
    ctx.strokeStyle = tier.fiberStroke;
    ctx.lineWidth = craft.gradeId === 'royal-grade' ? 1.8 : 1.2;
    for (let i = 0; i < 36; i++) {
      const fx = sx + 22 + ((i * 71) % (sw - 44));
      const fy = sy + 24 + ((i * 97) % (sh - 48));
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + ((i % 2) ? 14 : -12), fy + 7);
      ctx.stroke();
    }

    // Дефекты (подпалины / трещина, если брак)
    if (craft.scorched) {
      ctx.fillStyle = 'rgba(110, 62, 32, 0.34)';
      ctx.beginPath();
      ctx.arc(sx + 210, sy + 180, 56, 0, Math.PI * 2);
      ctx.fill();
    }
    if (craft.torn) {
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx + sw, sy + 140);
      ctx.lineTo(sx + sw - 54, sy + 172);
      ctx.lineTo(sx + sw - 26, sy + 205);
      ctx.stroke();
    }

    // Заголовок сорта на листе
    ctx.fillStyle = PAL.ink;
    ctx.textAlign = 'center';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillStyle = PAL.muted;
    ctx.fillText('ЭКОЛАБОРАТОРИЯ · ELEPHANT RESEARCH STATION', sx + sw / 2, sy + 36);

    ctx.fillStyle = PAL.ink;
    ctx.font = '700 22px Georgia, serif';
    ctx.fillText(tier.title.toUpperCase(), sx + sw / 2, sy + 76);
    ctx.font = '600 13px ui-monospace, monospace';
    ctx.fillText(`${craft.gsm} г/м² · Оценка: ${craft.score}/100`, sx + sw / 2, sy + 104);

    ctx.strokeStyle = 'rgba(44, 48, 46, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + 32, sy + 120);
    ctx.lineTo(sx + sw - 32, sy + 120);
    ctx.stroke();

    ctx.fillStyle = PAL.ink;
    ctx.font = '500 13px system-ui, sans-serif';
    drawCenteredWrappedText(ctx, tier.subtitle, sx + sw / 2, sy + 146, sw - 48, 19);

    // Штамп лапы слона
    const stampX = sx + 105;
    const stampY = sy + 335;
    ctx.save();
    ctx.translate(stampX, stampY);
    ctx.rotate(-0.14);
    ctx.strokeStyle = tier.stampColor;
    ctx.fillStyle = tier.stampColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.stroke();
    // Подушка лапы и 4 пальца
    ctx.beginPath();
    ctx.ellipse(0, 6, 18, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const px of [-16, -6, 6, 16]) {
      ctx.beginPath();
      ctx.arc(px, -16 + Math.abs(px) * 0.25, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Подпись Алисы
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + 185, sy + 355);
    ctx.bezierCurveTo(sx + 205, sy + 322, sx + 225, sy + 372, sx + 255, sy + 338);
    ctx.bezierCurveTo(sx + 272, sy + 320, sx + 286, sy + 356, sx + 306, sy + 344);
    ctx.stroke();
    ctx.font = 'italic 600 12px Georgia, serif';
    ctx.fillStyle = PAL.ink;
    ctx.fillText('Подпись: Алиса Б.', sx + 245, sy + 382);
    ctx.textAlign = 'left';
  }

  function drawAlisaBoardOverlay(ctx) {
    ctx.fillStyle = PAL.green;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 4;
    ctx.fillRect(60, 56, 680, 480);
    ctx.strokeRect(60, 56, 680, 480);

    ctx.fillStyle = '#F4F1EA';
    ctx.font = '700 24px Georgia, serif';
    ctx.fillText('Журнал доски биохимика Алисы', 96, 112);

    ctx.font = '600 15px ui-monospace, monospace';
    ctx.fillText(`Активная проба: ${world.run.batch.title}`, 96, 160);
    ctx.fillText(`Источник: ${world.sampleSource === 'manege' ? 'Свежий завоз из Манежа' : 'Архивный образец со склада'}`, 96, 192);
    ctx.fillText('Критерии брака (ration-violation):', 96, 244);
    ctx.fillText('  • Длина волокон > 20 мм  → флаг long-fibers', 96, 274);
    ctx.fillText('  • Кислотность pH < 6,2    → флаг low-ph', 96, 304);

    ctx.fillStyle = '#D9D3C4';
    ctx.fillText('Выберите любую партию внизу для смены пробы на столе.', 96, 486);
  }

  function drawCenteredWrappedText(ctx, text, cx, startY, maxWidth, lineHeight) {
    const words = String(text || '').split(/\s+/);
    let line = '';
    let y = startY;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, cx, y);
        line = word;
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, y);
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    const rad = Math.min(r || 0, w / 2, h / 2);
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
  }

  function drawGlovedHand(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = PAL.glove;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRectPath(ctx, -22, -14, 44, 28, 10);
    ctx.fill();
    ctx.stroke();
    // Пальцы
    ctx.beginPath();
    roundRectPath(ctx, 12, -12, 16, 10, 4);
    roundRectPath(ctx, 14, -2, 17, 10, 4);
    roundRectPath(ctx, 10, 6, 14, 9, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawProgressBar(ctx, x, y, w, h, pct, label) {
    ctx.fillStyle = '#E8E4DA';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = pct >= 100 ? PAL.green : PAL.terra;
    ctx.fillRect(x + 2, y + 2, ((w - 4) * Math.max(0, Math.min(100, pct))) / 100, h - 4);

    ctx.fillStyle = PAL.ink;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(label, x, y - 8);
  }

  function drawAlisaPortrait(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#E8E4DA';
    ctx.fillRect(0, 0, 64, 64);
    // Халат
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 62, 22, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    // Волосы и лицо
    ctx.fillStyle = '#5A3A28';
    ctx.beginPath();
    ctx.arc(32, 26, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F2D2B6';
    ctx.beginPath();
    ctx.arc(32, 28, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Очки и улыбка
    ctx.strokeStyle = PAL.ink;
    ctx.strokeRect(23, 25, 7, 5);
    ctx.strokeRect(34, 25, 7, 5);
    ctx.beginPath();
    ctx.moveTo(28, 34);
    ctx.quadraticCurveTo(32, 37, 36, 34);
    ctx.stroke();
  }

  // ===========================================================================
  // СОХРАНЕНИЕ В `ers_progress_v1:biolab` И ПЕРЕРИСОВКА HUD
  // ===========================================================================
  function saveToStationStorage() {
    if (!P) return false;
    const nowIso = new Date().toISOString();
    let ok = true;
    const run = world.run;
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

  function setAlisaSpeech(text, mood) {
    world.alisa.speech = text;
    world.alisa.mood = mood || 'welcome';
    alisaSpeechEl.textContent = `«${text}»`;
    alisaCard.dataset.mood = world.alisa.mood;
  }

  function updateWalkPrompt() {
    const nearby = C.findNearbyStation(world.player, 74);
    if (nearby) {
      interactActionBtn.disabled = false;
      interactActionBtn.textContent = `[E] ${nearby.shortTitle}`;
    } else {
      interactActionBtn.disabled = true;
      interactActionBtn.textContent = 'Подойдите к столу или баку (WASD / клик)';
    }
  }

  function refreshHudLabels() {
    sampleTagEl.textContent = world.sampleSource === 'manege'
      ? `● Из Манежа: ${world.run.batch.title}`
      : `○ Склад: ${world.run.batch.title}`;
    shell.dataset.mode = world.mode;
    shell.dataset.station = world.activeStationId || '';
    shell.dataset.sampleSource = world.sampleSource;
  }

  function resetLabSession(batchId) {
    const isPreset = Boolean(C.BATCH_PRESETS[batchId]);
    const simSample =
      batchId === 'archive-sample'
        ? null
        : {
            source: 'manege',
            batchId: isPreset ? batchId : 'margo-norm',
            label: (C.BATCH_PRESETS[batchId] || C.BATCH_PRESETS['margo-norm']).title
          };
    world = C.createWorldState(simSample);
    setAlisaSpeech(world.alisa.speech, 'welcome');
    refreshHudLabels();
    if (world.mode === 'INTERACTING') {
      exitWorkbench();
    }
  }

  // ===========================================================================
  // КОМПАКТНАЯ КНОПКА «СПРАВОЧНИК ЛАБОРАНТА» (МОДАЛЬНЫЙ ЯЩИК СО СТАРЫМИ СТАТЬЯМИ)
  // ===========================================================================
  function initGuideDrawer() {
    const guideContainer = document.getElementById('lab-guide-sections');
    const drawer = document.getElementById('lab-guide-drawer');
    const closeBtn = document.getElementById('close-lab-guide-btn');
    if (!guideContainer || !drawer) return;
    if (closeBtn) {
      closeBtn.addEventListener('click', () => toggleGuideDrawer(false));
    }

    // Ссылки верхней навигации и справочника открывают выдвижную панель и прокручивают к нужному разделу
    const navLinks = document.querySelectorAll('.primary-nav a, .embedded-links a, .cross-link-item[href^="#"]');
    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href') || '';
        if (!href.startsWith('#')) return;
        const targetId = href.slice(1);
        if (targetId === 'coprology' || targetId === 'top') {
          e.preventDefault();
          toggleGuideDrawer(false);
          walkCanvas.focus();
          return;
        }
        const targetEl = document.getElementById(targetId);
        if (targetEl && drawer.contains(targetEl)) {
          e.preventDefault();
          toggleGuideDrawer(true);
          requestAnimationFrame(() => {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      });
    });
  }

  function toggleGuideDrawer(open) {
    const drawer = document.getElementById('lab-guide-drawer');
    if (!drawer) return;
    drawer.hidden = !open;
  }

  // Экспортируем контроллер для интеграции и автотестов
  window.__BIOLAB_SIM__ = {
    getWorld: () => world,
    interactWithStation,
    exitWorkbench,
    resetLabSession,
    saveToStationStorage,
    setAlisaSpeech,
    toggleGuideDrawer
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function btn(className, label, onClick, attrs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v !== undefined && v !== null) b.setAttribute(k, String(v));
      }
    }
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  function canvasPoint(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  refreshHudLabels();
  updateWalkPrompt();
  requestAnimationFrame(tick);
})();
