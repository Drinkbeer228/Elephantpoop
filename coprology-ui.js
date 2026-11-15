/**
 * Копрограмма и ситовый анализ: интерфейс лабораторной работы поверх логики `coprology.js`.
 * Итог записывается в сводку станции (`ErsStation.recordItem`), внутри станции есть кнопка возврата.
 */
(function () {
  const C = window.Coprology;
  const root = document.getElementById('coprology-lab');
  if (!C || !root) return;

  const STEPS = [
    { id: 'sieve', title: '1. Отмывка пробы на ситах' },
    { id: 'microscope', title: '2. Микроскопия волокон' },
    { id: 'ph', title: '3. Экспресс-тест pH (ЛЖК)' },
    { id: 'done', title: '4. Протокол и лист бумаги' },
  ];
  let run = C.createRun();

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const btn = (cls, text, onClick) => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };

  const status = el('p', 'copro-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const say = (text, tone) => {
    status.textContent = text;
    status.dataset.tone = tone || '';
  };

  function stepper() {
    const ol = el('ol', 'copro-steps');
    const order = STEPS.map((s) => s.id);
    const cur = order.indexOf(run.step === 'reading' ? 'ph' : run.step);
    STEPS.forEach((s, i) => {
      const li = el('li', i < cur ? 'is-done' : i === cur ? 'is-current' : '', s.title);
      if (i === cur) li.setAttribute('aria-current', 'step');
      ol.append(li);
    });
    return ol;
  }

  function sievePanel() {
    const p = el('div', 'copro-panel');
    p.append(
      el('p', 'copro-lead', `Проба ${C.SAMPLE.massG} г из партии, которую электрокар привёз из Манежа. Промойте её через сита струёй воды — в том порядке, в каком их ставят в колонну.`),
    );
    const row = el('div', 'copro-sieves');
    for (const mm of [1, 4, 2]) {
      const washed = run.washed.includes(mm);
      const card = el('div', `copro-sieve${washed ? ' is-washed' : ''}`);
      card.append(el('div', 'copro-sieve-mesh', `${mm} мм`));
      if (washed) {
        card.append(el('div', 'copro-sieve-result', `осталось ${C.SAMPLE.fractions[mm]} %`));
      } else {
        card.append(
          btn('btn-secondary', `Промыть на сите ${mm} мм`, () => {
            const r = C.washSieve(run, mm);
            if (!r.ok) say(`Сначала сито ${r.expected} мм: мелкое сито забьётся грубой фракцией, и отсев будет неверным.`, 'warn');
            else if (r.finished) say(`Проход через 1 мм — ${C.SAMPLE.fractions.fines} %. Фракции 4 и 2 мм — длинное волокно сена и веток: переходим к микроскопу.`, 'ok');
            else say(`На сите ${mm} мм осталось ${r.retainedPct} % пробы.`, 'ok');
            render();
          }),
        );
      }
      row.append(card);
    }
    p.append(row);
    return p;
  }

  function microscopePanel() {
    const p = el('div', 'copro-panel');
    p.append(el('p', 'copro-lead', 'Капля суспензии с сит 2 и 1 мм под микроскопом, сетка окуляра — 5 мм. Какой длины волокон в поле зрения больше всего?'));
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'copro-scope');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Поле зрения: ${run.fibers.length} волокон разной длины на сетке с шагом 5 мм`);
    for (let g = 0; g <= 100; g += 12.5) {
      for (const [x1, y1, x2, y2] of [[g, 0, g, 100], [0, g, 100, g]]) {
        const l = document.createElementNS(svgNS, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('class', 'copro-grid');
        svg.append(l);
      }
    }
    for (const f of run.fibers) {
      const len = f.lengthMm * 2.5; // 5 мм = 12,5 единиц сетки
      const a = (f.angle * Math.PI) / 180;
      const dx = (Math.cos(a) * len) / 2;
      const dy = (Math.sin(a) * len) / 2;
      const l = document.createElementNS(svgNS, 'line');
      l.setAttribute('x1', (f.x - dx).toFixed(1)); l.setAttribute('y1', (f.y - dy).toFixed(1));
      l.setAttribute('x2', (f.x + dx).toFixed(1)); l.setAttribute('y2', (f.y + dy).toFixed(1));
      l.setAttribute('class', 'copro-fiber');
      svg.append(l);
    }
    p.append(svg);
    const choices = el('div', 'copro-choices');
    for (const c of C.LENGTH_CLASSES) {
      choices.append(
        btn('btn-secondary', c.label, () => {
          const r = C.pickFiberClass(run, c.id);
          if (!r.ok) say('Посчитайте ещё раз по клеткам сетки: одна клетка — 5 мм.', 'warn');
          else say(`Верно: средняя длина ${String(r.meanMm).replace('.', ',')} мм — рацион с грубым сеном переваривается без измельчения волокна.`, 'ok');
          render();
        }),
      );
    }
    p.append(choices);
    return p;
  }

  function phPanel() {
    const p = el('div', 'copro-panel');
    const sample = C.PH_SCALE.find((s) => s.ph === C.SAMPLE_PH);
    if (run.step === 'ph') {
      p.append(el('p', 'copro-lead', 'Индикаторная полоска пролежала в фильтрате 30 секунд. Сравните её цвет со шкалой.'));
      const strip = el('div', 'copro-strip');
      strip.style.setProperty('--strip', sample.color);
      strip.setAttribute('aria-label', 'Полоска после теста');
      p.append(strip);
      const scale = el('div', 'copro-scale');
      for (const s of C.PH_SCALE) {
        const b = btn('copro-swatch', `pH ${s.label}`, () => {
          const r = C.readStrip(run, s.ph);
          if (!r.ok) say('Цвет не совпадает: поднесите полоску к шкале при дневном свете.', 'warn');
          else say(`pH ${s.label}. Что это значит для ферментации в толстой кишке?`, 'ok');
          render();
        });
        b.style.setProperty('--swatch', s.color);
        scale.append(b);
      }
      p.append(scale);
    } else {
      p.append(el('p', 'copro-lead', `pH пробы — ${sample.label}. Как истолковать результат?`));
      const choices = el('div', 'copro-choices copro-choices-col');
      for (const r of C.PH_READINGS) {
        choices.append(
          btn('btn-secondary', r.label, () => {
            const res = C.interpret(run, r.id);
            if (!res.ok) say('Сверьтесь с нормой заднекишечных ферментеров: pH 6,2–7,0.', 'warn');
            else {
              save();
              say(`Анализ завершён: ${res.score} баллов. Запись внесена в Студенческий билет.`, 'ok');
            }
            render();
          }),
        );
      }
      p.append(choices);
    }
    return p;
  }

  function donePanel() {
    const p = el('div', 'copro-panel');
    const dl = el('dl', 'copro-report');
    const fr = C.SAMPLE.fractions;
    const rows = [
      ['Ситовый анализ', `4 мм — ${fr[4]} %, 2 мм — ${fr[2]} %, 1 мм — ${fr[1]} %, проход — ${fr.fines} %`],
      ['Волокно', `преобладает ${C.LENGTH_CLASSES.find((c) => c.id === run.fiberClass).label}, средняя длина ${String(C.meanLength(run.fibers)).replace('.', ',')} мм`],
      ['pH (ЛЖК)', `${String(C.SAMPLE_PH).replace('.', ',')} — норма ферментации`],
      ['Балл', `${C.score(run)} из 100`],
    ];
    for (const [k, v] of rows) dl.append(el('dt', '', k), el('dd', '', v));
    p.append(el('p', 'copro-lead', 'Протокол копрограммы'), dl);

    const craft = el('div', 'copro-craft');
    if (run.paper) {
      const sheet = el('div', 'copro-sheet');
      sheet.append(el('span', '', `Лист A5 · ${run.paper.gsm} г/м²`), el('small', '', `${String(run.paper.fiberG).replace('.', ',')} г волокна с сит 4 и 2 мм`));
      craft.append(sheet);
    } else {
      craft.append(
        el('p', 'copro-note', 'По желанию: отварить волокно с сит 4 и 2 мм в щёлочи, промыть и отлить лист «слоновьей бумаги».'),
        btn('btn-secondary', 'Отлить лист бумаги', () => {
          const r = C.castPaperSheet(run);
          if (r.ok) {
            save();
            say(`Лист готов: ${r.gsm} г/м², как плотная бумага ручного отлива.`, 'ok');
          }
          render();
        }),
      );
    }
    p.append(craft);

    const actions = el('div', 'copro-actions');
    actions.append(
      btn('btn-ghost', 'Новая проба', () => {
        run = C.createRun();
        say('');
        render();
      }),
    );
    if (window.ErsStation && window.ErsStation.embedded()) {
      actions.append(btn('btn-primary', '← Вернуться на станцию', () => window.ErsStation.requestClose()));
    }
    p.append(actions);
    return p;
  }

  function save() {
    if (!window.ErsStation) return;
    const items = C.summaryItems(run, new Date().toISOString());
    for (const [id, item] of Object.entries(items)) window.ErsStation.recordItem(id, item);
  }

  let shown = false;
  function render() {
    const body =
      run.step === 'sieve' ? sievePanel() : run.step === 'microscope' ? microscopePanel() : run.step === 'done' ? donePanel() : phPanel();
    root.replaceChildren(stepper(), body, status);
    // The next step replaces the panel: keep its top in view, below the sticky ribbon of the station's tablet.
    if (shown && root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start' });
    shown = true;
  }

  render();
})();
