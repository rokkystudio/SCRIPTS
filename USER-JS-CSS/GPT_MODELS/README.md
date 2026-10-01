# GPT Model Picker

## 1.1.2 backend signal overrides

Current file: `GPT_MODEL_PICKER_v1.1.2.js`.

The panel opens a separate `Backend Signals` window, so the main picker stays compact and the signal rows are visible without an inner scroll. Every row is `Preserve` by default, so v1.1.2 keeps the same request behavior until an override is selected. Available signals: `conversation_origin`, `conversation_mode`, `conversation_mode.kind`, `chat_mode`, `tpp_work_handoff_conversion`, `conversation_execution_target`, `metadata.conversation_execution_target`, and `turn_origin`.

Each signal can use `Chat preset`, `Work preset`, `Custom JSON`, or `Delete`; the final override layer is applied after model, thinking effort, service tier, and Chat Mode rewrites. The right `Applied value` field shows the exact value/action that will be sent for the selected mode.

Браузерный JavaScript для ChatGPT, который позволяет выбирать model slug из каталогов Chat и Work, задавать thinking effort и service tier и при необходимости удерживать выбранную Work-модель внутри обычного Chat.

## Текущая версия

Текущая версия: `1.1.2`.

Основной файл:

`GPT_MODEL_PICKER_v1.1.2.js`

История изменений ведётся в `CHANGELOG.md`.

## Правило версий

Репозиторий содержит один актуальный релизный файл:

`GPT_MODEL_PICKER_vX.Y.Z.js`

При выпуске новой версии текущий файл получает новый номер, а предыдущие релизные JS-файлы удаляются из рабочего дерева. История изменений сохраняется в `CHANGELOG.md`.

Перед браузерным тестом новой версии выполняются `node --check` и локальные тесты преобразования payload. После этого новая версия подключается пользователем, и только затем продолжается браузерная проверка.

## Основной сценарий

Скрипт перехватывает:

`/backend-api/f/conversation`

и может менять model slug, thinking effort, service tier и параметры режима разговора.

При выбранном конкретном model slug скрипт подставляет этот slug в исходящий запрос.

Пункт `Не изменять модель` не меняет model slug. Внутренне он использует служебное значение `auto`, но в интерфейсе не называется Auto, чтобы не путаться с моделью Auto-auto из каталога.

## Chat Mode

Начиная с версии 1.0.9 доступен переключатель:

`Chat Mode`

Он использует проверенное поведение ранних версий и предназначен для предотвращения перехода обычного Chat в Work при ручном выборе Work-модели.

Когда `Chat Mode` включён и выбран конкретный model slug, для обычного `primary_assistant` запроса скрипт:

- сохраняет `conversation_mode = { kind: "primary_assistant" }`;
- явно задаёт `conversation_origin = null`;
- задаёт `chat_mode = "chat"`, если это поле присутствует;
- не передаёт `tpp_work_handoff_conversion`;
- не передаёт верхнеуровневый `conversation_execution_target`;
- не передаёт `metadata.conversation_execution_target` нового user-сообщения.

Когда `Chat Mode` выключен, выбранный model slug по-прежнему применяется, но параметры режима разговора не переопределяются. Это позволяет при необходимости вернуть штатное поведение ChatGPT для выбранной модели.

Состояние `Chat Mode` сохраняется в localStorage. Если сохранённого значения нет, режим включён по умолчанию.

При `Не изменять модель` Chat Mode не меняет режим разговора, потому что принудительное сохранение Chat применяется только вместе с ручным model slug.

Gizmo/custom-GPT режимы не преобразуются в `primary_assistant`.

## Почему нет Work → Chat

Браузерные проверки показали, что уже существующий прямой Work с server-side:

`conversation_origin = "tpp"`

не превращается в Chat ни через PATCH origin, ни следующим ходом с `conversation_origin=null`, ни через новую штатную ветку.

Поэтому текущая стратегия — не пытаться конвертировать существующий Work, а предотвращать переход Chat → Work через `Chat Mode`.

## Подтверждённый тест Work-модели в Chat

На версии 1.0.7 был создан новый обычный Chat с Work-моделью:

`gpt-5.6-sol-wm`

Frontend исходно сформировал Work-параметры, а перехватчик отправил ход как Chat. Backend ответил HTTP 200.

После первого ответа server-side список разговоров вернул:

`conversation_origin = null`

Второй ход с той же Work-моделью также завершился HTTP 200, и server-side origin остался `null`.

Экспериментальный разговор после проверки удалён.

## Меню боковой панели в 1.1.0

