# VIDEO LINK PARSER

VIDEO LINK PARSER — браузерный инструмент для сбора прямых ссылок на видео-ресурсы со страницы.

Скрипт:
- перехватывает `fetch`, `XMLHttpRequest`, `URL.createObjectURL`;
- отслеживает `video`, `source`, `video.js` и вспомогательные URL-хелперы Wildberries;
- собирает `mp4`, `m3u8`, `mpd`, `blob` и preview-ссылки;
- показывает найденные ресурсы и журнал событий в отдельной панели.
- удобно для сайтов которые скрывают видео, например если нужно скачать видео с wildberries.

## Структура проекта

```text
VIDEO LINK PARSER/
├── video-link-parser.js
├── video-link-parser.css
└── README.md
```

## Подключение

```html
<script src="./video-link-parser.js"></script>
```

CSS подключается отдельно в нужной точке страницы.

Скрипт запускается сразу после загрузки файла и сохраняет API в `window.__videoLinkParser`.

## Публичный API

### `window.__videoLinkParser.showPanel()`
Разворачивает панель.

### `window.__videoLinkParser.showButton()`
Сворачивает панель в компактный режим.

### `window.__videoLinkParser.dump()`
Возвращает массив найденных video-ссылок.

### `window.__videoLinkParser.resolveBlob(blobUrl)`
Возвращает исходный URL для `blob:`-ссылки, если соответствие найдено.

### `window.__videoLinkParser.stop()`
Останавливает фоновые сканы и `ResizeObserver`.

## Что отслеживается

### Сетевые источники
- `fetch`
- `XMLHttpRequest`
- `performance.getEntriesByType("resource")`

### DOM и media-элементы
- `video.src`
- `source[src]`
- `setAttribute("src", value)` для `VIDEO` и `SOURCE`
- события `play` и `loadedmetadata`

### Дополнительные интеграции
- `URL.createObjectURL`
- `video.js`
- `wb.helpers.url.urlVideoProduct`
- `wb.helpers.url.urlFeedbackVideo`

## Типы ссылок

Скрипт классифицирует ресурсы как:
- `mp4`
- `m3u8`
- `mpd`
- `blob`
- `video`
- `preview`
- `other`

## Поведение панели

Панель:
- закрепляется в верхней части страницы;
- может быть развёрнута или свёрнута;
- синхронизирует верхний отступ страницы с текущей высотой;
- изолирует собственную прокрутку от внешнего документа.

## Кнопки панели

- **Copy video links** — копирует только video-ссылки.
- **Copy all** — копирует все найденные ссылки, включая preview.
- **Scan now** — выполняет ручной скан ресурсов и DOM.
- **Minimize** — сворачивает панель.
- **Clear logs** — очищает журнал.
- **Clear links** — очищает найденные ссылки.

## Примечания

- Для корректного отображения интерфейса CSS-файл подключается отдельно.
- При повторном запуске скрипт использует уже существующий экземпляр `window.__videoLinkParser`.
- `blob:`-ссылки сохраняются отдельно от исходных URL, а при наличии соответствия показывается связь `resolved from`.
