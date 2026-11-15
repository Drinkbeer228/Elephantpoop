/**
 * Контракт модуля станции: Био-лаборатория (`biolab`).
 * Автономная реализация схемы `ers.progress/1` в ключе `ers_progress_v1:biolab`
 * + поддержка флагов (`flags`: например, `["ration-violation"]`), статусов этапов
 * (`analysis`, `paper-craft`, `coprology/fiber-analysis`, `coprology/paper-sheet`),
 * сортов отлитой бумаги и протокола встраивания `postMessage` (`ready`, `title`, `close-request`).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ErsProgress = api;
    root.ErsStation = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  const MODULE = 'biolab';
  const STATION_ORIGIN = 'https://drinkbeer228.github.io';
  const KEY = 'ers_progress_v1:biolab';
  const ID_RE = /^[A-Za-z0-9/_.:-]{1,120}$/;
  const MAX_ITEMS = 500;

  function resolveStorage(storage) {
    if (storage) return storage;
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  function createEmptySummary(now) {
    return {
      schema: 'ers.progress/1',
      module: MODULE,
      updatedAt: now || new Date().toISOString(),
      flags: [],
      items: {}
    };
  }

  /**
   * Читает сводку `ers_progress_v1:biolab` из памяти или возвращает null.
   */
  function readSummary(storage) {
    try {
      const s = resolveStorage(storage);
      if (!s) return null;
      const raw = s.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        parsed.schema !== 'ers.progress/1' ||
        parsed.module !== MODULE ||
        !parsed.items ||
        typeof parsed.items !== 'object'
      ) {
        return null;
      }
      if (!Array.isArray(parsed.flags)) {
        parsed.flags = [];
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  /**
   * Преобразует прогресс академического курса в формат `ers.progress/1`.
   */
  function toSummary(progress, now) {
    const items = {};
    let updatedAt = '';
    const mods = progress && typeof progress.modules === 'object' && progress.modules ? progress.modules : {};
    for (const [id, m] of Object.entries(mods)) {
      if (Object.keys(items).length >= MAX_ITEMS) break;
      if (
        !ID_RE.test(id) ||
        !m ||
        !m.isCompleted ||
        typeof m.completedAt !== 'string' ||
        Number.isNaN(Date.parse(m.completedAt))
      ) {
        continue;
      }
      const item = { kind: 'module', status: 'done', at: m.completedAt };
      if (typeof m.score === 'number' && Number.isFinite(m.score)) {
        item.score = m.score;
      }
      items[id] = item;
      if (m.completedAt > updatedAt) updatedAt = m.completedAt;
    }
    return {
      schema: 'ers.progress/1',
      module: MODULE,
      updatedAt: updatedAt || now || new Date().toISOString(),
      flags: [],
      items
    };
  }

  function extractLabItems(summary) {
    const out = {};
    for (const [id, it] of Object.entries((summary && summary.items) || {})) {
      if (ID_RE.test(id) && it && it.kind !== 'module') {
        out[id] = it;
      }
    }
    return out;
  }

  /**
   * Записывает сводку академических модулей, сохраняя результаты лабораторных столов и флаги.
   */
  function writeSummary(progress, storage) {
    try {
      const s = resolveStorage(storage);
      if (!s) return false;
      const prev = readSummary(s);
      const next = toSummary(progress);
      const kept = extractLabItems(prev);
      for (const [id, it] of Object.entries(kept)) {
        if (!(id in next.items)) next.items[id] = it;
        if (it.at && it.at > next.updatedAt) next.updatedAt = it.at;
      }
      if (prev && Array.isArray(prev.flags)) {
        next.flags = [...new Set(prev.flags)];
      }
      if (prev && prev.lastVerdict) next.lastVerdict = prev.lastVerdict;
      if (prev && prev.lastPaperSheet) next.lastPaperSheet = prev.lastPaperSheet;
      s.setItem(KEY, JSON.stringify(next));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Записывает отдельное действие или этап (`analysis`, `paper-craft`, `coprology/fiber-analysis`, `coprology/paper-sheet`).
   * Статус `done` никогда не понижается до `started`, а лучший `score` сохраняется.
   */
  function recordItem(id, item, storage) {
    if (!ID_RE.test(id) || !item || (item.status !== 'done' && item.status !== 'started')) {
      return false;
    }
    try {
      const s = resolveStorage(storage);
      if (!s) return false;
      const nowIso = item.at || new Date().toISOString();
      const cur = readSummary(s) || createEmptySummary(nowIso);
      const prev = cur.items[id];
      if (prev && prev.status === 'done' && item.status !== 'done') {
        return false;
      }
      const normalized = Object.assign({}, item, { at: nowIso });
      if (
        prev &&
        prev.status === 'done' &&
        typeof prev.score === 'number' &&
        typeof normalized.score === 'number' &&
        prev.score > normalized.score
      ) {
        normalized.score = prev.score;
      }
      cur.items[id] = normalized;
      if (!cur.updatedAt || nowIso > cur.updatedAt) {
        cur.updatedAt = nowIso;
      }
      s.setItem(KEY, JSON.stringify(cur));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Добавляет или снимает сигнальный флаг в массиве `flags` (например, `ration-violation`).
   */
  function setFlag(flagName, active = true, storage) {
    if (typeof flagName !== 'string' || !ID_RE.test(flagName)) return false;
    try {
      const s = resolveStorage(storage);
      if (!s) return false;
      const nowIso = new Date().toISOString();
      const cur = readSummary(s) || createEmptySummary(nowIso);
      const set = new Set(Array.isArray(cur.flags) ? cur.flags : []);
      if (active) set.add(flagName);
      else set.delete(flagName);
      cur.flags = Array.from(set);
      cur.updatedAt = nowIso;
      s.setItem(KEY, JSON.stringify(cur));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Комплексная запись вердикта Стола 1 (Научный анализ пробы).
   * Сохраняет `analysis` и `coprology/fiber-analysis`, а также обновляет флаг `ration-violation`.
   */
  function recordAnalysisVerdict(verdict, storage) {
    if (!verdict || typeof verdict !== 'object') return false;
    try {
      const s = resolveStorage(storage);
      if (!s) return false;
      const nowIso = verdict.at || new Date().toISOString();
      const score = typeof verdict.score === 'number' ? Math.round(verdict.score) : 100;

      const ok1 = recordItem(
        'analysis',
        {
          kind: 'analysis',
          status: 'done',
          at: nowIso,
          score,
          outcome: verdict.violation ? 'ration-violation' : 'norm'
        },
        s
      );
      const ok2 = recordItem(
        'coprology/fiber-analysis',
        {
          kind: 'analysis',
          status: 'done',
          at: nowIso,
          score
        },
        s
      );

      const cur = readSummary(s) || createEmptySummary(nowIso);
      const flags = new Set(Array.isArray(cur.flags) ? cur.flags : []);
      if (verdict.violation) {
        flags.add('ration-violation');
      } else {
        flags.delete('ration-violation');
      }
      cur.flags = Array.from(flags);
      cur.lastVerdict = {
        batchId: verdict.batchId || 'regular',
        meanFiberMm: verdict.meanFiberMm,
        ph: verdict.ph,
        violation: Boolean(verdict.violation),
        dispatchedTo: verdict.violation ? ['slonovet', 'clinic'] : ['paper-workshop'],
        at: nowIso
      };
      cur.updatedAt = nowIso;
      s.setItem(KEY, JSON.stringify(cur));
      return ok1 && ok2;
    } catch (e) {
      return false;
    }
  }

  /**
   * Комплексная запись результата Стола 2 (Цех ручной отливки «слоновьей бумаги»).
   * Сохраняет `paper-craft` и `coprology/paper-sheet`, а также сорт полученного листа.
   */
  function recordPaperCraft(sheetResult, storage) {
    if (!sheetResult || typeof sheetResult !== 'object') return false;
    try {
      const s = resolveStorage(storage);
      if (!s) return false;
      const nowIso = sheetResult.at || new Date().toISOString();
      const score = typeof sheetResult.score === 'number' ? Math.round(sheetResult.score) : 100;
      const gradeId = sheetResult.gradeId || 'archival-photo';

      const ok1 = recordItem(
        'paper-craft',
        {
          kind: 'craft',
          status: 'done',
          at: nowIso,
          score,
          grade: gradeId,
          gradeId,
          gsm: sheetResult.gsm || 209
        },
        s
      );
      const ok2 = recordItem(
        'coprology/paper-sheet',
        {
          kind: 'practice',
          status: 'done',
          at: nowIso,
          score,
          grade: gradeId,
          gradeId,
          gsm: sheetResult.gsm || 209
        },
        s
      );

      const cur = readSummary(s) || createEmptySummary(nowIso);
      cur.lastPaperSheet = {
        gradeId,
        gradeTitle: sheetResult.gradeTitle || '',
        recipient: sheetResult.recipient || '',
        gsm: sheetResult.gsm || 209,
        score,
        at: nowIso
      };
      cur.updatedAt = nowIso;
      s.setItem(KEY, JSON.stringify(cur));
      return ok1 && ok2;
    } catch (e) {
      return false;
    }
  }

  function framed() {
    try {
      return typeof window !== 'undefined' && window.parent !== window;
    } catch (e) {
      return true;
    }
  }

  function embedded() {
    if (typeof window === 'undefined') return false;
    const param = new URLSearchParams(window.location.search).get('embedded') === '1';
    return param && framed();
  }

  function post(type, extra) {
    try {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage(Object.assign({ ers: 1, module: MODULE, type }, extra || {}), STATION_ORIGIN);
      }
    } catch (e) {
      // Игнорируем отсутствие родительского окна станции
    }
  }

  /**
   * Попросить станцию закрыть планшет лаборатории (`close-request`).
   * Если открыто автономно в режиме предпросмотра — переключает состояние.
   */
  function requestClose() {
    post('close-request');
    if (typeof CustomEvent !== 'undefined' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ers:close-requested'));
    }
    return true;
  }

  function navigateStation(route) {
    if (!route) return false;
    post('navigate', { route });
    return true;
  }

  function connect(doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return false;
    const isEmb = embedded() || new URLSearchParams(window.location.search).get('embedded') === '1';
    if (isEmb) {
      d.documentElement.classList.add('ers-embedded');
      if (d.body) d.body.classList.add('is-embedded');
    }
    if (embedded()) {
      post('ready');
      post('title', { title: 'Био-лаборатория субстрата' });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (e) => {
        if (!e.data || e.data.ers !== 1) return;
        if (e.data.type === 'pause') {
          d.documentElement.setAttribute('data-station-paused', 'true');
        } else if (e.data.type === 'resume') {
          d.documentElement.removeAttribute('data-station-paused');
        } else if (e.data.type === 'init' && e.data.reducedMotion) {
          d.documentElement.classList.add('reduced-motion');
        }
      });
    }
    return isEmb;
  }

  return {
    MODULE,
    KEY,
    STATION_ORIGIN,
    toSummary,
    readSummary,
    writeSummary,
    recordItem,
    setFlag,
    recordAnalysisVerdict,
    recordPaperCraft,
    requestClose,
    navigateStation,
    embedded,
    connect
  };
});