- Правый клик по обычному и проектному разговору не подавляется: ChatGPT самостоятельно создаёт своё контекстное меню.
- Обработчик правого клика строки только сохраняет её настоящий `a[data-interactive-row-link][href]`; добавление пункта выполняется MutationObserver после создания или наполнения `role="menu"`.
- Меню троеточия определяется через ARIA-связь с кнопкой `Действия чата`; оба способа открытия получают первым пунктом `Открыть в новой вкладке`.
- Для проектных разговоров используется полный существующий `href` с маршрутом проекта.
- `Новый чат`, `Запланировано`, `Библиотека` и `Плагины` имеют отдельную ссылочную поверхность `<a href>` поверх штатной кнопки. Правый клик, средняя кнопка и модифицированный клик обрабатываются браузером как для обычной ссылки; обычный левый клик передаётся исходной кнопке ChatGPT. При наведении ссылочная поверхность использует штатный `--color-background-primary-ghost-hover`, поэтому визуальный hover совпадает с исходными пунктами.
- В меню `Обзор` ссылочное поведение применяется к пунктам с самостоятельными страницами: `Финансы` и `Карты`. Остальные действия меню остаются штатными menuitem ChatGPT.
- Пункт `Открыть в новой вкладке` клонирует только активный menuitem; disabled-атрибуты и стили не переносятся на пользовательский пункт.
- Кнопки `Закрепить чат` и `Открепить чат` вместе с отдельным контейнером не занимают место в строке. Действие редактирования проекта не затрагивается.

## Интерфейс 1.1.0

Панель стала компактнее и оформлена как небольшое приложение.

Шапка следует визуальному подходу `C:\FILES\PROJECTS\DROPME-APP`:

- отдельная title bar;
- иконка приложения слева;
- название `GPT Model Picker`;
- отдельная вторичная строка `ChatGPT · v1.1.0`;
- плоская кнопка сворачивания справа;
- вся свободная область шапки используется для перемещения окна.

Основной интерфейс содержит:

- выбор модели;
- ручной model slug;
- thinking effort;
- `Скорость 1.5x`;
- `Chat Mode`;
- многострочные параметры последнего запроса и backend-ответа;
- краткую подсказку.

Текст и контролы уменьшены по сравнению с предыдущими версиями.

## Изменение размера окна

Панель можно менять по ширине и высоте стандартным resize-маркером в правом нижнем углу.

Размер сохраняется в localStorage и восстанавливается после перезагрузки.

При маленьком размере содержимое диагностики может быть обрезано. Это сделано намеренно: для просмотра полного текста окно можно просто увеличить.

При сворачивании меняется только высота панели до title bar. Ширина остаётся точно такой же, какой была у развёрнутого окна; после разворачивания восстанавливается сохранённая высота.

## Автоматическое применение

Отдельные кнопки применения не нужны.

Сразу применяются:

- выбранная модель;
- ручной slug;
- thinking effort;
- `Скорость 1.5x`;
- `Chat Mode`.

Каталоги загружаются автоматически при запуске с ограниченным числом повторов после ошибки.

Защита `window.fetch` восстанавливается автоматически по таймеру. Строка перехвата отображается в панели только при ошибке.

## Thinking effort

Доступны:

- `Auto`;
- `min`;
- `standard`;
- `extended`;
- `xhigh`;
- `max`;
- `ultra`.

`Auto` сохраняет штатный thinking effort исходящего запроса.

## Скорость 1.5x

При включении:

`service_tier = "priority"`

При выключении штатный service tier не заменяется.

## Каталоги моделей

Используются:

`/backend-api/tpp/models/?supports_model_picker_upgrade_presets=true`

`/backend-api/models?iim=false&is_gizmo=false&supports_model_picker_upgrade_presets=true`

TPP-каталог при необходимости повторяется с bearer-токеном текущей ChatGPT-сессии. Токен используется только внутри локального запроса и не записывается в DOM, console или localStorage.

## Статические списки моделей 1.1.0

Помимо загружаемых каталогов Work и обычного ChatGPT список выбора содержит статические разделы:

- `Исторические модели` — сохранённые slug прежних ChatGPT-моделей и Deep Research;
- `Экспериментальные модели OpenAI API` — имена моделей со страницы OpenAI API `All models`, включая flagship, image, realtime/audio, Daybreak, life sciences, open-weight, embeddings и more/deprecated models.

Статические пункты отображаются с badge `[история]` или `[API-only]` и участвуют в поиске выбранной модели для состояния панели и thinking effort.

## Диагностика

Панель показывает:

- параметры последнего исходящего запроса в многострочном формате `Model`, `Thinking`, `Priority` и режим разговора;
- параметры backend-ответа в многострочном формате `Model`, `Thinking` и `Priority`, если backend раскрывает service tier;
- ошибки защищённого `fetch`;
- ошибки загрузки каталогов Work и ChatGPT;
- снятые блокировки отправки со счётчиками backend-ответа и кнопки;
- последние ответы о лимитах из `gpt-model-picker.limit-diagnostics.v1`.

