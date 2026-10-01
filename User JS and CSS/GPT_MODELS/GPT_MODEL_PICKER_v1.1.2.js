// GPT_MODEL_PICKER.js v1.1.2
(() => {
    'use strict';

    const GLOBAL_KEY = '__gptModelPicker';

    if (window[GLOBAL_KEY] && typeof window[GLOBAL_KEY].stop === 'function') {
        window[GLOBAL_KEY].stop();
    }

    const config = {
        /** Версия файла и панели. */
        version: '1.1.2',

        /** URL backend-метода со списком моделей режима Work. */
        workModelsUrl: '/backend-api/tpp/models/?supports_model_picker_upgrade_presets=true',

        /** URL backend-метода со списком моделей обычного ChatGPT. */
        chatModelsUrl: '/backend-api/models?iim=false&is_gizmo=false&supports_model_picker_upgrade_presets=true',

        /** Путь запроса создания нового хода разговора. */
        conversationPath: '/backend-api/f/conversation',

        /** Служебное значение старой настройки выбора модели без замены slug. */
        autoModelSlug: 'auto',

        /** Ключ выбранной модели в localStorage. */
        storageKey: 'gpt-model-picker.selected-model.v2',

        /** Ключ глобального режима без вмешательства в localStorage. */
        bypassStorageKey: 'gpt-model-picker.bypass.v1',

        /** Ключ выбранной глубины рассуждения в localStorage. */
        thinkingEffortStorageKey: 'gpt-model-picker.thinking-effort.v1',

        /** Ключ режима ускоренной обработки в localStorage. */
        fastModeStorageKey: 'gpt-model-picker.fast-mode.v1',

        /** Ключ переключателя Chat Mode в localStorage. */
        forceChatStorageKey: 'gpt-model-picker.force-chat.v1',

        /** localStorage key for backend signal override settings. */
        backendOverridesStorageKey: 'gpt-model-picker.backend-overrides.v1',

        /** Ключ позиции панели в localStorage. */
        positionStorageKey: 'gpt-model-picker.position.v1',

        /** Ключ состояния свёрнутой панели в localStorage. */
        collapsedStorageKey: 'gpt-model-picker.collapsed.v1',

        /** Ключ пользовательского размера панели в localStorage. */
        sizeStorageKey: 'gpt-model-picker.size.v1',

        /** Период проверки и автоматического восстановления перехватчика window.fetch. */
        hookCheckIntervalMs: 1000,

        /** Количество повторных загрузок каталогов после ошибки. */
        catalogRetryCount: 2,

        /** Задержка между повторными загрузками каталогов. */
        catalogRetryDelayMs: 1500,

        /** Путь backend-метода расхода лимитов Work и Codex. */
        usagePath: '/backend-api/wham/usage',

        /** Путь потокового backend-метода расхода лимитов. */
        usageStreamPath: '/backend-api/wham/usage/stream',

        /** Путь инициализации разговора, раскрывающий лимиты. */
        conversationInitPath: '/backend-api/conversation/init',

        /** Путь подготовки хода, раскрывающий лимиты. */
        conversationPreparePath: '/backend-api/f/conversation/prepare',

        /** Ключ диагностического снимка ответов о лимитах в localStorage. */
        limitDiagnosticsStorageKey: 'gpt-model-picker.limit-diagnostics.v1',

        /** Максимальное число диагностических записей о лимитах. */
        limitDiagnosticsLimit: 6,

        /** Задержка перед повторной отправкой, если ChatGPT проигнорировал клик по кнопке. */
        unlockResubmitDelayMs: 400,

        /** Включает диагностические сообщения в консоли браузера. */
        debug: true
    };

    const thinkingEffortOptions = [
        { value: 'auto', label: 'Auto — не вмешиваться' },
        { value: 'min', label: 'Лёгкое — min' },
        { value: 'standard', label: 'Стандартное — standard' },
        { value: 'extended', label: 'Усиленное — extended' },
        { value: 'xhigh', label: 'Очень высокое — xhigh' },
        { value: 'max', label: 'Тяжёлое — max' },
        { value: 'ultra', label: 'Ultra — ultra' }
    ];

    const backendSignalOverrideModes = [
        { value: 'preserve', label: 'Preserve' },
        { value: 'chat', label: 'Chat preset' },
        { value: 'work', label: 'Work preset' },
        { value: 'custom', label: 'Custom JSON' },
        { value: 'delete', label: 'Delete' }
    ];

    const backendSignalOptions = [
        { key: 'conversation_origin', label: 'conversation_origin', target: 'payload', property: 'conversation_origin', chatValue: 'null', workValue: '"tpp"', customValue: 'null' },
        { key: 'conversation_mode', label: 'conversation_mode', target: 'payload', property: 'conversation_mode', chatValue: '{"kind":"primary_assistant"}', workValue: '{"kind":"primary_assistant"}', customValue: '{"kind":"primary_assistant"}' },
        { key: 'conversation_mode_kind', label: 'conversation_mode.kind', target: 'conversationModeKind', chatValue: '"primary_assistant"', workValue: '"primary_assistant"', customValue: '"primary_assistant"' },
        { key: 'chat_mode', label: 'chat_mode', target: 'payload', property: 'chat_mode', chatValue: '"chat"', workValue: '"work"', customValue: '"chat"' },
        { key: 'tpp_work_handoff_conversion', label: 'tpp_work_handoff_conversion', target: 'payload', property: 'tpp_work_handoff_conversion', chatAction: 'delete', workValue: 'true', customValue: 'true' },
        { key: 'conversation_execution_target', label: 'conversation_execution_target', target: 'payload', property: 'conversation_execution_target', chatAction: 'delete', workValue: '"tpp"', customValue: '"tpp"' },
        { key: 'message_conversation_execution_target', label: 'metadata.conversation_execution_target', target: 'messageMetadata', property: 'conversation_execution_target', chatAction: 'delete', workValue: '"tpp"', customValue: '"tpp"' },
        { key: 'turn_origin', label: 'turn_origin', target: 'payload', property: 'turn_origin', chatValue: '"targeted_reply"', workValue: '"targeted_reply"', customValue: '"targeted_reply"' }
    ];

    const historicalModels = [
        { slug: 'gpt-5-5-instant', title: 'GPT-5.5 Instant', badge: '[история]' },
        { slug: 'gpt-5-6-instant', title: 'GPT-5.6 Sol', badge: '[история]' },
        { slug: 'gpt-5-5-thinking', title: 'GPT-5.5 Thinking', badge: '[история]' },
        { slug: 'gpt-5-6-thinking', title: 'GPT-5.6 Sol', badge: '[история]' },
        { slug: 'gpt-5-4-mini', title: 'GPT-5.4 Thinking Mini', badge: '[история]' },
        { slug: 'gpt-5-6-t-mini', title: 'GPT-5.6 Luna', badge: '[история]' },
        { slug: 'research', title: 'Deep Research', badge: '[история]' }
    ];

    const experimentalApiModels = [
        { slug: 'gpt-6-astra', title: 'GPT-6 Astra', badge: '[API-only]' },
        { slug: 'gpt-6-sol', title: 'GPT-6 Sol', badge: '[API-only]' },
        { slug: 'gpt-6-luna', title: 'GPT-6 Luna', badge: '[API-only]' },
        { slug: 'gpt-5.6-sol', title: 'GPT-5.6 Sol', badge: '[API-only]' },
        { slug: 'gpt-5.6-terra', title: 'GPT-5.6 Terra', badge: '[API-only]' },
        { slug: 'gpt-5.6-luna', title: 'GPT-5.6 Luna', badge: '[API-only]' },
        { slug: 'gpt-image-2.5-sunburst', title: 'GPT-Image-2.5 Sunburst', badge: '[API-only]' },
        { slug: 'gpt-image-2.5-flare', title: 'GPT-Image-2.5 Flare', badge: '[API-only]' },
        { slug: 'gpt-image-2', title: 'GPT-Image-2', badge: '[API-only]' },
        { slug: 'gpt-live-1', title: 'GPT-Live 1', badge: '[API-only]' },
        { slug: 'gpt-realtime-2.1', title: 'GPT-Realtime-2.1', badge: '[API-only]' },
        { slug: 'gpt-realtime-2.1-mini', title: 'GPT-Realtime-2.1 Mini', badge: '[API-only]' },
        { slug: 'gpt-realtime-2', title: 'GPT-Realtime-2', badge: '[API-only]' },
        { slug: 'gpt-realtime-translate', title: 'GPT-Realtime-Translate', badge: '[API-only]' },
        { slug: 'gpt-live-transcribe', title: 'GPT-Live-Transcribe', badge: '[API-only]' },
        { slug: 'gpt-realtime-whisper', title: 'GPT-Realtime-Whisper', badge: '[API-only]' },
        { slug: 'gpt-realtime-1.5', title: 'GPT-Realtime-1.5', badge: '[API-only]' },
        { slug: 'gpt-audio-1.5', title: 'GPT-Audio-1.5', badge: '[API-only]' },
        { slug: 'gpt-transcribe', title: 'GPT-Transcribe', badge: '[API-only]' },
        { slug: 'gpt-4o-transcribe', title: 'GPT-4o Transcribe', badge: '[API-only]' },
        { slug: 'gpt-4o-mini-transcribe', title: 'GPT-4o Mini Transcribe', badge: '[API-only]' },
        { slug: 'gpt-4o-transcribe-diarize', title: 'GPT-4o Transcribe Diarize', badge: '[API-only]' },
        { slug: 'tts-1', title: 'TTS-1', badge: '[API-only]' },
        { slug: 'tts-1-hd', title: 'TTS-1 HD', badge: '[API-only]' },
        { slug: 'whisper-1', title: 'Whisper', badge: '[API-only]' },
        { slug: 'gpt-4o-mini-tts', title: 'GPT-4o Mini TTS', badge: '[API-only]' },
        { slug: 'gpt-5.6-cyber', title: 'GPT-5.6 Cyber', badge: '[API-only]' },
        { slug: 'daybreak-red', title: 'Daybreak Red', badge: '[API-only]' },
        { slug: 'daybreak-blue', title: 'Daybreak Blue', badge: '[API-only]' },
        { slug: 'gpt-rosalind', title: 'GPT-Rosalind', badge: '[API-only]' },
        { slug: 'gpt-oss-120b', title: 'gpt-oss-120b', badge: '[API-only]' },
        { slug: 'gpt-oss-20b', title: 'gpt-oss-20b', badge: '[API-only]' },
        { slug: 'text-embedding-3-large', title: 'text-embedding-3-large', badge: '[API-only]' },
        { slug: 'text-embedding-3-small', title: 'text-embedding-3-small', badge: '[API-only]' },
        { slug: 'text-embedding-ada-002', title: 'text-embedding-ada-002', badge: '[API-only]' },
        { slug: 'gpt-5.5', title: 'GPT-5.5', badge: '[API-only]' },
        { slug: 'gpt-5.5-pro', title: 'GPT-5.5 Pro', badge: '[API-only]' },
        { slug: 'gpt-5.4', title: 'GPT-5.4', badge: '[API-only]' },
        { slug: 'gpt-5.4-pro', title: 'GPT-5.4 Pro', badge: '[API-only]' },
        { slug: 'gpt-5.4-mini', title: 'GPT-5.4 Mini', badge: '[API-only]' },
        { slug: 'gpt-5.4-nano', title: 'GPT-5.4 nano', badge: '[API-only]' },
        { slug: 'gpt-5.3-codex', title: 'GPT-5.3-Codex', badge: '[API-only]' },
        { slug: 'gpt-5.2', title: 'GPT-5.2', badge: '[API-only]' },
        { slug: 'gpt-5.2-pro', title: 'GPT-5.2 Pro', badge: '[API-only]' },
        { slug: 'gpt-5.1', title: 'GPT-5.1', badge: '[API-only]' },
        { slug: 'gpt-5', title: 'GPT-5', badge: '[API-only]' },
        { slug: 'gpt-5-mini', title: 'GPT-5 Mini', badge: '[API-only]' },
        { slug: 'gpt-5-nano', title: 'GPT-5 nano', badge: '[API-only]' },
        { slug: 'gpt-5-pro', title: 'GPT-5 Pro', badge: '[API-only]' },
        { slug: 'o3-pro', title: 'o3-pro', badge: '[API-only]' },
        { slug: 'o3', title: 'o3', badge: '[API-only]' },
        { slug: 'gpt-4.1', title: 'GPT-4.1', badge: '[API-only]' },
        { slug: 'gpt-4.1-mini', title: 'GPT-4.1 Mini', badge: '[API-only]' },
        { slug: 'omni-moderation-latest', title: 'omni-moderation', badge: '[API-only]' },
        { slug: 'gpt-4o-mini', title: 'GPT-4o Mini', badge: '[API-only]' },
        { slug: 'gpt-4o', title: 'GPT-4o', badge: '[API-only]' },
        { slug: 'gpt-realtime', title: 'GPT-Realtime', badge: '[API-only]' },
        { slug: 'gpt-audio', title: 'GPT-Audio', badge: '[API-only]' },
        { slug: 'gpt-5.3-chat-latest', title: 'GPT-5.3 Chat', badge: '[API-only]' },
        { slug: 'gpt-5.2-chat-latest', title: 'GPT-5.2 Chat', badge: '[API-only]' },
        { slug: 'gpt-5.2-codex', title: 'GPT-5.2-Codex', badge: '[API-only]' },
        { slug: 'sora-2', title: 'Sora 2', badge: '[API-only]' },
        { slug: 'sora-2-pro', title: 'Sora 2 Pro', badge: '[API-only]' },
        { slug: 'gpt-image-1.5', title: 'GPT-Image-1.5', badge: '[API-only]' },
        { slug: 'chatgpt-image-latest', title: 'chatgpt-image-latest', badge: '[API-only]' },
        { slug: 'gpt-image-1-mini', title: 'GPT-Image-1 Mini', badge: '[API-only]' },
        { slug: 'gpt-image-1', title: 'GPT-Image-1', badge: '[API-only]' },
        { slug: 'o3-deep-research', title: 'o3-deep-research', badge: '[API-only]' },
        { slug: 'o4-mini-deep-research', title: 'o4-mini-deep-research', badge: '[API-only]' },
        { slug: 'gpt-4.1-nano', title: 'GPT-4.1 nano', badge: '[API-only]' },
        { slug: 'o4-mini', title: 'o4-mini', badge: '[API-only]' },
        { slug: 'o1-pro', title: 'o1-pro', badge: '[API-only]' },
        { slug: 'computer-use-preview', title: 'computer-use-preview', badge: '[API-only]' },
        { slug: 'gpt-realtime-mini', title: 'GPT-Realtime Mini', badge: '[API-only]' },
        { slug: 'gpt-audio-mini', title: 'GPT-Audio Mini', badge: '[API-only]' },
        { slug: 'gpt-4o-mini-search-preview', title: 'GPT-4o Mini Search Preview', badge: '[API-only]' },
        { slug: 'gpt-4o-search-preview', title: 'GPT-4o Search Preview', badge: '[API-only]' },
        { slug: 'gpt-4.5-preview', title: 'GPT-4.5 Preview', badge: '[API-only]' },
        { slug: 'o3-mini', title: 'o3-mini', badge: '[API-only]' },
        { slug: 'o1', title: 'o1', badge: '[API-only]' },
        { slug: 'o1-mini', title: 'o1-mini', badge: '[API-only]' },
        { slug: 'o1-preview', title: 'o1 Preview', badge: '[API-only]' },
        { slug: 'gpt-4o-audio-preview', title: 'GPT-4o Audio', badge: '[API-only]' },
        { slug: 'gpt-4o-mini-audio-preview', title: 'GPT-4o Mini Audio', badge: '[API-only]' },
        { slug: 'gpt-4o-mini-realtime-preview', title: 'GPT-4o Mini Realtime', badge: '[API-only]' },
        { slug: 'gpt-4o-realtime-preview', title: 'GPT-4o Realtime', badge: '[API-only]' },
        { slug: 'gpt-4-turbo', title: 'GPT-4 Turbo', badge: '[API-only]' },
        { slug: 'babbage-002', title: 'babbage-002', badge: '[API-only]' },
        { slug: 'chatgpt-4o-latest', title: 'ChatGPT-4o', badge: '[API-only]' },
        { slug: 'gpt-5.1-codex', title: 'GPT-5.1-Codex', badge: '[API-only]' },
        { slug: 'gpt-5.1-codex-max', title: 'GPT-5.1-Codex-Max', badge: '[API-only]' },
        { slug: 'gpt-5.1-codex-mini', title: 'GPT-5.1-Codex Mini', badge: '[API-only]' },
        { slug: 'gpt-5-codex', title: 'GPT-5-Codex', badge: '[API-only]' },
        { slug: 'codex-mini-latest', title: 'codex-mini-latest', badge: '[API-only]' },
        { slug: 'davinci-002', title: 'davinci-002', badge: '[API-only]' },
        { slug: 'gpt-3.5-turbo', title: 'GPT-3.5 Turbo', badge: '[API-only]' },
        { slug: 'gpt-4', title: 'GPT-4', badge: '[API-only]' },
        { slug: 'gpt-4-turbo-preview', title: 'GPT-4 Turbo Preview', badge: '[API-only]' },
        { slug: 'gpt-5.1-chat-latest', title: 'GPT-5.1 Chat', badge: '[API-only]' },
        { slug: 'gpt-5-chat-latest', title: 'GPT-5 Chat', badge: '[API-only]' },
        { slug: 'text-moderation-latest', title: 'text-moderation', badge: '[API-only]' },
        { slug: 'text-moderation-stable', title: 'text-moderation-stable', badge: '[API-only]' }
    ];
    /** Класс кнопки отправки, с которой снята клиентская блокировка. */
    const UNLOCKED_SEND_CLASS = 'gpt-model-picker-unlocked-send';

    const state = {
        baseFetch: window.fetch,
        downstreamFetch: window.fetch,
        originalFetchDescriptor: Object.getOwnPropertyDescriptor(window, 'fetch'),
        fetchGuardInstalled: false,
        downstreamReplacementCount: 0,
        downstreamCallDepth: 0,
        selectedModelSlug: '',
        selectedThinkingEffort: 'auto',
        bypassEnabled: false,
        fastModeEnabled: false,
        forceChatEnabled: true,
        backendOverrides: createDefaultBackendSignalOverrides(),
        backendOverrideControls: null,
        backendOverridesButton: null,
        backendOverridesWindow: null,
        backendOverridesHeader: null,
        backendOverridesStatus: null,
        workModels: [],
        chatModels: [],
        workDefaultModelSlug: '',
        panel: null,
        header: null,
        collapseButton: null,
        select: null,
        input: null,
        thinkingSelect: null,
        bypassCheckbox: null,
        fastCheckbox: null,
        forceChatCheckbox: null,
        hookStatus: null,
        catalogStatus: null,
        selectedStatus: null,
        requestStatus: null,
        backendStatus: null,
        hookTimer: null,
        resizeObserver: null,
        navigationMenuObserver: null,
        navigationContextMenuHandler: null,
        navigationContextHref: '',
        navigationContextHrefTimer: null,
        dragState: null,
        backendSignalsDragState: null,
        collapsed: false,
        lastRequestedModelSlug: '',
        lastResolvedModelSlug: '',
        unlockStatus: null,
        limitDiagnostics: [],
        unlockObserver: null,
        unlockSweepTimer: null,
        unlockClickHandler: null,
        unlockClearCount: 0,
        unlockBackendCount: 0,
        unlockResubmitInFlight: false,
        lastConversationRequestAt: 0,
        originalSetAttribute: null,
        originalButtonDisabledDescriptor: null,
        stopped: false
    };

    /**
     * Выводит диагностическое сообщение с префиксом скрипта.
     *
     * @param {...any} args
     */
    function log(...args) {
        if (config.debug) {
            console.debug('[GPT MODEL PICKER]', ...args);
        }
    }

    /**
     * Возвращает путь запроса без origin и query-параметров.
     *
     * @param {RequestInfo | URL} input
     * @returns {string}
     */
    function getRequestPath(input) {
        const rawUrl = input instanceof Request ? input.url : String(input);

        return new URL(rawUrl, window.location.origin).pathname;
    }

    /**
     * Вызывает текущую штатную обёртку fetch и ограничивает защиту от рекурсии
     * только синхронным вызовом нижнего слоя. Параллельные fetch-запросы не
     * отключают перехват друг для друга на время ожидания Promise.
     *
     * @param {RequestInfo | URL} input
     * @param {RequestInit | undefined} init
     * @returns {Promise<Response>}
     */
    function callDownstreamFetch(input, init) {
        if (state.downstreamCallDepth > 0) {
            return state.baseFetch.call(window, input, init);
        }

        state.downstreamCallDepth += 1;

        try {
            return state.downstreamFetch.call(window, input, init);
        } finally {
            state.downstreamCallDepth -= 1;
        }
    }

    /**
     * Возвращает JSON-тело запроса и функцию создания запроса с новым телом.
     *
     * @param {RequestInfo | URL} input
     * @param {RequestInit | undefined} init
     * @returns {Promise<{ body: string, rebuild: (body: string) => Request | [RequestInfo | URL, RequestInit] } | null>}
     */
    async function readRequestBody(input, init) {
        if (init && typeof init.body === 'string') {
            return {
                body: init.body,
                rebuild(body) {
                    return [input, { ...init, body }];
                }
            };
        }

        if (input instanceof Request) {
            return {
                body: await input.clone().text(),
                rebuild(body) {
                    return new Request(input, { body });
                }
            };
        }

        return null;
    }

    /**
     * Изменяет модель, глубину рассуждения, скорость и режим разговора в JSON payload.
     *
     * Включённый Bypass возвращает исходное тело запроса без изменений. Значение
     * thinking effort Auto сохраняет штатный thinking_effort. Включённая скорость
     * задаёт service_tier=priority, выключенная сохраняет штатный tier. При включённом
     * Chat Mode и ручном выборе модели обычный primary_assistant ход остаётся
     * Chat: задаётся primary_assistant, явно передаётся conversation_origin=null
     * и исключается Work execution target. Метаданные нового user-сообщения
     * также не передают conversation_execution_target. Выключенный Chat Mode
     * оставляет режим разговора штатным. Gizmo-режимы не преобразуются.
     *
     * @param {string} body
     * @returns {{ body: string, changed: boolean, originalModelSlug: string, requestedModelSlug: string, originalThinkingEffort: string, requestedThinkingEffort: string, originalServiceTier: string, requestedServiceTier: string, originalConversationOrigin: string, originalConversationMode: string, requestedConversationMode: string } | null}
     */
    /** Returns true when two JSON-compatible values are equivalent. */
    function areBackendSignalValuesEqual(firstValue, secondValue) {
        return JSON.stringify(firstValue) === JSON.stringify(secondValue);
    }

    /** Builds default backend signal override settings for every editable signal row. */
    function createDefaultBackendSignalOverrides() {
        const defaults = {};

        for (const signal of backendSignalOptions) {
            defaults[signal.key] = {
                mode: 'preserve',
                customValue: signal.customValue || 'null'
            };
        }

        return defaults;
    }

    /** Normalizes one stored backend signal override row. */
    function normalizeBackendSignalOverride(signal, value) {
        const defaultOverride = {
            mode: 'preserve',
            customValue: signal.customValue || 'null'
        };
        const storedMode = typeof value?.mode === 'string' ? value.mode : defaultOverride.mode;
        const mode = backendSignalOverrideModes.some((option) => option.value === storedMode)
            ? storedMode
            : defaultOverride.mode;
        const customValue = typeof value?.customValue === 'string'
            ? value.customValue
            : defaultOverride.customValue;

        return { mode, customValue };
    }

    /** Loads backend signal overrides from localStorage. */
    function loadBackendSignalOverrides() {
        const defaults = createDefaultBackendSignalOverrides();
        const storedValue = localStorage.getItem(config.backendOverridesStorageKey);

        if (!storedValue) {
            return defaults;
        }

        try {
            const parsed = JSON.parse(storedValue);

            for (const signal of backendSignalOptions) {
                defaults[signal.key] = normalizeBackendSignalOverride(signal, parsed?.[signal.key]);
            }
        } catch (error) {
            log('stored backend signal overrides are invalid', error);
        }

        return defaults;
    }

    /** Saves backend signal override settings to localStorage. */
    function saveBackendSignalOverrides() {
        localStorage.setItem(config.backendOverridesStorageKey, JSON.stringify(state.backendOverrides));
    }

    /** Resolves a preset or custom backend signal action into a payload operation. */
    function resolveBackendSignalOverrideAction(signal, override) {
        if (!override || override.mode === 'preserve') {
            return { action: 'preserve' };
        }

        if (override.mode === 'delete') {
            return { action: 'delete' };
        }

        const presetAction = signal[`${override.mode}Action`];
        const valueText = override.mode === 'custom'
            ? override.customValue
            : signal[`${override.mode}Value`];

        if (presetAction === 'delete') {
            return { action: 'delete' };
        }

        if (typeof valueText !== 'string') {
            return { action: 'preserve' };
        }

        try {
            return {
                action: 'set',
                value: JSON.parse(valueText)
            };
        } catch (error) {
            return {
                action: 'error',
                message: `${signal.label}: invalid JSON`
            };
        }
    }

    /** Applies one top-level payload backend signal override. */
    function applyPayloadSignalOverride(payload, signal, action) {
        const property = signal.property || signal.key;

        if (action.action === 'delete') {
            if (Object.prototype.hasOwnProperty.call(payload, property)) {
                delete payload[property];
                return true;
            }

            return false;
        }

        if (action.action !== 'set') {
            return false;
        }

        if (!areBackendSignalValuesEqual(payload[property], action.value)) {
            payload[property] = action.value;
            return true;
        }

        return false;
    }

    /** Applies conversation_mode.kind without replacing other conversation_mode fields. */
    function applyConversationModeKindOverride(payload, action) {
        if (action.action === 'delete') {
            if (
                payload.conversation_mode
                && typeof payload.conversation_mode === 'object'
                && Object.prototype.hasOwnProperty.call(payload.conversation_mode, 'kind')
            ) {
                delete payload.conversation_mode.kind;
                return true;
            }

            return false;
        }

        if (action.action !== 'set') {
            return false;
        }

        if (!payload.conversation_mode || typeof payload.conversation_mode !== 'object' || Array.isArray(payload.conversation_mode)) {
            payload.conversation_mode = {};
        }

        if (!areBackendSignalValuesEqual(payload.conversation_mode.kind, action.value)) {
            payload.conversation_mode.kind = action.value;
            return true;
        }

        return false;
    }

    /** Applies message metadata backend signal overrides to outgoing user messages. */
    function applyMessageMetadataSignalOverride(payload, signal, action) {
        if (!Array.isArray(payload.messages)) {
            return false;
        }

        const property = signal.property;
        let changed = false;

        for (const message of payload.messages) {
            if (message?.author?.role !== 'user') {
                continue;
            }

            if (action.action === 'delete') {
                if (message.metadata && Object.prototype.hasOwnProperty.call(message.metadata, property)) {
                    delete message.metadata[property];
                    changed = true;
                }

                continue;
            }

            if (action.action !== 'set') {
                continue;
            }

            if (!message.metadata || typeof message.metadata !== 'object' || Array.isArray(message.metadata)) {
                message.metadata = {};
            }

            if (!areBackendSignalValuesEqual(message.metadata[property], action.value)) {
                message.metadata[property] = action.value;
                changed = true;
            }
        }

        return changed;
    }

    /** Applies user-selected backend signal overrides after the built-in model rewrites. */
    function applyBackendSignalOverrides(payload) {
        let changed = false;
        const applied = [];
        const errors = [];

        for (const signal of backendSignalOptions) {
            const override = normalizeBackendSignalOverride(signal, state.backendOverrides[signal.key]);
            const action = resolveBackendSignalOverrideAction(signal, override);

            if (action.action === 'preserve') {
                continue;
            }

            if (action.action === 'error') {
                errors.push(action.message);
                continue;
            }

            let signalChanged = false;

            if (signal.target === 'conversationModeKind') {
                signalChanged = applyConversationModeKindOverride(payload, action);
            } else if (signal.target === 'messageMetadata') {
                signalChanged = applyMessageMetadataSignalOverride(payload, signal, action);
            } else {
                signalChanged = applyPayloadSignalOverride(payload, signal, action);
            }

            changed = signalChanged || changed;
            applied.push(`${signal.label}: ${override.mode}`);
        }

        return { changed, applied, errors };
    }

    function updateConversationBody(body) {
        if (!body) {
            return null;
        }

        let payload;

        try {
            payload = JSON.parse(body);
        } catch {
            return null;
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return null;
        }

        const originalModelSlug = String(
            payload.model || payload.model_slug || payload.requested_model_slug || ''
        );
        const originalThinkingEffort = String(
            payload.thinking_effort || payload.backend_thinking_effort || ''
        );
        const originalServiceTier = String(
            payload.service_tier || payload.backend_service_tier || ''
        );
        const originalConversationOrigin = String(payload.conversation_origin || '');
        const originalConversationMode = String(payload.conversation_mode?.kind || '');

        if (state.bypassEnabled) {
            return {
                body,
                changed: false,
                originalModelSlug,
                requestedModelSlug: originalModelSlug,
                originalThinkingEffort,
                requestedThinkingEffort: originalThinkingEffort,
                originalServiceTier,
                requestedServiceTier: originalServiceTier,
                originalConversationOrigin,
                originalConversationMode,
                requestedConversationMode: originalConversationMode,
                requestedBackendOverrides: [],
                backendOverrideErrors: [],
                bypassEnabled: true
            };
        }

        const overrideModel = Boolean(state.selectedModelSlug);
        const overrideThinkingEffort = state.selectedThinkingEffort !== 'auto';
        const forceChat = state.forceChatEnabled
            && overrideModel
            && (!originalConversationMode || originalConversationMode === 'primary_assistant');
        let changed = false;

        if (overrideModel) {
            if (payload.model !== state.selectedModelSlug) {
                changed = true;
            }

            payload.model = state.selectedModelSlug;

            if (Object.prototype.hasOwnProperty.call(payload, 'model_slug')) {
                if (payload.model_slug !== state.selectedModelSlug) {
                    changed = true;
                }

                payload.model_slug = state.selectedModelSlug;
            }

            if (Object.prototype.hasOwnProperty.call(payload, 'requested_model_slug')) {
                if (payload.requested_model_slug !== state.selectedModelSlug) {
                    changed = true;
                }

                payload.requested_model_slug = state.selectedModelSlug;
            }

            if (Object.prototype.hasOwnProperty.call(payload, 'backend_model')) {
                if (payload.backend_model !== state.selectedModelSlug) {
                    changed = true;
                }

                payload.backend_model = state.selectedModelSlug;
            }
        }

        if (forceChat) {
            if (payload.conversation_mode?.kind !== 'primary_assistant' || Object.keys(payload.conversation_mode || {}).length !== 1) {
                payload.conversation_mode = { kind: 'primary_assistant' };
                changed = true;
            }

            if (!Object.prototype.hasOwnProperty.call(payload, 'conversation_origin') || payload.conversation_origin !== null) {
                payload.conversation_origin = null;
                changed = true;
            }

            if (Object.prototype.hasOwnProperty.call(payload, 'chat_mode') && payload.chat_mode !== 'chat') {
                payload.chat_mode = 'chat';
                changed = true;
            }

            if (Object.prototype.hasOwnProperty.call(payload, 'tpp_work_handoff_conversion')) {
                delete payload.tpp_work_handoff_conversion;
                changed = true;
            }

            if (Object.prototype.hasOwnProperty.call(payload, 'conversation_execution_target')) {
                delete payload.conversation_execution_target;
                changed = true;
            }

            if (Array.isArray(payload.messages)) {
                for (const message of payload.messages) {
                    if (
                        message?.author?.role === 'user'
                        && message.metadata
                        && Object.prototype.hasOwnProperty.call(message.metadata, 'conversation_execution_target')
                    ) {
                        delete message.metadata.conversation_execution_target;
                        changed = true;
                    }
                }
            }
        }

        if (overrideThinkingEffort) {
            if (payload.thinking_effort !== state.selectedThinkingEffort) {
                changed = true;
            }

            payload.thinking_effort = state.selectedThinkingEffort;

            if (Object.prototype.hasOwnProperty.call(payload, 'backend_thinking_effort')) {
                if (payload.backend_thinking_effort !== state.selectedThinkingEffort) {
                    changed = true;
                }

                payload.backend_thinking_effort = state.selectedThinkingEffort;
            }
        }

        if (state.fastModeEnabled) {
            if (payload.service_tier !== 'priority') {
                changed = true;
            }

            payload.service_tier = 'priority';

            if (Object.prototype.hasOwnProperty.call(payload, 'backend_service_tier')) {
                if (payload.backend_service_tier !== 'priority') {
                    changed = true;
                }

                payload.backend_service_tier = 'priority';
            }
        }

        const backendOverrideInfo = applyBackendSignalOverrides(payload);

        changed = backendOverrideInfo.changed || changed;

        return {
            body: changed ? JSON.stringify(payload) : body,
            changed,
            originalModelSlug,
            requestedModelSlug: overrideModel ? state.selectedModelSlug : originalModelSlug,
            originalThinkingEffort,
            requestedThinkingEffort: overrideThinkingEffort ? state.selectedThinkingEffort : originalThinkingEffort,
            originalServiceTier,
            requestedServiceTier: state.fastModeEnabled ? 'priority' : originalServiceTier,
            originalConversationOrigin,
            originalConversationMode,
            requestedConversationMode: forceChat ? 'chat' : originalConversationMode,
            requestedBackendOverrides: backendOverrideInfo.applied,
            backendOverrideErrors: backendOverrideInfo.errors,
            bypassEnabled: false
        };
    }

    /**
     * Добавляет непустое строковое значение в массив без повторений.
     *
     * @param {string[]} target
     * @param {unknown} value
     */
    function appendUniqueString(target, value) {
        if (typeof value === 'string' && value && !target.includes(value)) {
            target.push(value);
        }
    }

    /**
     * Собирает сведения о модели, thinking effort и service tier из JSON-объекта ответа.
     *
     * @param {unknown} value
     * @param {{ resolvedModels: string[], assistantModels: string[], allModels: string[], thinkingEfforts: string[], serviceTiers: string[] }} result
     */
    function collectResponseInfo(value, result) {
        if (!value || typeof value !== 'object') {
            return;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                collectResponseInfo(item, result);
            }

            return;
        }

        appendUniqueString(result.resolvedModels, value.resolved_model_slug);
        appendUniqueString(result.allModels, value.model_slug);
        appendUniqueString(result.thinkingEfforts, value.thinking_effort);
        appendUniqueString(result.thinkingEfforts, value.backend_thinking_effort);
        appendUniqueString(result.serviceTiers, value.service_tier);
        appendUniqueString(result.serviceTiers, value.backend_service_tier);

        if (value.author?.role === 'assistant' && value.metadata) {
            appendUniqueString(result.resolvedModels, value.metadata.resolved_model_slug);
            appendUniqueString(result.assistantModels, value.metadata.model_slug);
            appendUniqueString(result.thinkingEfforts, value.metadata.thinking_effort);
            appendUniqueString(result.serviceTiers, value.metadata.service_tier);
        }

        for (const nestedValue of Object.values(value)) {
            collectResponseInfo(nestedValue, result);
        }
    }

    /**
     * Возвращает сведения, раскрытые backend-событиями потокового ответа.
     *
     * @param {string} responseText
     * @returns {{ modelSlug: string, thinkingEffort: string, serviceTier: string }}
     */
    function extractResponseInfo(responseText) {
        const result = {
            resolvedModels: [],
            assistantModels: [],
            allModels: [],
            thinkingEfforts: [],
            serviceTiers: []
        };

        for (const line of responseText.split(/\r?\n/)) {
            const trimmedLine = line.trim();

            if (!trimmedLine || trimmedLine === 'data: [DONE]') {
                continue;
            }

            const jsonText = trimmedLine.startsWith('data:')
                ? trimmedLine.slice(5).trim()
                : trimmedLine;

            if (!jsonText.startsWith('{') && !jsonText.startsWith('[')) {
                continue;
            }

            try {
                collectResponseInfo(JSON.parse(jsonText), result);
            } catch {
                continue;
            }
        }

        return {
            modelSlug: result.resolvedModels.at(-1) || result.assistantModels.at(-1) || result.allModels.at(-1) || '',
            thinkingEffort: result.thinkingEfforts.at(-1) || '',
            serviceTier: result.serviceTiers.at(-1) || ''
        };
    }

    /**
     * Возвращает компактное отображение service tier для диагностических строк.
     *
     * @param {string} serviceTier
     * @param {boolean} priorityEnabled
     * @returns {string}
     */
    function formatPriorityStatus(serviceTier, priorityEnabled) {
        if (priorityEnabled || serviceTier === 'priority') {
            return '1.5x';
        }

        return serviceTier || 'штатная';
    }

    /**
     * Отображает параметры, раскрытые backend-событиями ответа.
     *
     * @param {{ requestedModelSlug: string, requestedThinkingEffort: string, requestedServiceTier: string, verifyDirectWorkChat?: boolean }} requestInfo
     * @param {{ modelSlug: string, thinkingEffort: string, serviceTier: string }} responseInfo
     */
    function displayBackendInfo(requestInfo, responseInfo) {
        if (responseInfo.modelSlug) {
            state.lastResolvedModelSlug = responseInfo.modelSlug;
        }

        const lines = ['Backend:'];
        let type = 'success';

        if (responseInfo.modelSlug) {
            if (requestInfo.requestedModelSlug && responseInfo.modelSlug !== requestInfo.requestedModelSlug) {
                lines.push(`Model: ${requestInfo.requestedModelSlug} → ${responseInfo.modelSlug}`);
                type = 'warning';
            } else {
                lines.push(`Model: ${responseInfo.modelSlug}`);
            }
        }

        if (responseInfo.thinkingEffort) {
            lines.push(`Thinking: ${responseInfo.thinkingEffort}`);
        }

        if (responseInfo.serviceTier) {
            lines.push(`Priority: ${formatPriorityStatus(responseInfo.serviceTier, false)}`);
        }

        updateBackendStatus(
            lines.length > 1
                ? lines.join('\n')
                : 'Backend:\nHTTP 200\nПараметры потоком не раскрыты',
            type
        );
    }

    /**
     * Читает копию потокового ответа и отображает параметры, раскрытые backend.
     *
     * @param {Response} response
     * @param {{ requestedModelSlug: string, requestedThinkingEffort: string, requestedServiceTier: string }} requestInfo
     */
    async function observeConversationResponse(response, requestInfo) {
        if (!response.ok) {
            updateBackendStatus(`Backend:
HTTP ${response.status}
Model: ${requestInfo.requestedModelSlug || 'штатная'}`, 'error');
            return;
        }

        const responseBody = response.clone().body;

        if (!responseBody) {
            updateBackendStatus(`Backend:
HTTP ${response.status}
Поток данных отсутствует`, 'success');
            return;
        }

        const reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let responseInfo = {
            modelSlug: '',
            thinkingEffort: '',
            serviceTier: ''
        };

        try {
            while (true) {
                const { value, done } = await reader.read();
                buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

                const lines = buffer.split(/\r?\n/);
                buffer = done ? '' : lines.pop() || '';
                const currentInfo = extractResponseInfo(lines.join('\n'));

                responseInfo = {
                    modelSlug: currentInfo.modelSlug || responseInfo.modelSlug,
                    thinkingEffort: currentInfo.thinkingEffort || responseInfo.thinkingEffort,
                    serviceTier: currentInfo.serviceTier || responseInfo.serviceTier
                };

                if (currentInfo.modelSlug || currentInfo.thinkingEffort || currentInfo.serviceTier) {
                    displayBackendInfo(requestInfo, responseInfo);
                }

                if (done) {
                    break;
                }
            }

            if (buffer) {
                const tailInfo = extractResponseInfo(buffer);
                responseInfo = {
                    modelSlug: tailInfo.modelSlug || responseInfo.modelSlug,
                    thinkingEffort: tailInfo.thinkingEffort || responseInfo.thinkingEffort,
                    serviceTier: tailInfo.serviceTier || responseInfo.serviceTier
                };
            }

            displayBackendInfo(requestInfo, responseInfo);
        } catch (error) {
            if (responseInfo.modelSlug || responseInfo.thinkingEffort || responseInfo.serviceTier) {
                displayBackendInfo(requestInfo, responseInfo);
                log('response stream closed after backend data detection', error);
            } else if (error?.name === 'AbortError' || /aborted/i.test(String(error?.message || ''))) {
                updateBackendStatus('Backend:\nHTTP 200\nПоток закрыт ChatGPT, параметры не раскрыты', 'success');
                log('response stream aborted before backend data detection', error);
            } else {
                updateBackendStatus(`Backend:
Ошибка чтения ответа: ${error.message}`, 'error');
                log('response inspection failed', error);
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Формирует многострочное описание параметров, применённых к исходящему запросу.
     *
     * @param {{ originalModelSlug: string, requestedModelSlug: string, requestedThinkingEffort: string, requestedServiceTier: string, originalConversationOrigin: string, originalConversationMode: string, requestedConversationMode: string }} requestInfo
     * @returns {string}
     */
    function formatRequestStatus(requestInfo) {
        if (requestInfo.bypassEnabled) {
            return [
                'Запрос:',
                'Bypass: включён',
                `Model: ${requestInfo.originalModelSlug || 'штатная'}`,
                `Thinking: ${requestInfo.originalThinkingEffort || 'штатное'}`,
                `Priority: ${requestInfo.originalServiceTier || 'штатная'}`,
                `Mode: штатный${requestInfo.originalConversationMode ? ` (${requestInfo.originalConversationMode})` : ''}`,
                'Signals: bypass'
            ].join('\n');
        }

        const modelText = requestInfo.originalModelSlug && requestInfo.originalModelSlug !== requestInfo.requestedModelSlug
            ? `${requestInfo.originalModelSlug} → ${requestInfo.requestedModelSlug}`
            : requestInfo.requestedModelSlug;
        const thinkingText = state.selectedThinkingEffort === 'auto'
            ? `Auto${requestInfo.requestedThinkingEffort ? ` (${requestInfo.requestedThinkingEffort})` : ''}`
            : requestInfo.requestedThinkingEffort || state.selectedThinkingEffort;
        const priorityText = formatPriorityStatus(requestInfo.requestedServiceTier, state.fastModeEnabled);
        const modeText = requestInfo.requestedConversationMode === 'chat'
            ? `Chat Mode${requestInfo.originalConversationOrigin ? `; origin ${requestInfo.originalConversationOrigin} → Chat` : ''}`
            : `Mode: штатный${requestInfo.originalConversationMode ? ` (${requestInfo.originalConversationMode})` : ''}`;

        const signalText = requestInfo.backendOverrideErrors?.length
            ? `Signals: ${requestInfo.backendOverrideErrors.join('; ')}`
            : requestInfo.requestedBackendOverrides?.length
                ? `Signals: ${requestInfo.requestedBackendOverrides.join('; ')}`
                : 'Signals: preserve';

        return [
            'Запрос:',
            `Model: ${modelText || 'штатная'}`,
            `Thinking: ${thinkingText || 'штатное'}`,
            `Priority: ${priorityText}`,
            modeText,
            signalText
        ].join('\n');
    }

    /**
     * Перехватывает запрос создания хода, применяет выбранные параметры и наблюдает ответ.
     *
     * @param {RequestInfo | URL} input
     * @param {RequestInit | undefined} init
     * @returns {Promise<Response>}
     */
    async function fetchWithSelectedModel(input, init) {
        if (state.downstreamCallDepth > 0) {
            return state.baseFetch.call(window, input, init);
        }

        if (state.stopped) {
            return callDownstreamFetch(input, init);
        }

        const requestPath = getRequestPath(input);

        if (state.bypassEnabled) {
            if (requestPath === config.conversationPath) {
                state.lastConversationRequestAt = Date.now();
                updateRequestStatus('Запрос:\nBypass включён, payload не изменяется', 'warning');
                updateBackendStatus('', 'success');
            }

            return callDownstreamFetch(input, init);
        }

        if (requestPath !== config.conversationPath) {
            return rewriteLimitedResponse(await callDownstreamFetch(input, init), requestPath);
        }

        state.lastConversationRequestAt = Date.now();

        const requestBody = await readRequestBody(input, init);
        const requestInfo = requestBody && updateConversationBody(requestBody.body);

        if (!requestBody || !requestInfo) {
            updateRequestStatus('Запрос:\nJSON payload не прочитан', 'error');
            return callDownstreamFetch(input, init);
        }

        const rebuilt = requestInfo.changed
            ? requestBody.rebuild(requestInfo.body)
            : null;

        state.lastRequestedModelSlug = requestInfo.requestedModelSlug;
        state.lastResolvedModelSlug = '';
        updateRequestStatus(formatRequestStatus(requestInfo), 'success');
        updateBackendStatus('Backend:\nОжидание ответа…', 'neutral');
        log('conversation request parameters', requestInfo);

        const response = rebuilt
            ? Array.isArray(rebuilt)
                ? await callDownstreamFetch(rebuilt[0], rebuilt[1])
                : await callDownstreamFetch(rebuilt)
            : await callDownstreamFetch(input, init);

        observeConversationResponse(response, requestInfo);

        return response;
    }

    /**
     * Создает DOM-элемент с атрибутами и текстом.
     *
     * @param {string} tagName
     * @param {Record<string, string>} attributes
     * @param {string} [text]
     * @returns {HTMLElement}
     */
    function createElement(tagName, attributes, text) {
        const element = document.createElement(tagName);

        for (const [name, value] of Object.entries(attributes)) {
            element.setAttribute(name, value);
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    /**
     * Записывает текст, визуальный тип строки состояния и скрывает пустую строку.
     *
     * @param {HTMLElement | null} element
     * @param {string} message
     * @param {'neutral' | 'success' | 'warning' | 'error'} type
     */
    function setStatus(element, message, type) {
        if (element) {
            element.textContent = message;
            element.dataset.statusType = type;
            element.hidden = !message;
        }
    }

    /**
     * Определяет, раскрывает ли ответ backend данные о лимитах Work и Codex.
     *
     * @param {string} path
     * @returns {boolean}
     */
    function isRateLimitResponsePath(path) {
        return path === config.usagePath
            || path === config.usageStreamPath
            || path === config.conversationInitPath
            || path === config.conversationPreparePath;
    }

    /**
     * Определяет backend-флаг, которым ChatGPT блокирует отправку хода.
     *
     * Исчерпанный лимит Work приходит в conversation/init как blocked_features и
     * banner_info со значением вида tpp_send. Остальные блокировки и баннеры
     * сохраняются без изменений.
     *
     * @param {any} name
     * @returns {boolean}
     */
    function isSendBlockingFeature(name) {
        const value = String(name || '').trim().toLowerCase();

        if (!value) {
            return false;
        }

        return value.endsWith('_send')
            || value.startsWith('tpp_')
            || value.startsWith('codex_');
    }

    /**
     * Переводит объекты лимитов в разрешающее состояние.
     *
     * Меняются только поля, по которым ChatGPT определяет исчерпание лимита:
     * allowed, limit_reached, used_percent окна, rate_limit_upsell,
     * rate_limit_reached_type и overage_limit_reached. Остальные данные ответа
     * сохраняются без изменений, поэтому каталоги, разговоры и платежные
     * сведения приходят в приложение ровно такими, какими их вернул backend.
     *
     * @param {any} value
     * @returns {boolean} true, если значение было изменено
     */
    function neutralizeRateLimits(value) {
        if (state.bypassEnabled || !value || typeof value !== 'object') {
            return false;
        }

        if (Array.isArray(value)) {
            let arrayChanged = false;

            for (const item of value) {
                arrayChanged = neutralizeRateLimits(item) || arrayChanged;
            }

            return arrayChanged;
        }

        const hasOwn = key => Object.prototype.hasOwnProperty.call(value, key);
        const windowKeys = ['primary_window', 'secondary_window'];
        const looksLikeRateLimit = hasOwn('limit_reached')
            || (hasOwn('allowed') && (hasOwn('primary_window') || hasOwn('secondary_window') || hasOwn('limit_window_seconds')));
        let changed = false;

        if (looksLikeRateLimit) {
            if (value.allowed === false) {
                value.allowed = true;
                changed = true;
            }

            if (value.limit_reached === true) {
                value.limit_reached = false;
                changed = true;
            }
        }

        for (const windowKey of windowKeys) {
            const window = value[windowKey];

            if (
                window
                && typeof window === 'object'
                && !Array.isArray(window)
                && typeof window.used_percent === 'number'
                && window.used_percent >= 100
            ) {
                window.used_percent = 0;
                changed = true;
            }
        }

        if (hasOwn('rate_limit_upsell') && value.rate_limit_upsell !== null) {
            value.rate_limit_upsell = null;
            changed = true;
        }

        if (hasOwn('rate_limit_reached_type') && value.rate_limit_reached_type !== null) {
            value.rate_limit_reached_type = null;
            changed = true;
        }

        if (hasOwn('overage_limit_reached') && value.overage_limit_reached === true) {
            value.overage_limit_reached = false;
            changed = true;
        }

        if (Array.isArray(value.blocked_features)) {
            const allowedFeatures = value.blocked_features.filter(feature => !isSendBlockingFeature(feature?.name));

            if (allowedFeatures.length !== value.blocked_features.length) {
                value.blocked_features = allowedFeatures;
                changed = true;
            }
        }

        if (value.banner_info && typeof value.banner_info === 'object' && isSendBlockingFeature(value.banner_info.name)) {
            value.banner_info = null;
            changed = true;
        }

        for (const key of Object.keys(value)) {
            if (windowKeys.includes(key)) {
                continue;
            }

            changed = neutralizeRateLimits(value[key]) || changed;
        }

        return changed;
    }

    /**
     * Создаёт заголовки ответа без длины и сжатия, которые нельзя сохранить
     * после изменения тела ответа.
     *
     * @param {Response} response
     * @returns {Headers}
     */
    function buildRewrittenHeaders(response) {
        const headers = new Headers(response.headers);

        headers.delete('content-length');
        headers.delete('content-encoding');

        return headers;
    }

    /**
     * Разбирает одно событие SSE и при необходимости нейтрализует лимиты.
     *
     * Событие берётся целиком: несколько строк data: склеиваются переводом
     * строки так же, как это делает EventSource. Поэтому JSON восстанавливается
     * независимо от того, разбит ли он сервером на несколько строк.
     *
     * @param {string} block
     * @returns {string}
     */
    function neutralizeRateLimitStreamBlock(block) {
        const lines = block.split('\n');
        const dataIndexes = [];
        const dataParts = [];

        lines.forEach((line, index) => {
            if (/^data\s*:/.test(line)) {
                dataIndexes.push(index);
                dataParts.push(line.slice(line.indexOf(':') + 1).replace(/^ /, ''));
            }
        });

        if (dataIndexes.length === 0) {
            return block;
        }

        const payloadText = dataParts.join('\n');

        if (!payloadText.trim() || payloadText.trim() === '[DONE]') {
            return block;
        }

        let payload;

        try {
            payload = JSON.parse(payloadText);
        } catch (error) {
            log('rate limit stream event is not JSON', error);

            return block;
        }

        const changed = neutralizeRateLimits(payload);

        recordLimitDiagnostic(changed ? 'sse-rewritten' : 'sse-unchanged');

        if (!changed) {
            return block;
        }

        const firstIndex = dataIndexes[0];
        const firstLine = lines[firstIndex];
        const replacedLine = `${firstLine.slice(0, firstLine.indexOf(':') + 1)} ${JSON.stringify(payload)}`;
        const rebuilt = [];

        for (let index = 0; index < lines.length; index += 1) {
            if (index === firstIndex) {
                rebuilt.push(replacedLine);
            } else if (!dataIndexes.includes(index)) {
                rebuilt.push(lines[index]);
            }
        }

        return rebuilt.join('\n');
    }

    /**
     * Создаёт поток преобразования, снимающий лимиты с событий SSE.
     *
     * @returns {TransformStream | null}
     */
    function createRateLimitStream() {
        if (typeof TransformStream !== 'function') {
            return null;
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';

        return new TransformStream({
            transform(chunk, controller) {
                buffer += decoder.decode(chunk, { stream: true });

                const blocks = buffer.split(/\r?\n\r?\n/);
                buffer = blocks.pop() || '';

                if (blocks.length === 0) {
                    return;
                }

                controller.enqueue(encoder.encode(`${blocks.map(neutralizeRateLimitStreamBlock).join('\n\n')}\n\n`));
            },
            flush(controller) {
                buffer += decoder.decode();

                if (buffer) {
                    controller.enqueue(encoder.encode(neutralizeRateLimitStreamBlock(buffer)));
                }
            }
        });
    }

    /**
     * Возвращает ответ backend без признаков исчерпанного лимита.
     *
     * Ответы других путей, ответы без тела и ответы без JSON или SSE
     * возвращаются без изменений. Тело исходного ответа читается только тогда,
     * когда ответ действительно подлежит преобразованию.
     *
     * @param {Response} response
     * @param {string} path
     * @returns {Promise<Response>}
     */
    async function rewriteLimitedResponse(response, path) {
        if (state.bypassEnabled || !response || !isRateLimitResponsePath(path)) {
            return response;
        }

        if (!response.ok || response.bodyUsed || response.body === null || response.type === 'opaque') {
            return response;
        }

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();

        if (!contentType.includes('event-stream') && !contentType.includes('json')) {
            return response;
        }

        if (contentType.includes('event-stream')) {
            const stream = createRateLimitStream();

            if (!stream) {
                return response;
            }

            try {
                return new Response(response.body.pipeThrough(stream), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: buildRewrittenHeaders(response)
                });
            } catch (error) {
                log('rate limit stream rewrite failed', error);

                return response;
            }
        }

        let text;

        try {
            text = await response.text();
        } catch (error) {
            log('rate limit response read failed', error);

            return response;
        }

        let rewritten = text;

        try {
            const payload = JSON.parse(text);
            const changed = neutralizeRateLimits(payload);

            recordLimitDiagnostic(changed ? 'json-rewritten' : 'json-unchanged', path);

            if (changed) {
                rewritten = JSON.stringify(payload);
                state.unlockBackendCount += 1;
                updateUnlockStatus();
                log('rate limit payload neutralized', path, payload?.rate_limit);
            }
        } catch (error) {
            log('rate limit payload rewrite failed', error);
        }

        return new Response(rewritten, {
            status: response.status,
            statusText: response.statusText,
            headers: buildRewrittenHeaders(response)
        });
    }

    /**
     * Определяет кнопку отправки сообщения в композере ChatGPT.
     *
     * @param {Element | null} element
     * @returns {boolean}
     */
    function isComposerSendButton(element) {
        if (!(element instanceof HTMLButtonElement)) {
            return false;
        }

        if (element.getAttribute('data-testid') === 'send-button') {
            return true;
        }

        const label = String(element.getAttribute('aria-label') || '').trim().toLowerCase();

        return label.startsWith('отправить') || label.startsWith('send');
    }

    /**
     * Снимает с кнопки отправки признаки заблокированного состояния.
     *
     * @param {HTMLButtonElement} button
     * @returns {boolean}
     */
    function unlockComposerSendButton(button) {
        let cleared = false;

        if (button.getAttribute('aria-disabled') === 'true') {
            button.setAttribute('aria-disabled', 'false');
            cleared = true;
        }

        if (button.hasAttribute('disabled')) {
            button.removeAttribute('disabled');
            cleared = true;
        }

        if (button.hasAttribute('data-disabled')) {
            button.removeAttribute('data-disabled');
            cleared = true;
        }

        if (button.hasAttribute('readonly')) {
            button.removeAttribute('readonly');
            cleared = true;
        }

        if (button.classList.contains('pointer-events-none')) {
            button.classList.remove('pointer-events-none');
            cleared = true;
        }

        button.classList.add(UNLOCKED_SEND_CLASS);

        if (cleared) {
            button.dataset.gptModelPickerUnlocked = 'true';
            state.unlockClearCount += 1;
            updateUnlockStatus();
            log('send button unlocked');
        } else if (button.dataset.gptModelPickerUnlocked) {
            delete button.dataset.gptModelPickerUnlocked;
        }

        return cleared;
    }

    /**
     * Снимает блокировку с кнопки отправки и редактора композера.
     *
     * @returns {void}
     */
    function sweepComposerUnlock() {
        if (state.stopped || state.bypassEnabled) {
            return;
        }

        document.querySelectorAll('button[aria-label], button[data-testid]').forEach(button => {
            if (isComposerSendButton(button)) {
                unlockComposerSendButton(button);
            }
        });

        document.querySelectorAll('form [contenteditable="false"], form [readonly]').forEach(node => {
            if (node instanceof HTMLElement && node.classList.contains('ProseMirror')) {
                node.setAttribute('contenteditable', 'true');
                node.removeAttribute('readonly');
            }
        });
    }

    /** Планирует снятие блокировки после изменения DOM ChatGPT. */
    function scheduleComposerUnlock() {
        if (state.unlockSweepTimer !== null) {
            return;
        }

        state.unlockSweepTimer = window.setTimeout(() => {
            state.unlockSweepTimer = null;
            sweepComposerUnlock();
        }, 0);
    }

    /**
     * Повторяет отправку через штатную форму, если ChatGPT проигнорировал клик.
     *
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    function resubmitUnlockedSend(button) {
        if (state.unlockResubmitInFlight) {
            return;
        }

        const form = button.closest('form');

        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        state.unlockResubmitInFlight = true;
        log('ChatGPT ignored the unlocked send button, resubmitting the composer form');

        try {
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit(button);
            } else {
                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
        } catch (error) {
            log('composer form resubmit failed', error);
        } finally {
            window.setTimeout(() => {
                state.unlockResubmitInFlight = false;
            }, 2000);
        }
    }

    /**
     * Ставит повторную отправку, если клик по разблокированной кнопке не привёл
     * к созданию хода разговора.
     *
     * @param {MouseEvent} event
     * @returns {void}
     */
    function handleUnlockedSendClick(event) {
        const button = event.target instanceof Element ? event.target.closest('button') : null;

        if (state.bypassEnabled || !isComposerSendButton(button) || button.dataset.gptModelPickerUnlocked !== 'true') {
            return;
        }

        const clickedAt = Date.now();

        window.setTimeout(() => {
            if (state.lastConversationRequestAt >= clickedAt) {
                return;
            }

            resubmitUnlockedSend(button);
        }, config.unlockResubmitDelayMs);
    }

    /**
     * Ставит защиту от повторной блокировки кнопки отправки.
     *
     * Перехватываются только попытки ChatGPT пометить кнопку отправки как
     * отключённую: свойство disabled и атрибут aria-disabled. Остальные вызовы
     * setAttribute выполняются штатно.
     *
     * @returns {void}
     */
    function installSendUnlockGuard() {
        if (state.unlockObserver) {
            return;
        }

        if (typeof state.originalSetAttribute !== 'function') {
            state.originalSetAttribute = Element.prototype.setAttribute;
        }

        const originalSetAttribute = state.originalSetAttribute;

        Element.prototype.setAttribute = function setAttribute(name, value) {
            if (
                typeof name === 'string'
                && name.toLowerCase() === 'aria-disabled'
                && String(value) === 'true'
                && !state.bypassEnabled
                && isComposerSendButton(this)
            ) {
                return originalSetAttribute.call(this, name, 'false');
            }

            return originalSetAttribute.call(this, name, value);
        };

        const disabledDescriptor = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled');

        if (disabledDescriptor?.set && !state.originalButtonDisabledDescriptor) {
            state.originalButtonDisabledDescriptor = disabledDescriptor;

            Object.defineProperty(HTMLButtonElement.prototype, 'disabled', {
                configurable: true,
                enumerable: disabledDescriptor.enumerable,
                get: disabledDescriptor.get,
                set(value) {
                    if (value && !state.bypassEnabled && isComposerSendButton(this)) {
                        return;
                    }

                    disabledDescriptor.set.call(this, value);
                }
            });
        }

        state.unlockClickHandler = handleUnlockedSendClick;
        document.addEventListener('click', state.unlockClickHandler, true);

        state.unlockObserver = new MutationObserver(scheduleComposerUnlock);
        state.unlockObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-disabled', 'disabled', 'data-disabled', 'contenteditable', 'readonly']
        });

        sweepComposerUnlock();
    }

    /** Возвращает штатное поведение кнопки отправки и редактора композера. */
    function removeSendUnlockGuard() {
        if (state.unlockObserver) {
            state.unlockObserver.disconnect();
            state.unlockObserver = null;
        }

        if (state.unlockClickHandler) {
            document.removeEventListener('click', state.unlockClickHandler, true);
            state.unlockClickHandler = null;
        }

        if (state.unlockSweepTimer !== null) {
            window.clearTimeout(state.unlockSweepTimer);
            state.unlockSweepTimer = null;
        }

        if (typeof state.originalSetAttribute === 'function') {
            Element.prototype.setAttribute = state.originalSetAttribute;
            state.originalSetAttribute = null;
        }

        if (state.originalButtonDisabledDescriptor) {
            Object.defineProperty(HTMLButtonElement.prototype, 'disabled', state.originalButtonDisabledDescriptor);
            state.originalButtonDisabledDescriptor = null;
        }

        document.querySelectorAll(`.${UNLOCKED_SEND_CLASS}`).forEach(button => {
            button.classList.remove(UNLOCKED_SEND_CLASS);
            delete button.dataset.gptModelPickerUnlocked;
        });
    }

    /** Показывает снятые блокировки отправки только после реального вмешательства. */
    function updateUnlockStatus() {
        const lines = [];

        if (state.unlockBackendCount > 0) {
            lines.push(`Отправка: лимит снят в ответе backend (${state.unlockBackendCount})`);
        }

        if (state.unlockClearCount > 0) {
            lines.push(`Отправка: кнопка разблокирована (${state.unlockClearCount})`);
        }

        setStatus(state.unlockStatus, lines.join('\n'), 'warning');
    }

    /**
     * Сохраняет последние срабатывания нейтрализации лимитов.
     *
     * Тела ответов не сохраняются: записываются только время, вид записи и путь.
     * Хранятся последние записи, чтобы состояние можно было проверить позже.
     *
     * @param {string} kind
     * @param {string} [path]
     * @returns {void}
     */
    function recordLimitDiagnostic(kind, path = '') {
        try {
            state.limitDiagnostics.push({
                at: new Date().toISOString(),
                kind,
                path
            });

            if (state.limitDiagnostics.length > config.limitDiagnosticsLimit) {
                state.limitDiagnostics = state.limitDiagnostics.slice(-config.limitDiagnosticsLimit);
            }

            localStorage.setItem(config.limitDiagnosticsStorageKey, JSON.stringify(state.limitDiagnostics));
        } catch (error) {
            log('limit diagnostics failed', error);
        }
    }

    /** Возвращает защищённый перехватчик при чтении window.fetch. */
    function getGuardedFetch() {
        return fetchWithSelectedModel;
    }

    /**
     * Принимает новую штатную обёртку fetch как нижний слой перехватчика.
     *
     * @param {Function} value
     */
    function setGuardedFetch(value) {
        if (typeof value === 'function' && value !== fetchWithSelectedModel) {
            state.downstreamFetch = value;
            state.downstreamReplacementCount += 1;
            log('downstream fetch replaced', state.downstreamReplacementCount);
        }

        updateHookStatus();
    }

    /** Устанавливает accessor, сохраняющий перехватчик поверх штатных обёрток. */
    function installFetchGuard() {
        Object.defineProperty(window, 'fetch', {
            configurable: true,
            enumerable: state.originalFetchDescriptor?.enumerable ?? true,
            get: getGuardedFetch,
            set: setGuardedFetch
        });
        state.fetchGuardInstalled = true;
        updateHookStatus();
    }

    /** Отображает состояние защищённого перехватчика window.fetch только при ошибке. */
    function updateHookStatus() {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
        const isActive = descriptor?.get === getGuardedFetch && descriptor?.set === setGuardedFetch;

        setStatus(
            state.hookStatus,
            isActive ? '' : 'Перехват fetch:\nзащита неактивна',
            isActive ? 'success' : 'error'
        );
    }

    /**
     * Обновляет строку последнего исходящего запроса.
     *
     * @param {string} message
     * @param {'neutral' | 'success' | 'warning' | 'error'} type
     */
    function updateRequestStatus(message, type) {
        setStatus(state.requestStatus, message, type);
    }

    /**
     * Обновляет строку результата backend.
     *
     * @param {string} message
     * @param {'neutral' | 'success' | 'warning' | 'error'} type
     */
    function updateBackendStatus(message, type) {
        setStatus(state.backendStatus, message, type);
    }

    /** Оставляет выбранные параметры только в полях управления панели. */
    function updateSelectedStatus() {
        setStatus(state.selectedStatus, '', 'success');
    }

    /**
     * Включает или выключает режим без вмешательства и сохраняет состояние.
     *
     * Включённый режим пропускает запросы, ответы, backend signals и лимитные
     * проверки без изменений со стороны панели.
     *
     * @param {boolean} enabled
     * @param {boolean} persist
     */
    function setBypassEnabled(enabled, persist) {
        state.bypassEnabled = Boolean(enabled);

        if (persist) {
            localStorage.setItem(config.bypassStorageKey, String(state.bypassEnabled));
        }

        if (state.bypassCheckbox) {
            state.bypassCheckbox.checked = state.bypassEnabled;
        }

        renderBackendOverrideControls();
        updateSelectedStatus();
    }

    /**
     * Устанавливает модель и сохраняет её идентификатор.
     *
     * Пустой slug и старое служебное значение auto заменяются первой доступной
     * моделью из каталогов, чтобы список моделей содержал только реальные slug.
     *
     * @param {string} modelSlug
     * @param {boolean} persist
     */
    function setSelectedModel(modelSlug, persist) {
        const requestedSlug = String(modelSlug || '').trim();
        const normalizedSlug = requestedSlug && requestedSlug !== config.autoModelSlug
            ? requestedSlug
            : getFallbackModelSlug();

        state.selectedModelSlug = normalizedSlug;

        if (persist && normalizedSlug) {
            localStorage.setItem(config.storageKey, normalizedSlug);
        }

        if (state.select) {
            state.select.value = normalizedSlug;
        }

        if (state.input && state.input.value !== normalizedSlug) {
            state.input.value = normalizedSlug;
        }

        renderThinkingEfforts();
        updateSelectedStatus();
        restoreHook();
    }

    /**
     * Устанавливает глубину рассуждения и сохраняет её значение.
     *
     * Значение auto сохраняет штатный thinking_effort исходящего запроса.
     *
     * @param {string} thinkingEffort
     * @param {boolean} persist
     */
    function setSelectedThinkingEffort(thinkingEffort, persist) {
        const normalizedEffort = thinkingEffortOptions.some((option) => option.value === thinkingEffort)
            ? thinkingEffort
            : 'auto';

        state.selectedThinkingEffort = normalizedEffort;

        if (persist) {
            localStorage.setItem(config.thinkingEffortStorageKey, normalizedEffort);
        }

        if (state.thinkingSelect) {
            state.thinkingSelect.value = normalizedEffort;
        }

        updateSelectedStatus();
    }

    /**
     * Включает или выключает запрос ускоренного service tier и сохраняет состояние.
     *
     * @param {boolean} enabled
     * @param {boolean} persist
     */
    function setFastModeEnabled(enabled, persist) {
        state.fastModeEnabled = Boolean(enabled);

        if (persist) {
            localStorage.setItem(config.fastModeStorageKey, String(state.fastModeEnabled));
        }

        if (state.fastCheckbox) {
            state.fastCheckbox.checked = state.fastModeEnabled;
        }

        updateSelectedStatus();
    }


    /**
     * Устанавливает режим Chat Mode и сохраняет состояние.
     *
     * Для ручного model slug включённый режим применяет Chat-параметры,
     * а выключенный оставляет параметры режима исходного запроса.
     *
     * @param {boolean} enabled
     * @param {boolean} persist
     */
    function setForceChatEnabled(enabled, persist) {
        state.forceChatEnabled = Boolean(enabled);

        if (persist) {
            localStorage.setItem(config.forceChatStorageKey, String(state.forceChatEnabled));
        }

        if (state.forceChatCheckbox) {
            state.forceChatCheckbox.checked = state.forceChatEnabled;
        }

        updateSelectedStatus();
        restoreHook();
    }

    /**
     * Добавляет модели одной группы в select.
     *
     * @param {HTMLSelectElement} select
     * @param {string} label
     * @param {Array<{ slug?: string, title?: string, badge?: string }>} models
     */
    /** Updates the status line for backend signal overrides. */
    function updateBackendOverridesStatus(message, type) {
        setStatus(state.backendOverridesStatus, message, type);
    }

    /** Formats the exact backend signal value that the selected override mode applies to the outgoing payload. */
    function formatBackendSignalAppliedValue(signal, override) {
        const action = resolveBackendSignalOverrideAction(signal, override);

        if (action.action === 'preserve') {
            return 'preserve';
        }

        if (action.action === 'delete') {
            return 'delete';
        }

        if (action.action === 'error') {
            return action.message;
        }

        return JSON.stringify(action.value);
    }

    /** Renders current backend signal override settings into the separate signal window controls. */
    function renderBackendOverrideControls() {
        if (!state.backendOverrideControls) {
            return;
        }

        let activeCount = 0;
        let errorCount = 0;

        for (const signal of backendSignalOptions) {
            const controls = state.backendOverrideControls.get(signal.key);
            const override = normalizeBackendSignalOverride(signal, state.backendOverrides[signal.key]);
            const action = resolveBackendSignalOverrideAction(signal, override);

            state.backendOverrides[signal.key] = override;

            if (override.mode !== 'preserve') {
                activeCount += 1;
            }

            if (action.action === 'error') {
                errorCount += 1;
            }

            if (controls?.modeSelect) {
                controls.modeSelect.value = override.mode;
            }

            if (controls?.customInput) {
                controls.customInput.value = override.customValue;
                controls.customInput.disabled = override.mode !== 'custom';
            }

            if (state.bypassEnabled && controls?.appliedInput) {
                controls.appliedInput.value = 'bypass';
                controls.appliedInput.title = controls.appliedInput.value;
                controls.appliedInput.classList.remove('is-error');
                continue;
            }

            if (controls?.appliedInput) {
                controls.appliedInput.value = formatBackendSignalAppliedValue(signal, override);
                controls.appliedInput.title = controls.appliedInput.value;
                controls.appliedInput.classList.toggle('is-error', action.action === 'error');
            }
        }

        if (state.bypassEnabled) {
            updateBackendOverridesStatus('Signals: bypass', 'warning');
            return;
        }

        updateBackendOverridesStatus(
            errorCount
                ? `Signals: ${errorCount} JSON error(s)`
                : activeCount
                    ? `Signals: ${activeCount} override(s) active`
                    : '',
            errorCount ? 'error' : activeCount ? 'warning' : 'success'
        );
    }

    /** Sets the backend signal window visibility and keeps the opener button state in sync. */
    function setBackendSignalsWindowVisible(visible) {
        const isVisible = Boolean(visible);

        if (state.backendOverridesWindow) {
            state.backendOverridesWindow.hidden = !isVisible;
        }

        if (state.backendOverridesButton) {
            state.backendOverridesButton.setAttribute('aria-expanded', String(isVisible));
        }

        if (isVisible) {
            renderBackendOverrideControls();
        }
    }

    /** Sets one backend signal override mode and persists the settings. */
    function setBackendSignalOverrideMode(signalKey, mode, persist) {
        const signal = backendSignalOptions.find((item) => item.key === signalKey);

        if (!signal) {
            return;
        }

        state.backendOverrides[signalKey] = normalizeBackendSignalOverride(signal, {
            ...state.backendOverrides[signalKey],
            mode
        });

        if (persist) {
            saveBackendSignalOverrides();
        }

        renderBackendOverrideControls();
        restoreHook();
    }

    /** Sets one backend signal custom JSON value and persists the settings. */
    function setBackendSignalOverrideCustomValue(signalKey, customValue, persist) {
        const signal = backendSignalOptions.find((item) => item.key === signalKey);

        if (!signal) {
            return;
        }

        state.backendOverrides[signalKey] = normalizeBackendSignalOverride(signal, {
            ...state.backendOverrides[signalKey],
            customValue
        });

        if (persist) {
            saveBackendSignalOverrides();
        }

        renderBackendOverrideControls();
        restoreHook();
    }

    /** Builds the separate backend signal override window with mode, custom JSON, and applied value columns. */
    function createBackendOverridesWindow() {
        const windowBox = createElement('section', {
            id: 'gpt-model-picker-signals-window',
            class: 'gpt-model-picker-signals-window',
            role: 'dialog',
            'aria-label': 'Backend signals',
            hidden: ''
        });
        const header = createElement('div', { class: 'gpt-model-picker-signals-header' });
        const title = createElement('div', { class: 'gpt-model-picker-signals-title' }, 'Backend Signals');
        const closeButton = createElement('button', {
            class: 'gpt-model-picker-signals-close',
            type: 'button',
            'aria-label': 'Close Backend Signals'
        }, 'x');
        const rows = createElement('div', { class: 'gpt-model-picker-signals-rows' });
        const heading = createElement('div', { class: 'gpt-model-picker-override-heading' });
        const status = createElement('div', { class: 'gpt-model-picker-overrides-status', role: 'status', hidden: '' });
        const controls = new Map();

        heading.append(
            createElement('span', {}, 'Signal'),
            createElement('span', {}, 'Mode'),
            createElement('span', {}, 'Custom JSON'),
            createElement('span', {}, 'Applied value')
        );
        rows.append(heading);

        for (const signal of backendSignalOptions) {
            const row = createElement('div', { class: 'gpt-model-picker-override-row' });
            const label = createElement('span', { class: 'gpt-model-picker-override-label' }, signal.label);
            const modeSelect = createElement('select', {
                class: 'gpt-model-picker-override-mode',
                'aria-label': `${signal.label} override mode`
            });
            const customInput = createElement('input', {
                class: 'gpt-model-picker-override-value',
                type: 'text',
                spellcheck: 'false',
                placeholder: signal.customValue || 'null',
                'aria-label': `${signal.label} custom JSON`
            });
            const appliedInput = createElement('input', {
                class: 'gpt-model-picker-override-applied',
                type: 'text',
                readonly: '',
                'aria-label': `${signal.label} applied value`
            });

            for (const option of backendSignalOverrideModes) {
                modeSelect.append(new Option(option.label, option.value));
            }

            modeSelect.addEventListener('change', () => setBackendSignalOverrideMode(signal.key, modeSelect.value, true));
            customInput.addEventListener('input', () => setBackendSignalOverrideCustomValue(signal.key, customInput.value, true));
            row.append(label, modeSelect, customInput, appliedInput);
            rows.append(row);
            controls.set(signal.key, { modeSelect, customInput, appliedInput });
        }

        closeButton.addEventListener('click', () => setBackendSignalsWindowVisible(false));
        header.addEventListener('pointerdown', handleBackendSignalsHeaderPointerDown);
        header.addEventListener('pointermove', handleBackendSignalsHeaderPointerMove);
        header.addEventListener('pointerup', handleBackendSignalsHeaderPointerUp);
        header.addEventListener('pointercancel', handleBackendSignalsHeaderPointerUp);
        header.append(title, closeButton);
        windowBox.append(header, rows, status);
        state.backendOverrideControls = controls;
        state.backendOverridesHeader = header;
        state.backendOverridesStatus = status;

        return windowBox;
    }
    function appendModelGroup(select, label, models) {
        const group = createElement('optgroup', { label });

        for (const model of models) {
            if (!model.slug) {
                continue;
            }

            const option = createElement('option', { value: model.slug });
            const badge = model.badge ? ` ${model.badge}` : '';
            option.textContent = `${model.title || model.slug} — ${model.slug}${badge}`;
            group.append(option);
        }

        if (group.children.length > 0) {
            select.append(group);
        }
    }

    /** Возвращает загруженные и статически объявленные модели панели. */
    function getAllModelOptions() {
        return [
            ...state.workModels,
            ...state.chatModels,
            ...historicalModels,
            ...experimentalApiModels
        ];
    }

    /** Возвращает первый доступный реальный slug модели для выбора по умолчанию. */
    function getFallbackModelSlug() {
        return state.workDefaultModelSlug
            || state.workModels.find((model) => model.slug)?.slug
            || state.chatModels.find((model) => model.slug)?.slug
            || historicalModels.find((model) => model.slug)?.slug
            || experimentalApiModels.find((model) => model.slug)?.slug
            || '';
    }

    /** Возвращает описание выбранной модели из загруженных и статически объявленных каталогов. */
    function getSelectedModel() {
        if (state.selectedModelSlug === config.autoModelSlug) {
            return null;
        }

        return getAllModelOptions()
            .find((model) => model.slug === state.selectedModelSlug) || null;
    }

    /**
     * Возвращает объявленные моделью значения thinking_effort.
     *
     * @param {Record<string, any> | null} model
     * @returns {string[] | null}
     */
    function getModelThinkingEfforts(model) {
        if (!model) {
            return null;
        }

        const efforts = Array.isArray(model.thinking_efforts)
            ? model.thinking_efforts
            : Array.isArray(model.thinkingEfforts)
                ? model.thinkingEfforts
                : null;

        if (!efforts) {
            return null;
        }

        return efforts
            .map((effort) => typeof effort === 'string' ? effort : effort?.thinking_effort)
            .filter((effort) => typeof effort === 'string' && effort);
    }

    /**
     * Возвращает описание thinking effort из каталога выбранной модели.
     *
     * @param {Record<string, any> | null} model
     * @param {string} value
     * @returns {Record<string, any> | null}
     */
    function getModelThinkingEffortDetails(model, value) {
        if (!model) {
            return null;
        }

        const efforts = Array.isArray(model.thinking_efforts)
            ? model.thinking_efforts
            : Array.isArray(model.thinkingEfforts)
                ? model.thinkingEfforts
                : [];

        return efforts.find((effort) => {
            return typeof effort === 'object' && effort?.thinking_effort === value;
        }) || null;
    }

    /** Заполняет список глубины рассуждения и отмечает неподдерживаемые значения. */
    function renderThinkingEfforts() {
        if (!state.thinkingSelect) {
            return;
        }

        const selectedModel = getSelectedModel();
        const supportedEfforts = getModelThinkingEfforts(selectedModel);
        state.thinkingSelect.replaceChildren();

        for (const effort of thinkingEffortOptions) {
            const details = getModelThinkingEffortDetails(selectedModel, effort.value);
            const catalogLabel = details?.short_label || details?.full_label || details?.mobile_full_label;
            const optionLabel = catalogLabel ? `${catalogLabel} — ${effort.value}` : effort.label;
            const option = createElement('option', { value: effort.value }, optionLabel);

            if (
                effort.value !== 'auto'
                && supportedEfforts
                && !supportedEfforts.includes(effort.value)
                && effort.value !== state.selectedThinkingEffort
            ) {
                option.disabled = true;
            }

            state.thinkingSelect.append(option);
        }

        state.thinkingSelect.value = state.selectedThinkingEffort;
    }

    /** Заполняет список реальными моделями из каталогов ChatGPT, исторических моделей, API-моделей и ручного slug. */
    function renderModels() {
        if (!state.select) {
            return;
        }

        state.select.replaceChildren();
        appendModelGroup(state.select, 'Модели Work / TPP', state.workModels);
        appendModelGroup(state.select, 'Обычный ChatGPT', state.chatModels);
        appendModelGroup(state.select, 'Исторические модели', historicalModels);
        appendModelGroup(state.select, 'Экспериментальные модели OpenAI API', experimentalApiModels);

        const allModels = getAllModelOptions();

        if (
            state.selectedModelSlug
            && !allModels.some((model) => model.slug === state.selectedModelSlug)
        ) {
            const group = createElement('optgroup', { label: 'Ручной slug' });
            group.append(createElement('option', { value: state.selectedModelSlug }, `${state.selectedModelSlug} — вручную`));
            state.select.append(group);
        }

        state.select.value = state.selectedModelSlug;
        renderThinkingEfforts();
    }

    /**
     * Возвращает bearer-токен текущей сессии ChatGPT.
     *
     * Значение используется только в памяти для запроса TPP-каталога и не
     * записывается в DOM, console или localStorage.
     *
     * @returns {Promise<string>}
     */
    async function loadSessionAccessToken() {
        const response = await state.baseFetch.call(window, '/api/auth/session', {
            credentials: 'include',
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`/api/auth/session: HTTP ${response.status}`);
        }

        const session = await response.json();
        const accessToken = session?.accessToken;

        if (typeof accessToken !== 'string' || !accessToken) {
            throw new Error('/api/auth/session: accessToken отсутствует');
        }

        return accessToken;
    }

    /**
     * Загружает и возвращает JSON backend-метода.
     *
     * @param {string} url
     * @returns {Promise<Record<string, any>>}
     */
    async function loadJson(url) {
        let response = await state.baseFetch.call(window, url, {
            credentials: 'include'
        });

        if (url === config.workModelsUrl && response.status === 404) {
            const accessToken = await loadSessionAccessToken();

            response = await state.baseFetch.call(window, url, {
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`
                }
            });
        }

        if (!response.ok) {
            throw new Error(`${url}: HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * Загружает отдельные каталоги Work и обычного ChatGPT.
     *
     * После ошибки автоматически повторяет загрузку ограниченное число раз.
     *
     * @param {number} [attempt]
     */
    async function loadModels(attempt = 0) {
        setStatus(state.catalogStatus, '', 'neutral');

        const [workResult, chatResult] = await Promise.allSettled([
            loadJson(config.workModelsUrl),
            loadJson(config.chatModelsUrl)
        ]);
        const errors = [];

        if (workResult.status === 'fulfilled') {
            state.workModels = Array.isArray(workResult.value.models) ? workResult.value.models : [];
            state.workDefaultModelSlug = String(workResult.value.default_model_slug || '');
        } else {
            state.workModels = [];
            errors.push(workResult.reason.message);
        }

        if (chatResult.status === 'fulfilled') {
            state.chatModels = Array.isArray(chatResult.value.models) ? chatResult.value.models : [];
        } else {
            state.chatModels = [];
            errors.push(chatResult.reason.message);
        }

        if (!state.selectedModelSlug) {
            setSelectedModel(localStorage.getItem(config.storageKey) || getFallbackModelSlug(), false);
        }

        renderModels();

        if (errors.length > 0) {
            if (attempt < config.catalogRetryCount) {
                setStatus(
                    state.catalogStatus,
                    `Каталоги:
повтор ${attempt + 1}/${config.catalogRetryCount}…`,
                    'warning'
                );
                window.setTimeout(() => loadModels(attempt + 1), config.catalogRetryDelayMs);
            } else {
                setStatus(state.catalogStatus, `Каталоги:
${errors.join('\n')}`, 'error');
            }
        } else {
            setStatus(state.catalogStatus, '', 'success');
        }

        log('model catalogs loaded', {
            workModels: state.workModels,
            chatModels: state.chatModels,
            workDefaultModelSlug: state.workDefaultModelSlug,
            attempt
        });
    }

    /** Возвращает защитный accessor после его удаления сторонним JavaScript. */
    function restoreHook() {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');

        if (descriptor?.get !== getGuardedFetch || descriptor?.set !== setGuardedFetch) {
            const currentFetch = window.fetch;

            if (typeof currentFetch === 'function' && currentFetch !== fetchWithSelectedModel) {
                state.downstreamFetch = currentFetch;
            }

            installFetchGuard();
        }

        updateHookStatus();
    }

    /**
     * Ограничивает координаты панели видимой областью окна.
     *
     * @param {number} left
     * @param {number} top
     * @returns {{ left: number, top: number }}
     */
    function clampPanelPosition(left, top) {
        const rect = state.panel.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - rect.height);

        return {
            left: Math.min(Math.max(0, left), maxLeft),
            top: Math.min(Math.max(0, top), maxTop)
        };
    }

    /**
     * Устанавливает фиксированную позицию панели.
     *
     * @param {number} left
     * @param {number} top
     */
    function setPanelPosition(left, top) {
        const position = clampPanelPosition(left, top);

        state.panel.style.left = `${position.left}px`;
        state.panel.style.top = `${position.top}px`;
        state.panel.style.right = 'auto';
        state.panel.style.bottom = 'auto';
    }

    /** Сохраняет текущую позицию панели в localStorage. */
    function savePanelPosition() {
        const rect = state.panel.getBoundingClientRect();

        localStorage.setItem(config.positionStorageKey, JSON.stringify({
            left: rect.left,
            top: rect.top
        }));
    }

    /** Восстанавливает сохранённую позицию панели. */
    function restorePanelPosition() {
        const storedPosition = localStorage.getItem(config.positionStorageKey);

        if (!storedPosition) {
            return;
        }

        try {
            const position = JSON.parse(storedPosition);

            if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
                setPanelPosition(position.left, position.top);
            }
        } catch (error) {
            log('stored panel position is invalid', error);
        }
    }

    /** Сохраняет пользовательский размер развёрнутой панели. */
    function savePanelSize() {
        if (!state.panel || state.collapsed) {
            return;
        }

        const rect = state.panel.getBoundingClientRect();

        localStorage.setItem(config.sizeStorageKey, JSON.stringify({
            width: rect.width,
            height: rect.height
        }));
    }

    /** Восстанавливает сохранённый размер панели с учётом текущего viewport. */
    function restorePanelSize() {
        const storedSize = localStorage.getItem(config.sizeStorageKey);

        if (!storedSize) {
            return;
        }

        try {
            const size = JSON.parse(storedSize);

            if (Number.isFinite(size?.width) && Number.isFinite(size?.height)) {
                const maxWidth = Math.max(260, window.innerWidth - 16);
                const maxHeight = Math.max(220, window.innerHeight - 16);
                const width = Math.min(Math.max(260, size.width), maxWidth);
                const height = Math.min(Math.max(220, size.height), maxHeight);

                state.panel.style.width = `${width}px`;
                state.panel.style.height = `${height}px`;
            }
        } catch (error) {
            log('stored panel size is invalid', error);
        }
    }

    /** Сохраняет размер после ручного изменения панели и удерживает её в viewport. */
    function handlePanelResize() {
        if (!state.panel || state.collapsed) {
            return;
        }

        const rect = state.panel.getBoundingClientRect();
        setPanelPosition(rect.left, rect.top);
        savePanelSize();
    }

    /**
     * Сворачивает или разворачивает панель и сохраняет состояние.
     *
     * @param {boolean} collapsed
     * @param {boolean} persist
     */
    function setPanelCollapsed(collapsed, persist) {
        state.collapsed = collapsed;
        state.panel.classList.toggle('is-collapsed', collapsed);
        state.collapseButton.textContent = collapsed ? '+' : '\u2212';
        state.collapseButton.setAttribute('aria-label', collapsed ? '\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c' : '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c');
        state.collapseButton.setAttribute('aria-expanded', String(!collapsed));

        if (persist) {
            localStorage.setItem(config.collapsedStorageKey, String(collapsed));
        }

        const rect = state.panel.getBoundingClientRect();
        setPanelPosition(rect.left, rect.top);
    }

    /** Начинает перемещение панели за шапку. */
    function handleHeaderPointerDown(event) {
        if (event.button !== 0 || event.target.closest('button')) {
            return;
        }

        const rect = state.panel.getBoundingClientRect();

        state.dragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startLeft: rect.left,
            startTop: rect.top
        };
        state.header.classList.add('is-dragging');
        state.header.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    /** Перемещает панель вслед за активным указателем. */
    function handleHeaderPointerMove(event) {
        if (!state.dragState || state.dragState.pointerId !== event.pointerId) {
            return;
        }

        setPanelPosition(
            state.dragState.startLeft + event.clientX - state.dragState.startX,
            state.dragState.startTop + event.clientY - state.dragState.startY
        );
    }

    /** Завершает перемещение панели и сохраняет позицию. */
    function handleHeaderPointerUp(event) {
        if (!state.dragState || state.dragState.pointerId !== event.pointerId) {
            return;
        }

        state.header.classList.remove('is-dragging');

        if (state.header.hasPointerCapture(event.pointerId)) {
            state.header.releasePointerCapture(event.pointerId);
        }

        state.dragState = null;
        savePanelPosition();
    }

    /**
     * Ограничивает координаты окна Backend Signals видимой областью окна.
     *
     * @param {number} left
     * @param {number} top
     * @returns {{ left: number, top: number }}
     */
    function clampBackendSignalsWindowPosition(left, top) {
        const rect = state.backendOverridesWindow.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - rect.height);

        return {
            left: Math.min(Math.max(0, left), maxLeft),
            top: Math.min(Math.max(0, top), maxTop)
        };
    }

    /**
     * Устанавливает фиксированную позицию окна Backend Signals.
     *
     * @param {number} left
     * @param {number} top
     */
    function setBackendSignalsWindowPosition(left, top) {
        const position = clampBackendSignalsWindowPosition(left, top);

        state.backendOverridesWindow.style.left = `${position.left}px`;
        state.backendOverridesWindow.style.top = `${position.top}px`;
        state.backendOverridesWindow.style.right = 'auto';
        state.backendOverridesWindow.style.bottom = 'auto';
    }

    /** Начинает перемещение окна Backend Signals за шапку. */
    function handleBackendSignalsHeaderPointerDown(event) {
        if (event.button !== 0 || event.target.closest('button')) {
            return;
        }

        const rect = state.backendOverridesWindow.getBoundingClientRect();

        state.backendSignalsDragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startLeft: rect.left,
            startTop: rect.top
        };
        event.currentTarget.classList.add('is-dragging');
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    /** Перемещает окно Backend Signals вслед за активным указателем. */
    function handleBackendSignalsHeaderPointerMove(event) {
        if (!state.backendSignalsDragState || state.backendSignalsDragState.pointerId !== event.pointerId) {
            return;
        }

        setBackendSignalsWindowPosition(
            state.backendSignalsDragState.startLeft + event.clientX - state.backendSignalsDragState.startX,
            state.backendSignalsDragState.startTop + event.clientY - state.backendSignalsDragState.startY
        );
    }

    /** Завершает перемещение окна Backend Signals. */
    function handleBackendSignalsHeaderPointerUp(event) {
        if (!state.backendSignalsDragState || state.backendSignalsDragState.pointerId !== event.pointerId) {
            return;
        }

        event.currentTarget.classList.remove('is-dragging');

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        state.backendSignalsDragState = null;
    }

    /** Возвращает панель и открытое окно Backend Signals в видимую область после изменения размера окна. */
    function handleWindowResize() {
        if (!state.panel) {
            return;
        }

        const rect = state.panel.getBoundingClientRect();
        setPanelPosition(rect.left, rect.top);
        savePanelPosition();

        if (state.backendOverridesWindow && !state.backendOverridesWindow.hidden) {
            const backendRect = state.backendOverridesWindow.getBoundingClientRect();
            setBackendSignalsWindowPosition(backendRect.left, backendRect.top);
        }
    }

    /** Применяет ручной slug после каждого изменения поля ввода. */
    function handleManualModelInput() {
        setSelectedModel(state.input.value, true);
        renderModels();
    }

    /**
     * Добавляет компактную изменяемую по размеру панель управления и диагностики.
     *
     * Шапка содержит иконку, название и версию и служит областью перемещения.
     * Поля модели, ручного slug, thinking effort и оба переключателя имеют уникальные
     * идентификаторы и имена. Переключатели связаны с подписями через for.
     * Размер и положение панели сохраняются между перезагрузками страницы.
     */
    function createPanel() {
        const panel = createElement('section', {
            id: 'gpt-model-picker-panel',
            role: 'dialog',
            'aria-label': 'Выбор и контроль модели ChatGPT'
        });
        const header = createElement('div', { class: 'gpt-model-picker-header' });
        const identity = createElement('div', { class: 'gpt-model-picker-identity' });
        const icon = createElement('div', { class: 'gpt-model-picker-app-icon', 'aria-hidden': 'true' });
        const titleCopy = createElement('div', { class: 'gpt-model-picker-title-copy' });
        const title = createElement('div', { class: 'gpt-model-picker-title' }, 'GPT Model Picker');
        const version = createElement('div', { class: 'gpt-model-picker-version' }, `ChatGPT · v${config.version}`);
        const collapseButton = createElement('button', {
            class: 'gpt-model-picker-collapse',
            type: 'button',
            'aria-label': 'Свернуть панель',
            'aria-expanded': 'true'
        }, '−');
        const content = createElement('div', { class: 'gpt-model-picker-content' });
        const bypassLabel = createElement('label', {
            class: 'gpt-model-picker-toggle gpt-model-picker-bypass',
            for: 'gpt-model-picker-bypass-checkbox'
        });
        const bypassCheckbox = createElement('input', {
            id: 'gpt-model-picker-bypass-checkbox',
            name: 'gpt-model-picker-bypass-checkbox',
            class: 'gpt-model-picker-checkbox',
            type: 'checkbox',
            'aria-label': 'Bypass'
        });
        const bypassText = createElement('span', {}, 'Bypass');
        const modelLabel = createElement('label', { class: 'gpt-model-picker-field', for: 'gpt-model-picker-model' });
        const modelLabelText = createElement('span', { class: 'gpt-model-picker-field-label' }, 'Модель');
        const select = createElement('select', {
            id: 'gpt-model-picker-model',
            name: 'gpt-model-picker-model',
            class: 'gpt-model-picker-select',
            'aria-label': 'Модель ChatGPT'
        });
        const inputLabel = createElement('label', { class: 'gpt-model-picker-field', for: 'gpt-model-picker-manual-model' });
        const inputLabelText = createElement('span', { class: 'gpt-model-picker-field-label' }, 'Ручной slug');
        const input = createElement('input', {
            id: 'gpt-model-picker-manual-model',
            name: 'gpt-model-picker-manual-model',
            class: 'gpt-model-picker-input',
            type: 'text',
            placeholder: 'model_slug вручную',
            'aria-label': 'Идентификатор модели вручную'
        });
        const thinkingLabel = createElement('label', { class: 'gpt-model-picker-field', for: 'gpt-model-picker-thinking-effort' });
        const thinkingLabelText = createElement('span', { class: 'gpt-model-picker-field-label' }, 'Как сильно думать');
        const thinkingSelect = createElement('select', {
            id: 'gpt-model-picker-thinking-effort',
            name: 'gpt-model-picker-thinking-effort',
            class: 'gpt-model-picker-select',
            'aria-label': 'Глубина рассуждения'
        });
        const toggles = createElement('div', { class: 'gpt-model-picker-toggles' });
        const fastLabel = createElement('label', {
            class: 'gpt-model-picker-toggle',
            for: 'gpt-model-picker-fast-checkbox'
        });
        const fastCheckbox = createElement('input', {
            id: 'gpt-model-picker-fast-checkbox',
            name: 'gpt-model-picker-fast-checkbox',
            class: 'gpt-model-picker-checkbox',
            type: 'checkbox',
            'aria-label': 'Скорость 1.5x'
        });
        const fastText = createElement('span', {}, 'Скорость 1.5x');
        const forceChatLabel = createElement('label', {
            class: 'gpt-model-picker-toggle',
            for: 'gpt-model-picker-force-chat-checkbox'
        });
        const forceChatCheckbox = createElement('input', {
            id: 'gpt-model-picker-force-chat-checkbox',
            name: 'gpt-model-picker-force-chat-checkbox',
            class: 'gpt-model-picker-checkbox',
            type: 'checkbox',
            'aria-label': 'Chat Mode'
        });
        const forceChatText = createElement('span', {}, 'Chat Mode');
        const backendOverridesButton = createElement('button', {
            id: 'gpt-model-picker-signals-button',
            class: 'gpt-model-picker-signals-button',
            type: 'button',
            'aria-controls': 'gpt-model-picker-signals-window',
            'aria-expanded': 'false'
        }, 'Backend Signals');
        const backendOverridesWindow = createBackendOverridesWindow();
        const diagnostics = createElement('div', { class: 'gpt-model-picker-diagnostics' });
        const hookStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status', hidden: '' });
        const unlockStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status', hidden: '' });
        const catalogStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status', hidden: '' });
        const selectedStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status', hidden: '' });
        const requestStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status' }, 'Запрос:\nещё не отправлялся');
        const backendStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status' }, 'Backend:\nещё не проверен');
        const hint = createElement('div', { class: 'gpt-model-picker-hint' }, 'Chat Mode удерживает ручной model slug в обычном primary_assistant Chat. Выключите его, если нужен штатный режим выбранной модели.\nРазблокировка отправки снимает клиентский запрет кнопки при исчерпанном лимите Work.');

        icon.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="#69afed"/><path d="M9 11.5h14M9 16h9M9 20.5h12" fill="none" stroke="#0f1720" stroke-width="2.2" stroke-linecap="round"/><circle cx="23" cy="20.5" r="2.2" fill="#f2f5f8"/></svg>';
        titleCopy.append(title, version);
        identity.append(icon, titleCopy);
        header.append(identity, collapseButton);
        bypassLabel.append(bypassCheckbox, bypassText);
        modelLabel.append(modelLabelText, select);
        inputLabel.append(inputLabelText, input);
        thinkingLabel.append(thinkingLabelText, thinkingSelect);
        fastLabel.append(fastCheckbox, fastText);
        forceChatLabel.append(forceChatCheckbox, forceChatText);
        toggles.append(fastLabel, forceChatLabel, backendOverridesButton);
        diagnostics.append(hookStatus, catalogStatus, requestStatus, backendStatus, unlockStatus);
        content.append(bypassLabel, modelLabel, inputLabel, thinkingLabel, toggles, diagnostics, hint);
        panel.append(header, content);
        document.body.append(panel);
        document.body.append(backendOverridesWindow);

        Object.assign(state, {
            panel,
            header,
            collapseButton,
            select,
            input,
            thinkingSelect,
            bypassCheckbox,
            fastCheckbox,
            forceChatCheckbox,
            backendOverridesButton,
            backendOverridesWindow,
            unlockStatus,
            hookStatus,
            catalogStatus,
            selectedStatus,
            requestStatus,
            backendStatus
        });

        select.addEventListener('change', () => {
            setSelectedModel(select.value, true);
            renderModels();
        });
        input.addEventListener('input', handleManualModelInput);
        thinkingSelect.addEventListener('change', () => setSelectedThinkingEffort(thinkingSelect.value, true));
        bypassCheckbox.addEventListener('change', () => setBypassEnabled(bypassCheckbox.checked, true));
        fastCheckbox.addEventListener('change', () => setFastModeEnabled(fastCheckbox.checked, true));
        forceChatCheckbox.addEventListener('change', () => setForceChatEnabled(forceChatCheckbox.checked, true));
        backendOverridesButton.addEventListener('click', () => setBackendSignalsWindowVisible(backendOverridesWindow.hidden));
        collapseButton.addEventListener('click', () => setPanelCollapsed(!state.collapsed, true));
        header.addEventListener('pointerdown', handleHeaderPointerDown);
        header.addEventListener('pointermove', handleHeaderPointerMove);
        header.addEventListener('pointerup', handleHeaderPointerUp);
        header.addEventListener('pointercancel', handleHeaderPointerUp);
        window.addEventListener('resize', handleWindowResize);

        state.selectedThinkingEffort = localStorage.getItem(config.thinkingEffortStorageKey) || 'auto';
        state.bypassEnabled = localStorage.getItem(config.bypassStorageKey) === 'true'
            || (localStorage.getItem(config.bypassStorageKey) === null && localStorage.getItem(config.storageKey) === config.autoModelSlug);
        state.fastModeEnabled = localStorage.getItem(config.fastModeStorageKey) === 'true';
        state.forceChatEnabled = localStorage.getItem(config.forceChatStorageKey) !== 'false';
        state.backendOverrides = loadBackendSignalOverrides();
        renderBackendOverrideControls();
        setSelectedThinkingEffort(state.selectedThinkingEffort, false);
        setBypassEnabled(state.bypassEnabled, false);
        setFastModeEnabled(state.fastModeEnabled, false);
        setForceChatEnabled(state.forceChatEnabled, false);

        restorePanelSize();
        setPanelCollapsed(localStorage.getItem(config.collapsedStorageKey) === 'true', false);
        restorePanelPosition();

        if (typeof ResizeObserver === 'function') {
            state.resizeObserver = new ResizeObserver(handlePanelResize);
            state.resizeObserver.observe(panel);
        }
    }
    /**
     * Возвращает настоящую ссылку разговора из строки боковой панели.
     *
     * ChatGPT создаёт ссылку с data-interactive-row-link как для обычных,
     * так и для проектных разговоров. Полный href сохраняет маршрут проекта
     * и предоставляет штатное контекстное меню строки.
     *
     * @param {Element | null} container Строка разговора, ссылка или вложенный элемент.
     * @returns {HTMLAnchorElement | null}
     */
    function getChatLink(container) {
        if (!(container instanceof Element)) {
            return null;
        }

        const directLink = container.closest('a[data-interactive-row-link][href]');
        if (directLink instanceof HTMLAnchorElement) {
            return directLink;
        }

        const row = container.closest(
            '.group.relative.cursor-interaction, [role="group"], [role="listitem"], [data-sidebar-chatgpt-conversation-key]'
        );
        const link = row?.querySelector('a[data-interactive-row-link][href]');

        return link instanceof HTMLAnchorElement ? link : null;
    }

    /**
     * Возвращает URL разговора из настоящей ссылки строки ChatGPT.
     *
     * @param {Element | null} container Строка разговора, ссылка или вложенный элемент.
     * @returns {string}
     */
    function getNavigationHref(container) {
        return getChatLink(container)?.href || '';
    }

    /**
     * Возвращает строку разговора, которой принадлежит кнопка штатного меню.
     *
     * Строкой считается ближайший контейнер с настоящей ссылкой разговора.
     * Актуальная разметка ChatGPT использует role="group", поэтому наличие
     * role="button" для строки не требуется.
     *
     * @param {HTMLElement} trigger Кнопка «Действия чата».
     * @returns {HTMLElement | null}
     */
    function getChatActionRow(trigger) {
        const row = trigger.closest(
            '.group.relative.cursor-interaction, [role="group"], [role="listitem"], [data-sidebar-chatgpt-conversation-key]'
        );

        return row instanceof HTMLElement && getChatLink(row)
            ? row
            : null;
    }

    /**
     * Возвращает Radix-триггер, создавший открытое штатное меню ChatGPT.
     *
     * Связь определяется только штатными ARIA-атрибутами меню и триггера:
     * aria-labelledby, aria-controls и aria-owns.
     *
     * @param {HTMLElement} menu Открытое меню ChatGPT.
     * @returns {HTMLElement | null}
     */
    function getNavigationMenuTrigger(menu) {
        const labelIds = (menu.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);

        for (const id of labelIds) {
            const trigger = document.getElementById(id);

            if (trigger instanceof HTMLElement && trigger.getAttribute('aria-haspopup') === 'menu') {
                return trigger;
            }
        }

        if (!menu.id) {
            return null;
        }

        const triggers = document.querySelectorAll('[aria-haspopup="menu"]');
        for (const trigger of triggers) {
            if (!(trigger instanceof HTMLElement)) {
                continue;
            }

            const controlledIds = [
                trigger.getAttribute('aria-controls'),
                trigger.getAttribute('aria-owns')
            ].filter(Boolean).flatMap(value => value.split(/\s+/));

            if (controlledIds.includes(menu.id)) {
                return trigger;
            }
        }

        return null;
    }

    /**
     * Возвращает шаблон пункта штатного меню ChatGPT.
     *
     * Для визуального шаблона предпочитается пункт «Поделиться», поскольку его
     * структура содержит стандартные контейнеры текста и ведущей иконки.
     *
     * @param {HTMLElement} menu Открытое штатное меню.
     * @returns {HTMLElement | null}
     */
    function getNavigationMenuItemTemplate(menu) {
        const items = Array.from(menu.querySelectorAll(':scope > [role="menuitem"]'));
        const enabledItems = items.filter(item => {
            return !item.hasAttribute('data-disabled')
                && item.getAttribute('aria-disabled') !== 'true'
                && !item.hasAttribute('disabled');
        });

        return enabledItems.find(item => item.textContent.trim() === 'Поделиться')
            || enabledItems[0]
            || items[0]
            || null;
    }

    /**
     * Записывает подпись пункта меню, сохраняя штатную внутреннюю разметку ChatGPT.
     *
     * @param {HTMLElement} item Пункт меню.
     * @param {string} label Новая подпись.
     * @returns {void}
     */
    function setNavigationMenuItemLabel(item, label) {
        const labels = Array.from(item.querySelectorAll('span.truncate'));
        const labelElement = labels.at(-1);

        if (labelElement instanceof HTMLElement) {
            labelElement.textContent = label;
        } else {
            item.textContent = label;
        }
    }

    /**
     * Закрывает открытое меню через штатную обработку клавиши Escape.
     *
     * @param {HTMLElement} menu Открытое меню ChatGPT.
     * @returns {void}
     */
    function closeNavigationMenu(menu) {
        menu.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
            cancelable: true
        }));
    }

    /**
     * Создаёт или обновляет первый пункт «Открыть в новой вкладке».
     *
     * Пункт клонирует полную структуру существующего menuitem, поэтому размеры,
     * типографика, hover/focus и внутренняя компоновка наследуются от текущего
     * меню ChatGPT.
     *
     * @param {HTMLElement} menu Открытое штатное меню.
     * @param {string} href Адрес новой вкладки.
     * @param {() => void} closeMenu Действие закрытия штатного меню.
     * @returns {HTMLElement | null}
     */
    function ensureOpenInNewTabMenuItem(menu, href, closeMenu) {
        const template = getNavigationMenuItemTemplate(menu);
        if (!template) {
            return null;
        }

        let item = menu.querySelector(':scope > [data-gpt-model-picker-open-in-tab]');
        if (!(item instanceof HTMLElement)) {
            item = template.cloneNode(true);
            item.dataset.gptModelPickerOpenInTab = 'true';
            item.removeAttribute('id');
            item.removeAttribute('data-disabled');
            item.removeAttribute('aria-disabled');
            item.removeAttribute('disabled');
            item.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
            item.querySelectorAll('[data-disabled], [aria-disabled], [disabled]').forEach(element => {
                element.removeAttribute('data-disabled');
                element.removeAttribute('aria-disabled');
                element.removeAttribute('disabled');
            });
            item.setAttribute('role', 'menuitem');
            item.setAttribute('tabindex', '-1');
            item.style.pointerEvents = '';
            item.style.opacity = '';
            setNavigationMenuItemLabel(item, 'Открыть в новой вкладке');
        }

        item.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            window.open(href, '_blank', 'noopener,noreferrer');
            closeMenu();
        };

        if (item !== menu.firstElementChild) {
            menu.insertBefore(item, menu.firstElementChild);
        }

        return item;
    }

    /**
     * Добавляет «Открыть в новой вкладке» первым пунктом штатного меню разговора.
     *
     * Адрес берётся из настоящего href строки, включая маршрут проектного чата.
     *
     * @param {HTMLElement} menu Открытое штатное меню.
     * @param {string} href Адрес разговора.
     * @returns {boolean} true, если пункт присутствует в меню
     */
    function prependOpenConversationItem(menu, href) {
        if (!href) {
            return false;
        }

        return ensureOpenInNewTabMenuItem(menu, href, () => closeNavigationMenu(menu)) !== null;
    }

    /**
     * Возвращает true для видимого открытого меню ChatGPT.
     *
     * @param {Element} menu Проверяемый элемент.
     * @returns {boolean}
     */
    function isOpenNavigationMenu(menu) {
        if (!(menu instanceof HTMLElement) || menu.getAttribute('role') !== 'menu') {
            return false;
        }

        const style = getComputedStyle(menu);

        return menu.getClientRects().length > 0
            && style.display !== 'none'
            && style.visibility !== 'hidden'
            && menu.getAttribute('data-state') !== 'closed';
    }

    /**
     * Возвращает открытые и видимые штатные меню ChatGPT.
     *
     * @returns {HTMLElement[]}
     */
    function getOpenNavigationMenus() {
        return Array.from(document.querySelectorAll('[role="menu"]')).filter(isOpenNavigationMenu);
    }

    /**
     * Возвращает меню, которые созданы или переведены в открытое состояние
     * текущим набором DOM-мутаций.
     *
     * @param {MutationRecord[]} mutations Мутации наблюдателя меню.
     * @returns {HTMLElement[]}
     */
    function getChangedNavigationMenus(mutations) {
        const menus = new Set();

        mutations.forEach(mutation => {
            if (mutation.type === 'attributes') {
                if (isOpenNavigationMenu(mutation.target)) {
                    menus.add(mutation.target);
                }
                return;
            }

            if (mutation.target instanceof Element) {
                const ownerMenu = mutation.target.closest('[role="menu"]');

                if (ownerMenu && isOpenNavigationMenu(ownerMenu)) {
                    menus.add(ownerMenu);
                }
            }

            mutation.addedNodes.forEach(node => {
                if (!(node instanceof Element)) {
                    return;
                }

                if (isOpenNavigationMenu(node)) {
                    menus.add(node);
                }

                node.querySelectorAll?.('[role="menu"]').forEach(menu => {
                    if (isOpenNavigationMenu(menu)) {
                        menus.add(menu);
                    }
                });
            });
        });

        return Array.from(menus);
    }

    /**
     * Маршруты верхней навигации, которые ChatGPT выводит кнопками.
     *
     * @type {Map<string, string>}
     */
    const sidebarNavigationRoutes = new Map([
        ['Новый чат', '/'],
        ['New chat', '/'],
        ['Запланировано', '/scheduled'],
        ['Scheduled', '/scheduled'],
        ['Библиотека', '/library?tab=images&entry_point=sidebar'],
        ['Library', '/library?tab=images&entry_point=sidebar'],
        ['Плагины', '/plugins'],
        ['Plugins', '/plugins']
    ]);

    /**
     * Маршруты пунктов «Обзор» с самостоятельными страницами.
     *
     * @type {Map<string, string>}
     */
    const browseNavigationRoutes = new Map([
        ['Финансы', '/finances'],
        ['Finances', '/finances'],
        ['Карты', '/maps'],
        ['Maps', '/maps']
    ]);

    /**
     * Возвращает нормализованную видимую подпись элемента навигации.
     *
     * @param {HTMLElement} element Кнопка или пункт меню.
     * @returns {string}
     */
    function getNavigationElementLabel(element) {
        return element.innerText.trim().replace(/\s+/g, ' ');
    }

    /**
     * Размещает ссылочную поверхность точно поверх исходного элемента.
     *
     * Ссылка является соседним элементом, а не потомком button/menuitem, поэтому
     * Edge распознаёт её как обычную ссылку и показывает ссылочные команды
     * контекстного меню. Радиус ссылки синхронизируется с исходным элементом,
     * чтобы штатная hover-подсветка повторяла его геометрию.
     *
     * @param {HTMLElement} container Исходная кнопка или menuitem ChatGPT.
     * @param {HTMLAnchorElement} link Ссылочная поверхность.
     * @returns {void}
     */
    function positionBrowserNavigationLink(container, link) {
        const parent = container.parentElement;
        if (!(parent instanceof HTMLElement)) {
            return;
        }

        if (getComputedStyle(parent).position === 'static') {
            if (!Object.prototype.hasOwnProperty.call(parent.dataset, 'gptModelPickerOriginalPosition')) {
                parent.dataset.gptModelPickerOriginalPosition = parent.style.position;
            }
            parent.style.position = 'relative';
        }

        link.style.left = `${container.offsetLeft}px`;
        link.style.top = `${container.offsetTop}px`;
        link.style.width = `${container.offsetWidth}px`;
        link.style.height = `${container.offsetHeight}px`;
        link.style.borderRadius = getComputedStyle(container).borderRadius;
    }

    /**
     * Добавляет настоящую ссылочную поверхность поверх button или menuitem.
     *
     * Правый клик, средняя кнопка и модифицированный клик обрабатываются Edge
     * как действия над <a href>. Обычный левый клик передаётся исходному
     * элементу ChatGPT и сохраняет его штатную SPA-навигацию. При наведении
     * ссылочная поверхность использует штатный CSS-токен hover-фона ChatGPT.
     *
     * @param {HTMLElement} container Исходная кнопка или menuitem ChatGPT.
     * @param {string} href Маршрут назначения.
     * @param {string} type Тип ссылочной поверхности.
     * @returns {void}
     */
    function ensureBrowserNavigationLink(container, href, type) {
        const parent = container.parentElement;
        if (!(parent instanceof HTMLElement)) {
            return;
        }

        const targetHref = new URL(href, window.location.origin).href;
        let link = Array.from(parent.children).find(child => {
            return child instanceof HTMLAnchorElement
                && child.dataset.gptModelPickerNavigationLink === type
                && child.dataset.gptModelPickerNavigationTarget === targetHref;
        });

        if (!(link instanceof HTMLAnchorElement)) {
            link = document.createElement('a');
            link.dataset.gptModelPickerNavigationLink = type;
            link.dataset.gptModelPickerNavigationTarget = targetHref;
            link.href = targetHref;
            link.tabIndex = -1;
            link.setAttribute('aria-hidden', 'true');
            link.style.position = 'absolute';
            link.style.zIndex = '20';
            link.style.display = 'block';
            link.style.textDecoration = 'none';

            link.addEventListener('mouseenter', () => {
                link.style.backgroundColor = 'var(--color-background-primary-ghost-hover)';
            });

            link.addEventListener('mouseleave', () => {
                link.style.backgroundColor = '';
            });

            link.addEventListener('click', event => {
                event.stopPropagation();

                if (
                    event.button !== 0
                    || event.metaKey
                    || event.ctrlKey
                    || event.shiftKey
                    || event.altKey
                ) {
                    return;
                }

                event.preventDefault();
                container.click();
            });

            link.addEventListener('auxclick', event => {
                event.stopPropagation();
            });

            link.addEventListener('contextmenu', event => {
                event.stopPropagation();
            });

            parent.append(link);
        }

        link.href = targetHref;
        positionBrowserNavigationLink(container, link);
    }

    /**
     * Возвращает кнопкам верхней навигации и ссылочным пунктам «Обзор»
     * браузерное поведение настоящих ссылок.
     *
     * Строки разговоров уже содержат штатные <a> ChatGPT и не изменяются.
     *
     * @returns {void}
     */
    function syncBrowserNavigationLinks() {
        document.querySelectorAll('nav button').forEach(button => {
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }

            const href = sidebarNavigationRoutes.get(getNavigationElementLabel(button));
            if (href) {
                ensureBrowserNavigationLink(button, href, 'sidebar');
            }
        });

        document.querySelectorAll('[role="menu"] > [role="menuitem"]').forEach(item => {
            if (!(item instanceof HTMLElement) || item.dataset.gptModelPickerOpenInTab === 'true') {
                return;
            }

            const href = browseNavigationRoutes.get(getNavigationElementLabel(item));
            if (href) {
                ensureBrowserNavigationLink(item, href, 'browse-menu');
            }
        });
    }

    /**
     * Удаляет ссылочные поверхности и возвращает исходное позиционирование
     * их родительских контейнеров.
     *
     * @returns {void}
     */
    function removeBrowserNavigationLinks() {
        const parents = new Set();

        document.querySelectorAll('a[data-gpt-model-picker-navigation-link]').forEach(link => {
            if (link.parentElement instanceof HTMLElement) {
                parents.add(link.parentElement);
            }
            link.remove();
        });

        parents.forEach(parent => {
            if (Object.prototype.hasOwnProperty.call(parent.dataset, 'gptModelPickerOriginalPosition')) {
                parent.style.position = parent.dataset.gptModelPickerOriginalPosition;
                delete parent.dataset.gptModelPickerOriginalPosition;
            }
        });
    }

    /**
     * Синхронизирует штатные меню разговоров, затронутые текущей DOM-мутацией.
     *
     * Меню троеточия связывается с «Действия чата» через ARIA. Контекстное
     * меню строки получает href, записанный при штатном contextmenu.
     *
     * @param {MutationRecord[] | null} mutations Мутации наблюдателя или null для первичной синхронизации.
     * @returns {void}
     */
    function syncOpenNavigationMenus(mutations = null) {
        const menus = mutations
            ? getChangedNavigationMenus(mutations)
            : getOpenNavigationMenus();
        let contextHref = state.navigationContextHref;

        menus.forEach(menu => {
            const trigger = getNavigationMenuTrigger(menu);

            if (trigger instanceof HTMLButtonElement && trigger.getAttribute('aria-label') === 'Действия чата') {
                const row = getChatActionRow(trigger);
                prependOpenConversationItem(menu, getNavigationHref(row));
                return;
            }

            if (contextHref && prependOpenConversationItem(menu, contextHref)) {
                contextHref = '';
                state.navigationContextHref = '';

                if (state.navigationContextHrefTimer !== null) {
                    window.clearTimeout(state.navigationContextHrefTimer);
                    state.navigationContextHrefTimer = null;
                }
            }
        });
    }

    /**
     * Запоминает href строки разговора для штатного контекстного меню ChatGPT.
     *
     * Событие не подавляется. Ссылочные поверхности верхней навигации полностью
     * обслуживаются браузером и не участвуют в логике меню разговоров.
     *
     * @param {MouseEvent} event Событие contextmenu.
     * @returns {void}
     */
    function handleNavigationContextMenu(event) {
        const target = event.target instanceof Element ? event.target : null;

        if (target?.closest('a[data-gpt-model-picker-navigation-link]')) {
            state.navigationContextHref = '';
            return;
        }

        const href = getNavigationHref(target);
        state.navigationContextHref = href;

        if (state.navigationContextHrefTimer !== null) {
            window.clearTimeout(state.navigationContextHrefTimer);
            state.navigationContextHrefTimer = null;
        }

        if (href) {
            state.navigationContextHrefTimer = window.setTimeout(() => {
                if (state.navigationContextHref === href) {
                    state.navigationContextHref = '';
                }

                state.navigationContextHrefTimer = null;
            }, 1500);
        }
    }

    /**
     * Наблюдает за штатными меню разговоров и динамической навигацией ChatGPT.
     *
     * Верхние кнопки и ссылочные пункты «Обзор» получают <a href>-поверхности
     * после появления соответствующих элементов в DOM.
     *
     * @returns {void}
     */
    function observeNavigationLinks() {
        if (state.navigationMenuObserver) {
            state.navigationMenuObserver.disconnect();
        }
        if (state.navigationContextMenuHandler) {
            document.removeEventListener('contextmenu', state.navigationContextMenuHandler, true);
        }

        state.navigationContextMenuHandler = handleNavigationContextMenu;
        document.addEventListener('contextmenu', state.navigationContextMenuHandler, true);

        state.navigationMenuObserver = new MutationObserver(mutations => {
            syncOpenNavigationMenus(mutations);
            syncBrowserNavigationLinks();
        });
        state.navigationMenuObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-state']
        });

        syncBrowserNavigationLinks();
        syncOpenNavigationMenus();
    }

    /**
     * Удаляет ссылочные поверхности, добавленные пункты меню и обработчик
     * контекстного меню строк разговоров.
     *
     * @returns {void}
     */
    function removeNavigationLinks() {
        removeBrowserNavigationLinks();
        document.querySelectorAll('[role="menu"] > [data-gpt-model-picker-open-in-tab]').forEach(item => item.remove());

        if (state.navigationContextMenuHandler) {
            document.removeEventListener('contextmenu', state.navigationContextMenuHandler, true);
            state.navigationContextMenuHandler = null;
        }

        if (state.navigationContextHrefTimer !== null) {
            window.clearTimeout(state.navigationContextHrefTimer);
            state.navigationContextHrefTimer = null;
        }

        state.navigationContextHref = '';
    }

    /**
     * Добавляет компактный оконный стиль панели с изменяемым размером.
     *
     * Палитра и структура шапки повторяют подход DropMe: отдельная title bar,
     * иконка приложения, название, вторичная строка версии и плоская кнопка справа.
     * Кнопки «Закрепить чат» и «Открепить чат» вместе с отдельным пустым контейнером
     * не участвуют в раскладке строк; остальные действия, включая редактирование
     * проектов, не затрагиваются. Checkbox сохраняет нативный вид.
     */
    function addStyles() {
        const style = document.createElement('style');

        style.id = 'gpt-model-picker-styles';
        style.textContent = `
            button[aria-label="Закрепить чат"],
            button[aria-label="Открепить чат"],
            :where(div, span):has(> button[aria-label="Закрепить чат"]:only-child),
            :where(div, span):has(> button[aria-label="Открепить чат"]:only-child) {
                display: none !important;
            }
            #gpt-model-picker-panel {
                position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
                display: flex; width: min(330px, calc(100vw - 16px)); height: min(430px, calc(100vh - 16px));
                min-width: 260px; min-height: 220px; max-width: calc(100vw - 8px); max-height: calc(100vh - 8px);
                box-sizing: border-box; flex-direction: column; overflow: hidden; resize: both;
                color: #f2f5f8; background: #111418; border: 1px solid #34404b; border-radius: 10px;
                box-shadow: 0 10px 32px rgb(0 0 0 / 38%); font: 11px/1.3 Arial, sans-serif;
            }
            #gpt-model-picker-panel.is-collapsed {
                height: 44px !important; min-height: 0; max-height: 44px; resize: none;
            }
            #gpt-model-picker-panel.is-collapsed .gpt-model-picker-content { display: none; }
            .gpt-model-picker-header {
                display: flex; min-height: 44px; flex: 0 0 44px; align-items: center; justify-content: space-between;
                gap: 8px; box-sizing: border-box; padding: 6px 7px 6px 8px; touch-action: none; user-select: none;
                background: #252d36; border-bottom: 1px solid #34404b; cursor: grab;
            }
            #gpt-model-picker-panel.is-collapsed .gpt-model-picker-header { border-bottom: 0; }
            .gpt-model-picker-header.is-dragging { cursor: grabbing; }
            .gpt-model-picker-identity {
                display: flex; min-width: 0; flex: 1 1 auto; align-items: center; gap: 8px; pointer-events: none;
            }
            .gpt-model-picker-app-icon { width: 30px; height: 30px; flex: 0 0 30px; }
            .gpt-model-picker-app-icon svg { display: block; width: 100%; height: 100%; }
            .gpt-model-picker-title-copy { min-width: 0; }
            .gpt-model-picker-title {
                overflow: hidden; color: #f2f5f8; font-size: 12px; font-weight: 700; line-height: 1.15;
                text-overflow: ellipsis; white-space: nowrap;
            }
            .gpt-model-picker-version {
                margin-top: 2px; overflow: hidden; color: #aeb2b6; font-size: 9px; line-height: 1.1;
                text-overflow: ellipsis; white-space: nowrap;
            }
            .gpt-model-picker-collapse {
                display: grid; width: 26px; height: 26px; flex: 0 0 26px; place-items: center; padding: 0;
                color: #dce2e8; background: transparent; border: 1px solid transparent; border-radius: 6px;
                font: 700 16px/1 Arial, sans-serif; cursor: pointer;
            }
            .gpt-model-picker-collapse:hover { background: #283f4d; border-color: #34404b; }
            .gpt-model-picker-content {
                display: flex; min-height: 0; flex: 1 1 auto; flex-direction: column; gap: 5px;
                box-sizing: border-box; padding: 7px; overflow: hidden;
            }
            .gpt-model-picker-field { display: grid; flex: 0 0 auto; gap: 2px; min-width: 0; }
            .gpt-model-picker-field-label { color: #aeb2b6; font-size: 9px; }
            .gpt-model-picker-select, .gpt-model-picker-input {
                width: 100%; min-height: 28px; box-sizing: border-box; padding: 4px 6px;
                color: #f2f5f8; background: #222732; border: 1px solid #34404b;
                border-radius: 6px; font: 10.5px/1.2 Arial, sans-serif;
            }
            .gpt-model-picker-toggles {
                display: grid; flex: 0 0 auto; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px;
            }
            .gpt-model-picker-bypass { flex: 0 0 auto; }
            .gpt-model-picker-signals-button {
                grid-column: 1 / -1; min-height: 27px; box-sizing: border-box; padding: 3px 7px;
                color: #f2f5f8; background: #1d232a; border: 1px solid #2a323b;
                border-radius: 6px; font: 10.5px/1.2 Arial, sans-serif; cursor: pointer;
            }
            .gpt-model-picker-signals-button:hover { background: #25313b; border-color: #34404b; }
            .gpt-model-picker-signals-window {
                position: fixed; right: 360px; bottom: 16px; z-index: 2147483647;
                width: min(860px, calc(100vw - 392px)); max-height: calc(100vh - 32px); box-sizing: border-box;
                color: #f2f5f8; background: #111418; border: 1px solid #34404b; border-radius: 10px;
                box-shadow: 0 10px 32px rgb(0 0 0 / 38%); font: 11px/1.3 Arial, sans-serif;
            }
            .gpt-model-picker-signals-window[hidden] { display: none; }
            .gpt-model-picker-signals-header {
                display: flex; min-height: 38px; align-items: center; justify-content: space-between;
                gap: 8px; box-sizing: border-box; padding: 6px 8px; touch-action: none; user-select: none;
                background: #252d36; border-bottom: 1px solid #34404b; cursor: grab;
            }
            .gpt-model-picker-signals-header.is-dragging { cursor: grabbing; }
            .gpt-model-picker-signals-title { font-size: 12px; font-weight: 700; }
            .gpt-model-picker-signals-close {
                display: grid; width: 26px; height: 26px; place-items: center; padding: 0;
                color: #dce2e8; background: transparent; border: 1px solid transparent; border-radius: 6px;
                font: 700 16px/1 Arial, sans-serif; cursor: pointer;
            }
            .gpt-model-picker-signals-close:hover { background: #283f4d; border-color: #34404b; }
            .gpt-model-picker-signals-rows { display: grid; gap: 4px; padding: 8px; }
            .gpt-model-picker-override-heading, .gpt-model-picker-override-row {
                display: grid; grid-template-columns: minmax(176px, 1fr) 126px minmax(186px, 1fr) minmax(238px, 1.2fr); gap: 5px;
                align-items: center;
            }
            .gpt-model-picker-override-heading { color: #aeb2b6; font-size: 9px; font-weight: 700; }
            .gpt-model-picker-override-label {
                overflow: hidden; color: #aeb2b6; font-size: 10px; text-overflow: ellipsis; white-space: nowrap;
            }
            .gpt-model-picker-override-mode, .gpt-model-picker-override-value, .gpt-model-picker-override-applied {
                width: 100%; min-height: 26px; box-sizing: border-box; padding: 4px 6px;
                color: #f2f5f8; background: #222732; border: 1px solid #34404b;
                border-radius: 5px; font: 10px/1.2 Arial, sans-serif;
            }
            .gpt-model-picker-override-value:disabled { color: #747b84; opacity: 0.8; }
            .gpt-model-picker-override-applied { color: #c7ccd1; background: #171c23; }
            .gpt-model-picker-override-applied.is-error { color: #e16b6b; border-color: #763f3f; }
            .gpt-model-picker-overrides-status { padding: 0 8px 8px; font-size: 9px; white-space: pre-line; }
            .gpt-model-picker-overrides-status[data-status-type='success'] { color: #45c97a; }
            .gpt-model-picker-overrides-status[data-status-type='warning'] { color: #e3a12f; }
            .gpt-model-picker-overrides-status[data-status-type='error'] { color: #e16b6b; }
            .gpt-model-picker-unlocked-send {
                pointer-events: auto !important; cursor: pointer !important; opacity: 1 !important;
            }
            .gpt-model-picker-toggle {
                display: flex; min-width: 0; min-height: 27px; align-items: center; gap: 6px; box-sizing: border-box;
                padding: 3px 5px; color: #f2f5f8; background: #1d232a; border: 1px solid #2a323b;
                border-radius: 6px; cursor: pointer; user-select: none;
            }
            .gpt-model-picker-toggle span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            #gpt-model-picker-panel input.gpt-model-picker-checkbox {
                display: inline-block !important; width: 14px !important; height: 14px !important;
                flex: 0 0 14px !important; margin: 0 !important; padding: 0 !important;
                appearance: auto !important; -webkit-appearance: checkbox !important;
                position: static !important; visibility: visible !important; opacity: 1 !important;
                accent-color: #69afed !important; cursor: pointer;
            }
            .gpt-model-picker-diagnostics {
                display: grid; min-height: 0; flex: 1 1 auto; align-content: start; gap: 2px; box-sizing: border-box;
                padding: 6px; overflow: hidden; background: #0b0e11; border: 1px solid #2a323b; border-radius: 6px;
                font-size: 9.5px; line-height: 1.25;
            }
            .gpt-model-picker-status { color: #c7ccd1; word-break: break-word; white-space: pre-line; }
            .gpt-model-picker-status[data-status-type='success'] { color: #45c97a; }
            .gpt-model-picker-status[data-status-type='warning'] { color: #e3a12f; }
            .gpt-model-picker-status[data-status-type='error'] { color: #e16b6b; }
            .gpt-model-picker-hint {
                flex: 0 0 auto; color: #8d949c; font-size: 9px; line-height: 1.2;
            }
        `;

        document.head.append(style);
    }
    /** Останавливает наблюдатели, возвращает исходный fetch и удаляет панель. */
    function stop() {
        state.stopped = true;
        window.removeEventListener('resize', handleWindowResize);

        if (state.hookTimer !== null) {
            window.clearInterval(state.hookTimer);
            state.hookTimer = null;
        }

        if (state.resizeObserver) {
            state.resizeObserver.disconnect();
            state.resizeObserver = null;
        }

        if (state.navigationMenuObserver) {
            state.navigationMenuObserver.disconnect();
            state.navigationMenuObserver = null;
        }

        removeNavigationLinks();
        removeSendUnlockGuard();

        const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');

        if (descriptor?.get === getGuardedFetch && descriptor?.set === setGuardedFetch) {
            Object.defineProperty(window, 'fetch', {
                configurable: state.originalFetchDescriptor?.configurable ?? true,
                enumerable: state.originalFetchDescriptor?.enumerable ?? true,
                writable: state.originalFetchDescriptor?.writable ?? true,
                value: state.downstreamFetch
            });
        }

        state.fetchGuardInstalled = false;

        state.panel?.remove();
        state.backendOverridesWindow?.remove();
        document.querySelector('#gpt-model-picker-styles')?.remove();
    }

    /** Запускает панель, наблюдение меню навигации, перехват запросов и контроль window.fetch. */
    function start() {
        if (!(document.body instanceof HTMLElement)) {
            return;
        }

        localStorage.removeItem('gpt-model-picker.unlock-send.v1');
        addStyles();
        createPanel();
        observeNavigationLinks();
        installFetchGuard();
        installSendUnlockGuard();
        state.hookTimer = window.setInterval(() => {
            restoreHook();
            sweepComposerUnlock();
        }, config.hookCheckIntervalMs);
        loadModels();
    }

    window[GLOBAL_KEY] = {
        config,
        state,
        start,
        stop,
        loadModels,
        setSelectedModel,
        setSelectedThinkingEffort,
        setBypassEnabled,
        setFastModeEnabled,
        setForceChatEnabled,
        neutralizeRateLimits,
        rewriteLimitedResponse,
        updateConversationBody,
        restoreHook,
        historicalModels,
        experimentalApiModels
    };

    start();
})();
