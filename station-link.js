/**
 * Связь с Research Station (research-station: docs/station/CONTRACT.md).
 * 1. Встраивание: в iframe станции с ?embedded=1 лаборатория отвечает `ready`, присылает заголовок,
 *    а кнопка «На станцию» в ленте оверлея просит станцию закрыть «планшет» (`close-request`).
 * 2. Сводка для формуляра: ключ `ers_progress_v1:biolab`, схема `ers.progress/1` — только id модуля курса,
 *    статус, время и балл. Засчитываются модули, у которых есть дата прохождения (демо-данные курса без неё).
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

  function writeSummary(progress, storage) {
    try {
      const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      if (s) s.setItem(KEY, JSON.stringify(toSummary(progress)));
    } catch (e) {
      // Нет места или память закрыта: станция просто не увидит сводку.
    }
  }

  function framed() {
    try {
      return window.parent !== window;
    } catch (e) {
      return true;
    }
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
    if (typeof window === 'undefined' || !framed() || new URLSearchParams(window.location.search).get('embedded') !== '1') return false;
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

  return { KEY, toSummary, writeSummary, connect };
});