Успешное состояние перехватчика и успешная загрузка каталогов не занимают место в диагностике. Выбранные параметры отображаются самими контролами панели.

## Разблокировка отправки при исчерпанном лимите

Версия 1.1.0 снимает клиентский запрет кнопки отправки, который ChatGPT включает при исчерпанном лимите Work, и не даёт этому запрету вернуться. Режим работает всегда; отдельного переключателя в панели нет.

Используются три независимых механизма:

- перехваченные ответы `/backend-api/wham/usage`, `/backend-api/wham/usage/stream`, `/backend-api/conversation/init` и `/backend-api/f/conversation/prepare` приводятся к разрешающему состоянию: `allowed = true`, `limit_reached = false`, `used_percent` закрытого окна обнуляется, `rate_limit_upsell`, `rate_limit_reached_type` и `overage_limit_reached` очищаются, события SSE переписываются целиком, включая JSON, разбитый сервером на несколько строк `data:`. Именно `conversation/init` сообщает запрет отправки через `blocked_features` со значением вида `tpp_send` и парный `banner_info`; такие флаги удаляются, а посторонние баннеры и блокировки сохраняются. Остальные поля ответа не меняются;
- наблюдатель DOM снимает с кнопки `aria-disabled="true"`, `disabled`, `data-disabled`, `readonly` и класс `pointer-events-none`, удерживает редактор композера редактируемым, а попытки ChatGPT повторно пометить кнопку отключённой перехватываются на уровне `Element.prototype.setAttribute` и свойства `disabled`;
- если ChatGPT всё же проигнорировал клик по разблокированной кнопке и ход разговора не начался, отправка повторяется через штатную форму композера.

Режим не меняет entitlement аккаунта: окончательное решение остаётся за backend. Чтобы отправить ход при исчерпанном лимите Work, вместе с разблокировкой используйте `Chat Mode` и ручной model slug — тогда перехватчик отправит ход как обычный Chat.

В панели отображается строка `Отправка:` со счётчиками снятых блокировок ответа backend и кнопки. Пока вмешательства не было, строка скрыта.

Последние срабатывания сохраняются в `gpt-model-picker.limit-diagnostics.v1`: время, вид записи (`json-rewritten`, `json-unchanged`, `sse-rewritten`, `sse-unchanged`) и путь. Тела ответов не сохраняются, поэтому токены и иные данные сессии в снимок не попадают. Хранятся только последние 6 записей.

## Хранилище

Используются:

- `gpt-model-picker.selected-model.v2`;
- `gpt-model-picker.thinking-effort.v1`;
- `gpt-model-picker.fast-mode.v1`;
- `gpt-model-picker.force-chat.v1`;
- `gpt-model-picker.limit-diagnostics.v1`;
- `gpt-model-picker.position.v1`;
- `gpt-model-picker.collapsed.v1`;
- `gpt-model-picker.size.v1`.

## Управление из консоли

Экземпляр:

`window.__gptModelPicker`

Экспортируются:

- `config`;
- `state`;
- `start()`;
- `stop()`;
- `loadModels()`;
- `setSelectedModel(modelSlug, persist)`;
- `setSelectedThinkingEffort(thinkingEffort, persist)`;
- `setFastModeEnabled(enabled, persist)`;
- `setForceChatEnabled(enabled, persist)`;
- `neutralizeRateLimits(value)`;
- `rewriteLimitedResponse(response, path)`;
- `updateConversationBody(body)`;
- `restoreHook()`.

## Ограничения

Скрипт использует внутренние backend и frontend интерфейсы ChatGPT. Они могут меняться без обратной совместимости.

Выбор Work model slug внутри Chat не меняет entitlement аккаунта. Backend принимает окончательное решение о доступности модели, thinking effort и service tier.

`Chat Mode` предназначен для предотвращения Chat → Work при формировании нового хода. Он не конвертирует уже существующий прямой Work с server-side `conversation_origin=tpp` обратно в Chat.

## Проверка 1.1.0

Синтаксис:

`node --check GPT_MODEL_PICKER_v1.1.0.js`

Браузерная проверка контекстного меню выполняется после подключения файла версии 1.1.0.

Разблокировка отправки проверена локальными тестами: снятие запрета отправки из реального ответа `conversation/init` (`blocked_features` + `banner_info`) с сохранением посторонних блокировок, нейтрализация реального ответа `/backend-api/wham/usage`, переписывание JSON-ответов и SSE-событий (включая JSON, разбитый на несколько строк `data:`), отсутствие ложных срабатываний на ответах без лимитов, снятие блокировки с кнопки, обход DOM и повторная отправка через форму композера.
