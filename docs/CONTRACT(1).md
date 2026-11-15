# Контракт модуля станции

Как модуль (`elephantorina`, `Elephant-keeper-`, `Digitalmethod`, `Elephantpoop`, `slonovet`) показывает станции свой прогресс и как ведёт себя внутри неё. Основание: `docs/station/ROADMAP.md`, этапы 4 и 5.

## 1. Память: один ключ — один писатель

Все модули и станция живут на одном origin (`drinkbeer228.github.io`), поэтому делят `localStorage`.

| Ключ | Кто пишет | Кто читает |
|---|---|---|
| `ers_station_v1` | оболочка станции | оболочка |
| `ers_library_v1` | библиотека (читалка станции) | библиотека, формуляр |
| `ers_progress_v1:<модуль>` | **только сам модуль** | модуль, формуляр станции |
| собственные ключи модуля | модуль | только модуль |

Станция не читает собственные ключи модуля и не пишет в `ers_progress_v1:<модуль>`. Исключение — импорт формуляра из файла: он объединяет записи по правилам §3.

`<модуль>` — id из реестра станции (`src/station/registry.ts`):

| Репозиторий | id |
|---|---|
| `elephantorina` | `elephantorina` |
| `Elephant-keeper-` | `keeper` (синоним `elephantkeeper`) |
| `Digitalmethod` | `somatic` |
| `Elephantpoop` | `biolab` |
| `slonovet` | `slonovet` |

**Синоним `elephantkeeper`.** Канонический id симулятора кипера — `keeper`. Сам симулятор подписывает сообщения как `elephantkeeper` и пишет сводку в оба ключа: `ers_progress_v1:elephantkeeper` и, для обратной совместимости, `ers_progress_v1:keeper`. Станция принимает оба варианта:

- в протоколе `postMessage` поле `module: 'elephantkeeper'` считается тем же модулем, что и `keeper` (`MODULE_ALIASES` в `src/station/embed/protocol.ts`), а проверки `origin` и `source` остаются прежними;
- сводки из обоих ключей объединяются по правилам §3 (`keeperProgress()` в `src/station/progress.ts`), при совпадении у каждой записи побеждает более новая.

Новым модулям синонимы не нужны: им следует подписываться своим id из таблицы.

## 2. Формат сводки `ers.progress/1`

```json
{
  "schema": "ers.progress/1",
  "module": "keeper",
  "updatedAt": "2026-11-14T10:00:00.000Z",
  "items": {
    "feeding": { "kind": "scenario", "status": "done", "at": "2026-11-14T10:00:00.000Z", "score": 8 },
    "anatomy/trunk": { "kind": "quiz", "status": "started", "at": "2026-11-13T18:20:00.000Z", "ref": { "book": "anatomy/trunk" } }
  }
}
```

- `items` — id элемента (`[A-Za-z0-9/_.:-]`, до 120 символов) → запись.
- `kind` — тип элемента в модуле: `quiz`, `scenario`, `practice`, `analysis`…
- `status` — `started` или `done`.
- `at` — время последнего изменения, ISO 8601.
- `score` — число, необязательно. `ref.book` — id книги библиотеки, необязательно.
- В сводке **только** id, статус, дата и балл. Никаких текстов, заметок, ответов, голосовых и личных данных: квота `localStorage` общая на весь origin, а терапевтические записи остаются в своём модуле.
- Не больше 500 элементов.

Готовая реализация без зависимостей — `docs/station/ers-progress.js`. Скопируйте файл в модуль как есть.

## 3. Версии и слияние

- Внутри версии поля только **добавляются**. Станция пропускает незнакомые поля.
- Ломающее изменение — новый ключ (`ers_progress_v2:<модуль>`) и новая схема (`ers.progress/2`) плюс функция `migrate` в самом модуле.
- Сводку незнакомой версии станция не читает, но сохраняет как есть при экспорте.
- Слияние идёт по элементу: побеждает более новый `at`, а `done` никогда не понижается до `started`.

## 4. Встраивание (этап 5)

Станция открывает модуль в `iframe` на «планшете» поверх карты. Уровни готовности:

| Уровень | Что умеет | Правка в модуле |
|---|---|---|
| L0 `link` | ссылка в той же вкладке | нет |
| L1 `frame` | открывается в `iframe` как есть | нет |
| L2 `handshake` | с `?embedded=1` шлёт `ready` и заголовок; своя ссылка «на станцию» становится `close-request`, ссылки на станцию — `navigate` | да |
| L3 | глубокие ссылки (`?book=`, `?scenario=`) | да |
| L4 | пишет `ers_progress_v1:<модуль>` | да |

### Протокол `postMessage`

Конверт: `{ ers: 1, type, module, ...payload }`. Станция проверяет `origin` (`https://drinkbeer228.github.io`) и `source` (свой `iframe`), а `module` — по id из §1 с учётом синонимов (`elephantkeeper` → `keeper`). Модуль отвечает на тот же `origin`.

Модуль → станция:

| `type` | Поля | Смысл |
|---|---|---|
| `ready` | — | модуль загрузился и понял, что он встроен |
| `title` | `title` | заголовок для шапки планшета |
| `close-request` | — | пользователь нажал «Выйти» внутри модуля |
| `navigate` | `route` | перейти по маршруту станции, например `#/quiz?book=anatomy/trunk` |

Станция → модуль:

| `type` | Поля | Смысл |
|---|---|---|
| `init` | `mode`, `reducedMotion` | после `ready`: режим станции и «меньше движения» |
| `pause` | — | планшет свёрнут или вкладка скрыта: остановить звук и анимацию |
| `resume` | — | вернуться к работе |

Где модули сейчас (2026-11-14):

| Модуль | Уровень | Что сделано |
|---|---|---|
| `elephantorina` | L4 | `ready`, заголовок раздела, «Станция» → `close-request`, ссылки на книги → `navigate`; `?book=`; сводка по книгам |
| `Elephant-keeper-` (`keeper`, подписывается как `elephantkeeper`) | L4 | `ready`, заголовок, `pause` открывает меню, «На станцию» на плашке задания; `?scenario=<id>` — восемь заданий стажировки; сводка по заданиям |
| `Digitalmethod` (`somatic`) | L2 | `ready`, заголовок; кнопка установки PWA скрыта в iframe; сводки нет — записи остаются в модуле |
| `Elephantpoop` (`biolab`) | L4 | `ready`, заголовок, «← На станцию» в ленте оверлея; сводка по пройденным модулям курса |
| `slonovet` | L0 | не опубликован |

`navigate` к месту станции вне модулей (книга, карта) закрывает «планшет»; «Назад» возвращает модуль.

Минимальная поддержка L2 в модуле:

```js
const embedded = new URLSearchParams(location.search).get('embedded') === '1' && parent !== window;
const STATION = 'https://drinkbeer228.github.io';
if (embedded) {
  document.documentElement.classList.add('ers-embedded'); // скрыть свою шапку и ссылку «На станцию»
  parent.postMessage({ ers: 1, type: 'ready', module: 'keeper' }, STATION);
  addEventListener('message', (e) => {
    if (e.origin !== STATION || e.source !== parent || e.data?.ers !== 1) return;
    if (e.data.type === 'pause') { /* остановить звук */ }
  });
}
```
