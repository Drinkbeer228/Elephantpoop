/**
 * Elephant Poop Science & Bio-Lab + Слонология.EDU — Interactive Controller
 * Implements:
 * 1. Embedded Overlay Mode (?embedded=1) & Light/Dark Theme Switcher
 * 2. Block 1 Mathematical Models: (C:N)_mix Mass Balance, ΔN Compensation & Penman-Monteith Evaporation
 * 3. Block 2 & 3 Interactive Simulators: CompostingSimulationState & PaperDelignificationState
 * 4. Block 4 Слонология.EDU Platform: 51 Academic Modules, 5 Mastery Tiers & 8 Achievement Predicates
 */

document.addEventListener('DOMContentLoaded', () => {
  const htmlEl = document.documentElement;
  const bodyEl = document.body;

  // ===========================================================================
  // 1. EMBEDDED OVERLAY MODE (?embedded=1) & THEME SWITCHER
  // ===========================================================================
  const urlParams = new URLSearchParams(window.location.search);
  const embeddedRibbon = document.getElementById('embedded-ribbon');
  const previewEmbeddedBtn = document.getElementById('preview-embedded-btn');

  function applyEmbeddedState(isEmbedded) {
    if (isEmbedded) {
      bodyEl.classList.add('is-embedded');
      if (embeddedRibbon) embeddedRibbon.hidden = false;
      if (previewEmbeddedBtn) previewEmbeddedBtn.textContent = 'Развернуть лабораторный журнал';
    } else {
      bodyEl.classList.remove('is-embedded');
      if (embeddedRibbon) embeddedRibbon.hidden = true;
      if (previewEmbeddedBtn) previewEmbeddedBtn.textContent = 'Режим планшета станции';
    }
  }

  let isEmbeddedMode = urlParams.get('embedded') === '1';
  applyEmbeddedState(isEmbeddedMode);
  // Внутри Research Station: протокол станции и кнопка «На станцию» (station-link.js).
  if (window.ErsStation) window.ErsStation.connect(document);

  if (previewEmbeddedBtn) {
    previewEmbeddedBtn.addEventListener('click', () => {
      isEmbeddedMode = !isEmbeddedMode;
      const newUrl = new URL(window.location.href);
      if (isEmbeddedMode) newUrl.searchParams.set('embedded', '1');
      else newUrl.searchParams.delete('embedded');
      window.history.replaceState({}, '', newUrl);
      applyEmbeddedState(isEmbeddedMode);
    });
  }

  const themeToggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('biolab-theme') || urlParams.get('theme') || 'light';

  function applyTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
    }
  }

  applyTheme(savedTheme === 'dark' ? 'dark' : 'light');

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = htmlEl.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('biolab-theme', next);
      applyTheme(next);
    });
  }

  // ===========================================================================
  // 2. СЛОНОЛОГИЯ.EDU STATE: TIERS, ACHIEVEMENTS & 51 MODULES
  // ===========================================================================
  const ACADEMIC_TIERS = [
    {
      tierLevel: 1,
      code: 'TIER_LABORANT',
      title: 'Младший лаборант подиатрических наблюдений',
      xpThreshold: 0,
      perks: ['Доступ к базовым лекциям Трека 1 и расчётным моделям']
    },
    {
      tierLevel: 2,
      code: 'TIER_ASSISTANT',
      title: 'Ассистент кафедры ветеринарной неонатологии',
      xpThreshold: 1200,
      perks: ['Доступ к симулятору термофильного бурта']
    },
    {
      tierLevel: 3,
      code: 'TIER_DOCENT',
      title: 'Доцент молекулярной палеобиохимии',
      xpThreshold: 4500,
      perks: ['Доступ к калькулятору щелочной делигнификации']
    },
    {
      tierLevel: 4,
      code: 'TIER_PROFESSOR',
      title: 'Профессор метапопуляционной инженерии',
      xpThreshold: 9000,
      perks: ['Доступ к расширенным кейс-стади CITES и HEC']
    },
    {
      tierLevel: 5,
      code: 'TIER_ACADEMICIAN',
      title: 'Академик Высшего Совета Элефантологии',
      xpThreshold: 16000,
      perks: ['Статус эксперта-верификатора научной базы знаний']
    }
  ];

  // Load 51 Academic Modules across 4 Tracks from modules-data.js
  const ALL_51_MODULES = Array.isArray(window.SLONOLOGIA_51_MODULES)
    ? [...window.SLONOLOGIA_51_MODULES].sort((a, b) => a.moduleIndex - b.moduleIndex)
    : [];

  // UserProgress State (persisted in localStorage)
  const defaultProgress = {
    userId: 'researcher-01',
    academicRankCode: 'TIER_ASSISTANT',
    totalXp: 1450,
    streakDays: 5,
    modules: {
      'mod-1-hindgut-biomechanics': {
        moduleId: 'mod-1-hindgut-biomechanics',
        isUnlocked: true,
        isCompleted: true,
        score: 100,
        timeSpentSeconds: 420
      },
      'mod-2-soil-water-holding-capacity': {
        moduleId: 'mod-2-soil-water-holding-capacity',
        isUnlocked: true,
        isCompleted: true,
        score: 95,
        timeSpentSeconds: 380
      }
    },
    badges: [],
    simulatorHighScores: {
      compostingCompletions: 1,
      paperCraftYieldGrams: 8800
    }
  };

  let userProgress = defaultProgress;
  try {
    const saved = localStorage.getItem('slonologia-edu-progress-v1');
    if (saved) userProgress = JSON.parse(saved);
  } catch (e) {
    userProgress = defaultProgress;
  }

  // Simulator States
  let compostSimState = {
    day: 1,
    currentTemperatureC: 32.0,
    moisturePercentage: 58.0,
    pileVolumeCubicMeters: 4.5,
    cnRatio: 34.0,
    aerationTurnCount: 0,
    lastTurnDay: 1,
    thermophilicDaysAccumulated: 0,
    isAnaerobicRotting: false,
    pathogenDevitalizationPercent: {
      fasciolaJacksoniEggs: 0,
      weedSeedsScarified: 0,
      clostridiumSporeTiterLogReduction: 0.2
    },
    odorVfaIndex: 28.0,
    vermicompostingReady: false
  };

  let paperSimState = {
    rawFiberInputGrams: 12000,
    liquorRatio: 9,
    naohConcentrationPercent: 2.0,
    cookingTemperatureC: 100,
    cookingTimeMinutes: 300,
    bananaPseudoStemRatio: 0.40,
    ligninRemovalPercent: 78.5,
    celluloseYieldGrams: 8800,
    fiberDamageAlphaLossPercent: 4.8,
    residualOdorIndex: 0.20,
    sheetTensileStrengthMPa: 31.4
  };

  // 8 Academic Achievements with Exact TypeScript Predicates
  const ACADEMIC_ACHIEVEMENTS = [
    {
      id: 'ach-biochem-systematic',
      name: 'Биохимик-систематик',
      category: 'BIOCHEM',
      description: 'Безупречно пройден модуль по микробиому задней кишки (Hindgut Fermentation) и балансу ЛЖК (≥95%).',
      xpReward: 350,
      isUnlocked: (progress) => {
        const m = progress.modules['mod-1-hindgut-biomechanics'];
        return !!m && m.isCompleted && m.score >= 95;
      }
    },
    {
      id: 'ach-compost-master',
      name: 'Мастер термофильного бурта',
      category: 'COMPOST',
      description: 'Успешно проведена санация бурта в симуляторе: ≥14 суток при 55–65°C, гибель F. jacksoni 100%, C:N 14–18.',
      xpReward: 500,
      isUnlocked: (_, simCtx) => {
        const c = simCtx?.compost;
        return (
          !!c &&
          c.pathogenDevitalizationPercent.fasciolaJacksoniEggs === 100 &&
          !c.isAnaerobicRotting &&
          c.odorVfaIndex <= 2 &&
          c.cnRatio >= 14 &&
          c.cnRatio <= 18
        );
      }
    },
    {
      id: 'ach-circular-engineer',
      name: 'Инженер замкнутого цикла',
      category: 'CIRCULAR',
      description: 'Пройден модуль митигации HEC (№46) и выполнено ≥3 успешных циклов в симуляторах.',
      xpReward: 450,
      isUnlocked: (progress) => {
        const hec = progress.modules['mod-9-46-human-elephant-conflict-mitigation'];
        return !!hec && hec.isCompleted && progress.simulatorHighScores.compostingCompletions >= 3;
      }
    },
    {
      id: 'ach-paper-craftsman',
      name: 'Эксперт по эко-бумаге',
      category: 'PAPER',
      description: 'В симуляторе делигнификации получено полотно прочностью ≥ 28 МПа с нулевым запахом (VFA ≤ 0.5) и потерей α ≤ 8%.',
      xpReward: 500,
      isUnlocked: (_, simCtx) => {
        const p = simCtx?.paper;
        return (
          !!p &&
          p.residualOdorIndex <= 0.5 &&
          p.sheetTensileStrengthMPa >= 28 &&
          p.ligninRemovalPercent >= 70 &&
          p.fiberDamageAlphaLossPercent <= 8
        );
      }
    },
    {
      id: 'ach-cn-guardian',
      name: 'Балансировщик азота',
      category: 'BIOCHEM',
      description: 'Безошибочный расчет дозировки мочевины (9.78 г/кг) и прохождение модуля ризосферы (№14) на 100%.',
      xpReward: 400,
      isUnlocked: (progress) => {
        const soilModule = progress.modules['mod-2-soil-microbiome-rhizosphere'];
        return !!soilModule && soilModule.isCompleted && soilModule.score === 100;
      }
    },
    {
      id: 'ach-hydro-master',
      name: 'Гидрологический мелиорант',
      category: 'COMPOST',
      description: 'Точный расчет снижения эвапотранспирации почвы на 65%+ с помощью пористой слоновьей мульчи (модуль №15).',
      xpReward: 300,
      isUnlocked: (progress) => {
        return !!progress.modules['mod-2-soil-water-holding-capacity']?.isCompleted;
      }
    },
    {
      id: 'ach-cites-auditor',
      name: 'Санитарный инспектор CITES',
      category: 'FIELD',
      description: 'Безупречное определение и карантинный контроль спор Bacillus anthracis в модуле №47 (≥90%).',
      xpReward: 600,
      isUnlocked: (progress) => {
        const cites = progress.modules['mod-9-47-cites-mike-and-anti-poaching-monitoring'];
        return !!cites && cites.isCompleted && cites.score >= 90;
      }
    },
    {
      id: 'ach-zero-waste-sovereign',
      name: 'Академик нулевого следа',
      category: 'CIRCULAR',
      description: 'Полное завершение всех 51 модулей курса Слонология.EDU со средним рейтингом точности выше 92%.',
      xpReward: 1500,
      isUnlocked: (progress) => {
        const totalModules = Object.values(progress.modules);
        if (totalModules.length < 51) return false;
        const allCompleted = totalModules.every((m) => m.isCompleted);
        const avgScore = totalModules.reduce((acc, m) => acc + m.score, 0) / totalModules.length;
        return allCompleted && avgScore >= 92;
      }
    }
  ];

  function saveAndRefreshEduUI() {
    // Check achievement unlocks
    const simCtx = { compost: compostSimState, paper: paperSimState };
    ACADEMIC_ACHIEVEMENTS.forEach((ach) => {
      const alreadyHas = userProgress.badges.some((b) => b.badgeId === ach.id);
      if (!alreadyHas && ach.isUnlocked(userProgress, simCtx)) {
        userProgress.badges.push({
          badgeId: ach.id,
          unlockedAt: new Date().toISOString()
        });
        userProgress.totalXp += ach.xpReward;
      }
    });

    // Determine Academic Tier
    let currentTier = ACADEMIC_TIERS[0];
    let nextTier = ACADEMIC_TIERS[1];
    for (let i = 0; i < ACADEMIC_TIERS.length; i++) {
      if (userProgress.totalXp >= ACADEMIC_TIERS[i].xpThreshold) {
        currentTier = ACADEMIC_TIERS[i];
        nextTier = ACADEMIC_TIERS[i + 1] || null;
      }
    }
    userProgress.academicRankCode = currentTier.code;

    try {
      localStorage.setItem('slonologia-edu-progress-v1', JSON.stringify(userProgress));
    } catch (e) {
      // ignore storage quota errors
    }
    // Сводка для формуляра станции (station-link.js).
    if (window.ErsStation) window.ErsStation.writeSummary(userProgress);

    // Update Dashboard DOM
    const rankCodeEl = document.getElementById('edu-rank-code');
    const rankTitleEl = document.getElementById('edu-rank-title');
    const rankPerkEl = document.getElementById('edu-rank-perk');
    const totalXpEl = document.getElementById('edu-total-xp');
    const nextTierEl = document.getElementById('edu-next-tier');
    const xpBarEl = document.getElementById('edu-xp-bar');
    const modCountEl = document.getElementById('edu-modules-count');
    const badgeCountEl = document.getElementById('edu-badges-count');
    const avgScoreEl = document.getElementById('edu-avg-score');

    if (rankCodeEl) rankCodeEl.textContent = `TIER ${currentTier.tierLevel} · ${currentTier.code}`;
    if (rankTitleEl) rankTitleEl.textContent = currentTier.title;
    if (rankPerkEl) rankPerkEl.textContent = `Привилегия ранга: ${currentTier.perks[0]}`;
    if (totalXpEl) totalXpEl.textContent = `${userProgress.totalXp.toLocaleString('ru-RU')} XP`;

    if (nextTier && nextTierEl && xpBarEl) {
      nextTierEl.textContent = `Следующий ранг (${nextTier.title}): ${nextTier.xpThreshold.toLocaleString('ru-RU')} XP`;
      const pct = Math.min(100, Math.round((userProgress.totalXp / nextTier.xpThreshold) * 100));
      xpBarEl.style.width = `${pct}%`;
    } else if (nextTierEl && xpBarEl) {
      nextTierEl.textContent = 'Достигнут высший академический ранг';
      xpBarEl.style.width = '100%';
    }

    const completedMods = Object.values(userProgress.modules).filter((m) => m.isCompleted);
    const avgScore = completedMods.length
      ? (completedMods.reduce((s, m) => s + m.score, 0) / completedMods.length).toFixed(1)
      : '100.0';

    if (modCountEl) modCountEl.textContent = `Завершено модулей: ${completedMods.length} / 51`;
    if (badgeCountEl) badgeCountEl.textContent = `Открыто ачивок: ${userProgress.badges.length} / 8`;
    if (avgScoreEl) avgScoreEl.textContent = `Средний балл аттестации: ${avgScore}%`;

    // Render Achievements Grid
    const achGrid = document.getElementById('achievements-grid');
    if (achGrid) {
      achGrid.innerHTML = ACADEMIC_ACHIEVEMENTS.map((ach) => {
        const unlocked = userProgress.badges.some((b) => b.badgeId === ach.id);
        return `
          <article class="ach-card ${unlocked ? 'unlocked' : ''}">
            <div class="ach-top">
              <span class="ach-cat">${ach.category}</span>
              <span class="ach-xp">+${ach.xpReward} XP</span>
            </div>
            <div class="ach-title">${ach.name}</div>
            <p class="ach-desc">${ach.description}</p>
            <div class="ach-status">${unlocked ? '● Разблокировано' : '○ Требуется выполнение условий'}</div>
          </article>
        `;
      }).join('');
    }
  }

  // ===========================================================================
  // 3. BLOCK 1 MATHEMATICAL CALCULATOR: (C:N)_mix, ΔN & PENMAN-MONTEITH
  // ===========================================================================
  const calcStateEl = document.getElementById('calc-state');
  const calcSoilMassEl = document.getElementById('calc-soil-mass');
  const calcSubMassEl = document.getElementById('calc-sub-mass');
  const calcTargetCnEl = document.getElementById('calc-target-cn');
  const calcMulchHEl = document.getElementById('calc-mulch-h');

  function updateMassBalanceCalculator() {
    if (!calcStateEl || !calcSoilMassEl || !calcSubMassEl || !calcTargetCnEl || !calcMulchHEl || !window.LabMath) return;

    const mSoil = parseFloat(calcSoilMassEl.value) || 0;
    const mSub = parseFloat(calcSubMassEl.value) || 1;
    const targetCn = parseFloat(calcTargetCnEl.value) || 20;
    const hMulch = parseFloat(calcMulchHEl.value) || 0;

    document.getElementById('calc-soil-display').textContent = `${mSoil} кг`;
    document.getElementById('calc-sub-display').textContent = `${mSub} кг`;
    document.getElementById('calc-target-cn-display').textContent = `${targetCn}:1`;
    document.getElementById('calc-mulch-display').textContent = `${hMulch.toFixed(1)} см`;

    const {
      mSubDry,
      totalC,
      totalN,
      cnMix,
      deltaNGrams,
      ureaGrams,
      nitrateGrams,
      fcMix,
      bulkDensity,
      E,
      evapReductionPct
    } = window.LabMath.calculateMassBalance({
      profileKey: calcStateEl.value,
      mSoil,
      mSub,
      targetCn,
      hMulch
    });

    // Render outputs
    document.getElementById('out-cn').textContent = `${cnMix.toFixed(1)}:1`;
    document.getElementById('out-delta-n').textContent = `${deltaNGrams.toFixed(2)} г N`;
    document.getElementById('out-fert-urea').textContent =
      `Карбамид (46%): ${ureaGrams.toFixed(2)} г | Селитра (34%): ${nitrateGrams.toFixed(2)} г`;
    document.getElementById('out-evap').textContent = `${E.toFixed(2)} мм/сут`;
    document.getElementById('out-whc').textContent =
      `Снижение испарения: −${evapReductionPct.toFixed(1)}% | FC_mix: ${fcMix.toFixed(1)}%`;

    document.getElementById('out-formula-trace').textContent =
      `M_sub,dry = ${mSubDry.toFixed(2)} кг · C_total = ${totalC.toFixed(3)} кг · N_total = ${totalN.toFixed(4)} кг · ρ_b: 1.45 → ${bulkDensity} г/см³`;

    const statusEl = document.getElementById('out-cn-status');
    const recEl = document.getElementById('out-recommendation');

    if (cnMix > 25) {
      statusEl.textContent = '▲ Порог азотной иммобилизации (>25:1)';
      statusEl.className = 'calc-stat-sub status-warn';
      recEl.innerHTML = `<strong>Требуется компенсация азота (ΔN = ${deltaNGrams.toFixed(2)} г):</strong> При текущем соотношении <code>(C:N)_mix = ${cnMix.toFixed(1)}:1</code> почвенная микробиота заблокирует нитратный и аммонийный азот для расщепления клетчатки. Внесите <strong>${ureaGrams.toFixed(2)} г карбамида</strong> (${(ureaGrams / mSub).toFixed(2)} г на 1 кг сырого субстрата) либо <strong>${nitrateGrams.toFixed(2)} г аммиачной селитры</strong>.`;
    } else {
      statusEl.textContent = '● Оптимум минерализации (≤25:1)';
      statusEl.className = 'calc-stat-sub status-ok';
      recEl.innerHTML = `<strong>Смесь сбалансирована:</strong> Индекс <code>(C:N)_mix = ${cnMix.toFixed(1)}:1</code> исключает азотное голодание растений. Полевая влагоёмкость выросла до <strong>${fcMix.toFixed(1)}%</strong>, а мульчирующий слой (${hMulch.toFixed(1)} см) снижает суточные потери влаги на <strong>${evapReductionPct.toFixed(1)}%</strong>.`;
    }
  }

  [calcStateEl, calcSoilMassEl, calcSubMassEl, calcTargetCnEl, calcMulchHEl].forEach((el) => {
    if (el) el.addEventListener('input', updateMassBalanceCalculator);
  });
  updateMassBalanceCalculator();

  // ===========================================================================
  // 4. INTERACTIVE SIMULATOR A: THERMOPHILIC COMPOSTING BIOREACTOR
  // ===========================================================================
  function renderCompostSimulator(logMessage) {
    const simDayEl = document.getElementById('sim-c-day');
    if (!simDayEl) return;
    simDayEl.textContent = `День ${compostSimState.day} / 45`;
    let phaseName = 'Мезофильная индукция (1–3 сут)';
    if (compostSimState.day >= 4 && compostSimState.day <= 18) phaseName = 'Термофильная санация (CCP)';
    else if (compostSimState.day >= 19 && compostSimState.day <= 35) phaseName = 'Деградация целлюлозы';
    else if (compostSimState.day >= 36) phaseName = 'Мезофильное созревание и вермикультура';

    document.getElementById('sim-c-phase').textContent = `Фаза: ${phaseName}`;
    document.getElementById('sim-c-temp').textContent = `+${compostSimState.currentTemperatureC.toFixed(1)} °C`;
    document.getElementById('sim-c-thermo-days').textContent =
      `Термофильных дней (≥55°C): ${compostSimState.thermophilicDaysAccumulated} / 14`;
    document.getElementById('sim-c-moisture').textContent = `${compostSimState.moisturePercentage.toFixed(1)}%`;

    const daysWithoutTurn = compostSimState.day - compostSimState.lastTurnDay;
    document.getElementById('sim-c-turns').textContent =
      `Ворошений: ${compostSimState.aerationTurnCount} (дней без ворошения: ${daysWithoutTurn})`;
    document.getElementById('sim-c-cn').textContent = `${compostSimState.cnRatio.toFixed(1)}:1`;
    document.getElementById('sim-c-odor').textContent =
      `Индекс запаха ЛЖК (VFA): ${compostSimState.odorVfaIndex.toFixed(1)}`;
    document.getElementById('sim-c-fasciola').textContent =
      `${compostSimState.pathogenDevitalizationPercent.fasciolaJacksoniEggs}%`;
    document.getElementById('sim-c-seeds').textContent =
      `Гибель семян сорняков: ${compostSimState.pathogenDevitalizationPercent.weedSeedsScarified}%`;

    const stateEl = document.getElementById('sim-c-state');
    const vermiEl = document.getElementById('sim-c-vermi');

    if (compostSimState.isAnaerobicRotting) {
      stateEl.textContent = '✖ Анаэробное закисание (H₂S, pH < 5.5)';
      stateEl.className = 'sim-val mono-num status-warn';
    } else if (compostSimState.currentTemperatureC >= 55 && compostSimState.currentTemperatureC <= 65) {
      stateEl.textContent = '● Термофильная санация (CCP активна)';
      stateEl.className = 'sim-val mono-num status-ok';
    } else {
      stateEl.textContent = '● Аэробный режим';
      stateEl.className = 'sim-val mono-num status-ok';
    }

    vermiEl.textContent = compostSimState.vermicompostingReady
      ? 'Вермикультура: Готово к заселению E. fetida'
      : 'Вермикультура: В процессе стабилизации';

    if (logMessage) {
      document.getElementById('sim-c-log').innerHTML = logMessage;
    }

    saveAndRefreshEduUI();

    const badgeUnlocked = userProgress.badges.some((b) => b.badgeId === 'ach-compost-master');
    const statusBadgeEl = document.getElementById('compost-sim-badge-status');
    if (statusBadgeEl) {
      statusBadgeEl.textContent = badgeUnlocked
        ? '● Ачивка «Мастер термофильного бурта» (+500 XP) РАЗБЛОКИРОВАНА!'
        : 'Ачивка «Мастер термофильного бурта»: Требуется 100% санация F. jacksoni и C:N 14–18';
    }
  }

  function dispatchCompostAction(action) {
    let msg = '';
    if (action === 'ADD_NITROGEN_UREA') {
      compostSimState.cnRatio = Math.max(15.0, compostSimState.cnRatio - 4.5);
      compostSimState.currentTemperatureC = Math.min(64.0, compostSimState.currentTemperatureC + 14.0);
      msg = `<strong>Внесён карбамид:</strong> Индекс C:N снижен до <code>${compostSimState.cnRatio.toFixed(1)}:1</code>. Термофильная микробиота активирована, температура поднялась до <strong>+${compostSimState.currentTemperatureC.toFixed(1)} °C</strong>.`;
    } else if (action === 'TURN_PILE') {
      compostSimState.aerationTurnCount += 1;
      compostSimState.lastTurnDay = compostSimState.day;
      compostSimState.isAnaerobicRotting = false;
      compostSimState.odorVfaIndex = Math.max(0.5, compostSimState.odorVfaIndex - 6.5);
      if (compostSimState.cnRatio <= 29 && compostSimState.moisturePercentage >= 48 && compostSimState.moisturePercentage <= 65) {
        compostSimState.currentTemperatureC = Math.min(63.0, Math.max(58.0, compostSimState.currentTemperatureC + 4.0));
      }
      msg = `<strong>Выполнено ворошение бурта:</strong> Кислород O₂ восстановлен, анаэробные зоны устранены, индекс летучих жирных кислот снижен до <code>${compostSimState.odorVfaIndex.toFixed(1)}</code>.`;
    } else if (action === 'ADD_WATER') {
      compostSimState.moisturePercentage = Math.min(80.0, compostSimState.moisturePercentage + 8.0);
      if (compostSimState.moisturePercentage > 70.0) {
        compostSimState.isAnaerobicRotting = true;
        compostSimState.odorVfaIndex += 15.0;
        msg = `<strong>Предупреждение (Триггер ошибки 1 — Переувлажнение >70%):</strong> Поры затоплены водой, уровень O₂ упал ниже 5%, началось выделение H₂S! Срочно внесите сухую солому и проведите ворошение.`;
      } else {
        msg = `<strong>Полив выполнен:</strong> Влажность бурта доведена до <code>${compostSimState.moisturePercentage.toFixed(1)}%</code>.`;
      }
    } else if (action === 'ADD_BULKING_STRAW') {
      compostSimState.moisturePercentage = Math.max(40.0, compostSimState.moisturePercentage - 9.0);
      compostSimState.cnRatio += 1.5;
      if (compostSimState.moisturePercentage <= 65.0) {
        compostSimState.isAnaerobicRotting = false;
      }
      msg = `<strong>Внесена сухая солома:</strong> Избыточная влага адсорбирована (влажность <code>${compostSimState.moisturePercentage.toFixed(1)}%</code>), пористость восстановлена.`;
    } else if (action === 'REST_DAY') {
      compostSimState.day = Math.min(45, compostSimState.day + 3);
      const daysSinceTurn = compostSimState.day - compostSimState.lastTurnDay;

      if (compostSimState.moisturePercentage > 70 || (daysSinceTurn > 6 && compostSimState.day < 22)) {
        compostSimState.isAnaerobicRotting = true;
        compostSimState.odorVfaIndex = Math.min(100, compostSimState.odorVfaIndex + 12);
        compostSimState.currentTemperatureC = Math.max(35, compostSimState.currentTemperatureC - 8);
        msg = `<strong>Триггер ошибки (День ${compostSimState.day}):</strong> Из-за отсутствия ворошения (${daysSinceTurn} сут.) или переувлажнения начался анаэробиоз! Проведите ворошение бурта.`;
      } else if (compostSimState.cnRatio > 31 && compostSimState.day <= 18) {
        compostSimState.currentTemperatureC = 41.0;
        msg = `<strong>Триггер ошибки 2 (Остановка ферментации):</strong> Температура не достигает +55 °C из-за дефицита азота (C:N ${compostSimState.cnRatio.toFixed(1)}:1). Внесите карбамид!`;
      } else {
        // Normal aerobic progression
        if (compostSimState.day <= 21) {
          compostSimState.currentTemperatureC = 60.5;
          compostSimState.thermophilicDaysAccumulated += 3;
          compostSimState.pathogenDevitalizationPercent.fasciolaJacksoniEggs = Math.min(
            100,
            Math.round((compostSimState.thermophilicDaysAccumulated / 14) * 100)
          );
          compostSimState.pathogenDevitalizationPercent.weedSeedsScarified = Math.min(
            100,
            Math.round((compostSimState.thermophilicDaysAccumulated / 9) * 100)
          );
        } else {
          compostSimState.currentTemperatureC = Math.max(24.0, compostSimState.currentTemperatureC - 7.5);
        }
        compostSimState.moisturePercentage = Math.max(48.0, compostSimState.moisturePercentage - 2.0);
        compostSimState.cnRatio = Math.max(15.5, compostSimState.cnRatio - 1.6);
        compostSimState.odorVfaIndex = Math.max(1.0, compostSimState.odorVfaIndex - 4.0);

        if (
          compostSimState.pathogenDevitalizationPercent.fasciolaJacksoniEggs === 100 &&
          compostSimState.cnRatio <= 18 &&
          compostSimState.odorVfaIndex <= 2
        ) {
          compostSimState.vermicompostingReady = true;
          userProgress.simulatorHighScores.compostingCompletions += 1;
          msg = `<strong>Полный успех санации (День ${compostSimState.day}):</strong> Накоплено ${compostSimState.thermophilicDaysAccumulated} термофильных суток при +60 °C! Яйца <em>Fasciola jacksoni</em> и семена сорняков уничтожены на 100%, индекс C:N стабилизирован на <code>${compostSimState.cnRatio.toFixed(1)}:1</code>, запах устранён (VFA ${compostSimState.odorVfaIndex.toFixed(1)}). Субстрат готов к вермикультуре!`;
        } else {
          msg = `<strong>День ${compostSimState.day}:</strong> Аэробная ферментация продолжается. Термофильная выдержка: ${compostSimState.thermophilicDaysAccumulated} сут., гибель <em>F. jacksoni</em>: ${compostSimState.pathogenDevitalizationPercent.fasciolaJacksoniEggs}%. Не забывайте проводить ворошение каждые 3–4 дня.`;
        }
      }
    }
    renderCompostSimulator(msg);
  }

  document.querySelectorAll('.sim-c-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      dispatchCompostAction(btn.getAttribute('data-action'));
    });
  });

  const simCAutoBtn = document.getElementById('sim-c-auto');
  if (simCAutoBtn) {
    simCAutoBtn.addEventListener('click', () => {
      compostSimState = {
        day: 42,
        currentTemperatureC: 25.0,
        moisturePercentage: 56.0,
        pileVolumeCubicMeters: 4.2,
        cnRatio: 16.2,
        aerationTurnCount: 8,
        lastTurnDay: 40,
        thermophilicDaysAccumulated: 16,
        isAnaerobicRotting: false,
        pathogenDevitalizationPercent: {
          fasciolaJacksoniEggs: 100,
          weedSeedsScarified: 100,
          clostridiumSporeTiterLogReduction: 4.5
        },
        odorVfaIndex: 1.2,
        vermicompostingReady: true
      };
      userProgress.simulatorHighScores.compostingCompletions += 1;
      renderCompostSimulator(
        `<strong>Эталонный протокол выполнен (42 суток):</strong> Выдержано 16 суток при +60 °C с 8 циклами аэрации. Девитализация яиц <em>Fasciola jacksoni</em> и семян сорняков — <strong>100%</strong>, итоговый <code>C:N = 16.2:1</code>, индекс запаха VFA = 1.2. Разблокирована ачивка <strong>«Мастер термофильного бурта» (+500 XP)</strong>!`
      );
    });
  }

  const simCResetBtn = document.getElementById('sim-c-reset');
  if (simCResetBtn) {
    simCResetBtn.addEventListener('click', () => {
      compostSimState = {
        day: 1,
        currentTemperatureC: 32.0,
        moisturePercentage: 58.0,
        pileVolumeCubicMeters: 4.5,
        cnRatio: 34.0,
        aerationTurnCount: 0,
        lastTurnDay: 1,
        thermophilicDaysAccumulated: 0,
        isAnaerobicRotting: false,
        pathogenDevitalizationPercent: {
          fasciolaJacksoniEggs: 0,
          weedSeedsScarified: 0,
          clostridiumSporeTiterLogReduction: 0.2
        },
        odorVfaIndex: 28.0,
        vermicompostingReady: false
      };
      renderCompostSimulator('<strong>Симулятор сброшен к Дню 1:</strong> Внесите карбамид и управляйте ворошением бурта.');
    });
  }

  renderCompostSimulator();

  // ===========================================================================
  // 5. INTERACTIVE SIMULATOR B: ALKALINE DELIGNIFICATION (ELEPHANT DUNG PAPER)
  // ===========================================================================
  const simPNaoh = document.getElementById('sim-p-naoh');
  const simPTemp = document.getElementById('sim-p-temp');
  const simPTime = document.getElementById('sim-p-time');
  const simPMusa = document.getElementById('sim-p-musa');

  function updatePaperSimulator() {
    if (!simPNaoh || !simPTemp || !simPTime || !simPMusa || !window.LabMath) return;

    const naoh = parseFloat(simPNaoh.value);
    const temp = parseFloat(simPTemp.value);
    const timeMin = parseFloat(simPTime.value);
    const musaRatio = parseFloat(simPMusa.value);

    document.getElementById('sim-p-naoh-val').textContent = `${naoh.toFixed(2)}%`;
    document.getElementById('sim-p-temp-val').textContent = `${temp} °C`;
    document.getElementById('sim-p-time-val').textContent = `${timeMin} мин (${(timeMin / 60).toFixed(1)} ч)`;
    document.getElementById('sim-p-musa-val').textContent = `${musaRatio.toFixed(2)} (${Math.round(musaRatio * 100)}%)`;

    const calcPaper = window.LabMath.calculatePaperDelignification({
      naoh,
      temp,
      timeMin,
      musaRatio
    });
    const ligninRemoval = calcPaper.ligninRemovalPercent;
    const fiberDamage = calcPaper.fiberDamageAlphaLossPercent;
    const odorIndex = calcPaper.residualOdorIndex;
    const tensileMPa = calcPaper.sheetTensileStrengthMPa;
    const yieldKg = calcPaper.yieldKg;
    const sheetsA4 = calcPaper.sheetsA4;

    paperSimState = calcPaper;

    document.getElementById('out-p-lignin').textContent = `${ligninRemoval}%`;
    document.getElementById('out-p-damage').textContent =
      `Потеря α-целлюлозы: ${fiberDamage}% (норма ≤ 8%)`;
    document.getElementById('out-p-odor').textContent = odorIndex.toFixed(2);
    document.getElementById('out-p-strength').textContent = `${tensileMPa} МПа`;
    document.getElementById('out-p-yield').textContent =
      `Выход из 12 кг с.в.: ${yieldKg} кг (${sheetsA4} листов A4)`;

    const odorStatusEl = document.getElementById('out-p-odor-status');
    const recEl = document.getElementById('out-p-recommendation');

    if (odorIndex <= 0.5 && tensileMPa >= 28 && ligninRemoval >= 70 && fiberDamage <= 8) {
      odorStatusEl.textContent = '● Полная дезодорация и стерильность (≤ 0.5)';
      odorStatusEl.className = 'calc-stat-sub status-ok';
      recEl.innerHTML =
        `<strong>Эталонное качество полотна достигнуто:</strong> Удалено ${ligninRemoval}% лигнина при сохранении нативной α-целлюлозы (потери всего ${fiberDamage}%). Прочность на разрыв <strong>${tensileMPa} МПа</strong> (≥ 28 МПа), запах ЛЖК полностью гидролизован. Разблокирована ачивка <strong>«Эксперт по эко-бумаге» (+500 XP)</strong>!`;
    } else if (fiberDamage > 8) {
      odorStatusEl.textContent = '▲ Щелочная/термическая деструкция волокна';
      odorStatusEl.className = 'calc-stat-sub status-warn';
      recEl.innerHTML =
        `<strong>Превышен порог жесткости варки:</strong> Потеря α-целлюлозы составила <strong>${fiberDamage}%</strong> (> 8%). Снизьте концентрацию NaOH до 1.5–2.25% и температуру до 98–102 °C.`;
    } else {
      odorStatusEl.textContent = odorIndex <= 0.5 ? '● Запах устранён' : '▲ Остаточный запах ЛЖК (> 0.5)';
      odorStatusEl.className = odorIndex <= 0.5 ? 'calc-stat-sub status-ok' : 'calc-stat-sub status-warn';
      recEl.innerHTML =
        `<strong>Требуется калибровка режима:</strong> Для достижения прочности ≥ 28 МПа и индекса запаха ≤ 0.5 установите температуру 98–102 °C, время 240–360 мин и долю бананового волокна Musa 0.35–0.45.`;
    }

    saveAndRefreshEduUI();

    const badgeUnlocked = userProgress.badges.some((b) => b.badgeId === 'ach-paper-craftsman');
    const badgeStatusEl = document.getElementById('paper-sim-badge-status');
    if (badgeStatusEl) {
      badgeStatusEl.textContent = badgeUnlocked
        ? '● Ачивка «Эксперт по эко-бумаге» (+500 XP) РАЗБЛОКИРОВАНА!'
        : 'Ачивка «Эксперт по эко-бумаге»: Требуется прочность ≥ 28 МПа и VFA ≤ 0.5';
    }
  }

  [simPNaoh, simPTemp, simPTime, simPMusa].forEach((el) => {
    if (el) el.addEventListener('input', updatePaperSimulator);
  });
  updatePaperSimulator();

  // ===========================================================================
  // 6. PROTOCOL TABS SWITCHING
  // ===========================================================================
  const protoTabs = document.querySelectorAll('.proto-tab');
  const panelCompost = document.getElementById('panel-compost');
  const panelPaper = document.getElementById('panel-paper');

  protoTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetProto = tab.getAttribute('data-protocol');
      protoTabs.forEach((t) => {
        const isCurrent = t === tab;
        t.classList.toggle('active', isCurrent);
        t.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
      });

      if (targetProto === 'paper') {
        if (panelCompost) { panelCompost.classList.remove('active'); panelCompost.hidden = true; }
        if (panelPaper) { panelPaper.classList.add('active'); panelPaper.hidden = false; }
      } else {
        if (panelPaper) { panelPaper.classList.remove('active'); panelPaper.hidden = true; }
        if (panelCompost) { panelCompost.classList.add('active'); panelCompost.hidden = false; }
      }
    });
  });

  // ===========================================================================
  // 7. 51-MODULE CURRICULUM & QUIZ ENGINE (СЛОНОЛОГИЯ.EDU)
  // ===========================================================================
  let currentTrackFilter = 'ALL';
  let activeModuleId = 'mod-1-hindgut-biomechanics';

  const modulesListEl = document.getElementById('modules-list');
  const moduleInspectorEl = document.getElementById('module-inspector');

  function renderModulesList() {
    if (!modulesListEl) return;
    const filtered = ALL_51_MODULES.filter(
      (m) => currentTrackFilter === 'ALL' || m.track === currentTrackFilter
    );

    modulesListEl.innerHTML = filtered.map((m) => {
      const st = userProgress.modules[m.id];
      const isDone = st && st.isCompleted;
      const isActive = m.id === activeModuleId;
      return `
        <button type="button" class="module-row-btn ${isActive ? 'active' : ''}" data-mod-id="${m.id}">
          <div class="mod-row-top">
            <span>МОДУЛЬ ${String(m.moduleIndex).padStart(2, '0')}</span>
            <span class="${isDone ? 'status-ok' : ''}">${isDone ? `● Сдан (${st.score}%)` : '○ Доступен'}</span>
          </div>
          <div class="mod-row-title">${m.title}</div>
        </button>
      `;
    }).join('');

    modulesListEl.querySelectorAll('.module-row-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeModuleId = btn.getAttribute('data-mod-id');
        renderModulesList();
        renderModuleInspector();
      });
    });
  }

  function renderModuleInspector() {
    if (!moduleInspectorEl) return;
    const mod = ALL_51_MODULES.find((m) => m.id === activeModuleId) || ALL_51_MODULES[0];
    const st = userProgress.modules[mod.id];
    const isDone = st && st.isCompleted;

    moduleInspectorEl.innerHTML = `
      <div class="inspector-meta">
        МОДУЛЬ ${String(mod.moduleIndex).padStart(2, '0')} ИЗ 51 · ${mod.track} · ID: ${mod.id}
      </div>
      <h3 class="inspector-title">${mod.title}</h3>
      <p class="inspector-context">${mod.scientificContext}</p>
      <div class="inspector-readings">
        <strong>Обязательная библиография модуля:</strong> ${mod.requiredReadings.join(' · ')}
      </div>

      <div class="quiz-card">
        <div class="mono-meta" style="margin-bottom: 0.4rem;">
          АТТЕСТАЦИОННЫЙ КВИЗ МОДУЛЯ (+250 XP) ${isDone ? '· СТАТУС: ЗАЧТЕНО (100%)' : ''}
        </div>
        <div class="quiz-q">${mod.quiz.question}</div>
        <div class="quiz-options">
          ${mod.quiz.options.map((opt, idx) => `
            <button type="button" class="quiz-opt-btn ${isDone && idx === mod.quiz.correctAnswer ? 'correct' : ''}" data-opt-idx="${idx}">
              ${idx + 1}. ${opt}
            </button>
          `).join('')}
        </div>
        <div class="quiz-feedback" id="quiz-feedback" ${isDone ? '' : 'hidden'}>
          ${isDone ? `<strong>Верно (100%):</strong> ${mod.quiz.explanation}` : ''}
        </div>
      </div>
    `;

    const feedbackEl = document.getElementById('quiz-feedback');
    moduleInspectorEl.querySelectorAll('.quiz-opt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosenIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
        moduleInspectorEl.querySelectorAll('.quiz-opt-btn').forEach((b) => {
          b.classList.remove('correct', 'wrong');
        });

        if (chosenIdx === mod.quiz.correctAnswer) {
          btn.classList.add('correct');
          if (feedbackEl) {
            feedbackEl.hidden = false;
            feedbackEl.innerHTML = `<strong>Аттестация пройдена (100%):</strong> ${mod.quiz.explanation}`;
          }
          const wasCompleted = userProgress.modules[mod.id]?.isCompleted;
          userProgress.modules[mod.id] = {
            moduleId: mod.id,
            isUnlocked: true,
            isCompleted: true,
            score: 100,
            completedAt: new Date().toISOString(),
            timeSpentSeconds: 300
          };
          if (!wasCompleted) {
            userProgress.totalXp += 250;
          }
          saveAndRefreshEduUI();
          renderModulesList();
        } else {
          btn.classList.add('wrong');
          if (feedbackEl) {
            feedbackEl.hidden = false;
            feedbackEl.innerHTML = `<strong>Неточный ответ:</strong> Перепроверьте физико-химические константы в описании модуля и попробуйте снова.`;
          }
        }
      });
    });
  }

  document.querySelectorAll('.track-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.track-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTrackFilter = btn.getAttribute('data-track');
      const firstMatch = ALL_51_MODULES.find(
        (m) => currentTrackFilter === 'ALL' || m.track === currentTrackFilter
      );
      if (firstMatch) activeModuleId = firstMatch.id;
      renderModulesList();
      renderModuleInspector();
    });
  });

  saveAndRefreshEduUI();
  renderModulesList();
  renderModuleInspector();
});
