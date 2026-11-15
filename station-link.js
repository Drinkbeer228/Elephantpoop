/**
 * Связь с Research Station (research-station: docs/station/CONTRACT.md).
 * 1. Встраивание: в iframe станции с ?embedded=1 лаборатория отвечает `ready`, присылает заголовок,
 *    а кнопка «На станцию» в ленте оверлея просит станцию закрыть «планшет» (`close-request`).
 * 2. Сводка для формуляра: ключ `ers_progress_v1:biolab`, схема `ers.progress/1` — только id модуля курса,
 *    статус, время и балл. Засчитываются модули, у которых есть дата прохождения (демо-данные курса без неё).
 *    Записи лабораторных работ (копрограмма, лист бумаги) пишет `recordItem`; сводка курса их сохраняет.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ErsStation = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MODULE = 'biolab';
  const STATION_ORIGIN = 'https://drinkbeer228.github.io';
  const KEY = 'ers_progress_v1:biolab';
  const ID = /^[A-Za-z0-9/_.:-]{1,120}$/;
  const MAX_ITEMS = 500;

  function toSummary(progress, now) {
    const items = {};
    let updatedAt = '';
    const mods = progress && typeof progress.modules === 'object' && progress.modules ? progress.modules : {};
    for (const [id, m] of Object.entries(mods)) {
      if (Object.keys(items).length >= MAX_ITEMS) break;
      if (!ID.test(id) || !m || !m.isCompleted || typeof m.completedAt !== 'string' || Number.isNaN(Date.parse(m.completedAt))) continue;
      const item = { kind: 'module', status: 'done', at: m.completedAt };
      if (typeof m.score === 'number' && isFinite(m.score)) item.score = m.score;
      items[id] = item;
      if (m.completedAt > updatedAt) updatedAt = m.completedAt;
    }
    return { schema: 'ers.progress/1', module: MODULE, updatedAt: updatedAt || now || new Date().toISOString(), items };
  }

  function store(storage) {
    return storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  }

  /** Сводка, уже лежащая в памяти, или null для пустого и чужого. */
  function readSummary(storage) {
    try {
      const s = store(storage);
      const x = s ? JSON.parse(s.getItem(KEY) || 'null') : null;
      return x && x.schema === 'ers.progress/1' && x.module === MODULE && x.items && typeof x.items === 'object' ? x : null;
    } catch (e) {
      return null;
    }
  }

  /** Записи, которые пишет не курс, а лабораторные работы: при пересчёте курса они остаются. */
  function labItems(summary) {
    const out = {};
    for (const [id, it] of Object.entries((summary && summary.items) || {})) {
      if (ID.test(id) && it && it.kind !== 'module') out[id] = it;
    }
    return out;
  }

  function writeSummary(progress, storage) {
    try {
      const s = store(storage);
      if (!s) return;
      const next = toSummary(progress);
      const kept = labItems(readSummary(s));
      for (const [id, it] of Object.entries(kept)) {
        if (!(id in next.items)) next.items[id] = it;
        if (it.at > next.updatedAt) next.updatedAt = it.at;
      }
      s.setItem(KEY, JSON.stringify(next));
    } catch (e) {
      // Нет места или память закрыта: станция просто не увидит сводку.
    }
  }

  /** Одна запись лабораторной работы: `done` не понижается до `started`, остальное — по новизне (CONTRACT.md §3). */
  function recordItem(id, item, storage) {
    if (!ID.test(id) || !item || (item.status !== 'done' && item.status !== 'started')) return false;
    try {
      const s = store(storage);
      if (!s) return false;
      const cur = readSummary(s) || { schema: 'ers.progress/1', module: MODULE, updatedAt: item.at, items: {} };
      const prev = cur.items[id];
      if (prev && prev.status === 'done' && item.status !== 'done') return false;
      if (prev && prev.status === 'done' && typeof prev.score === 'number' && typeof item.score === 'number' && prev.score > item.score) {
        item = Object.assign({}, item, { score: prev.score });
      }
      cur.items[id] = item;
      if (!cur.updatedAt || item.at > cur.updatedAt) cur.updatedAt = item.at;
      s.setItem(KEY, JSON.stringify(cur));
      return true;
    } catch (e) {
      return false;
    }
  }

  function framed() {
    try {
      return window.parent !== window;
    } catch (e) {
      return true;
    }
  }

  function embedded() {
    return typeof window !== 'undefined' && framed() && new URLSearchParams(window.location.search).get('embedded') === '1';
  }

  /** Попросить станцию закрыть «планшет»; вне станции — ничего. */
  function requestClose() {
    if (embedded()) post('close-request');
  }

  function post(type, extra) {
    try {
      window.parent.postMessage(Object.assign({ ers: 1, module: MODULE, type: type }, extra || {}), STATION_ORIGIN);
    } catch (e) {
      // Станции нет.
    }
  }

  /** Подключает протокол, если страница открыта станцией. Возвращает true внутри станции. */
  function connect(doc) {
    if (!embedded()) return false;
    const ribbon = doc.querySelector('.embedded-links');
    if (ribbon && !doc.getElementById('ers-close')) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.id = 'ers-close';
      b.className = 'btn-ghost ers-close';
      b.textContent = '← На станцию';
      b.addEventListener('click', () => post('close-request'));
      ribbon.prepend(b);
    }
    // Предпросмотр оверлея нужен только вне станции.
    const preview = doc.getElementById('preview-embedded-btn');
    if (preview) preview.style.display = 'none';
    post('ready');
    post('title', { title: 'Лаборатория субстрата' });
    return true;
  }

  return { KEY, toSummary, writeSummary, readSummary, recordItem, requestClose, embedded, connect };
});
