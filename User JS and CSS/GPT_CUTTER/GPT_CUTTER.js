// GPT_CUTTER.js
(() => {
    'use strict';

    const GLOBAL_KEY = '__gptCutter';

    if (window[GLOBAL_KEY] && typeof window[GLOBAL_KEY].stop === 'function') {
        window[GLOBAL_KEY].stop();
    }

    const config = {
        /**
         * Интервал регулярной очистки DOM.
         */
        intervalMs: 300_000,

        /**
         * Задержка очистки после серии DOM-изменений.
         */
        mutationDebounceMs: 300,

        /**
         * Максимальная суммарная высота turn-элементов,
         * которую разрешено держать в DOM.
         */
        maxTurnPixels: 20_000,

        /**
         * Минимальное количество turn-элементов,
         * которое всегда остается в DOM.
         */
        minTurns: 4,

        /**
         * Очистка после DOM-изменений в SPA.
         */
        pruneOnMutation: true,

        /**
         * Логирование работы скрипта в консоль.
         */
        debug: false
    };

    const selectors = {
        /**
         * Возможные контейнеры вертикального скролла основного чата.
         */
        scrollRoot: [
            'main [data-scroll-root]',
            '[data-scroll-root]'
        ],

        /**
         * Возможные селекторы turn-элементов переписки.
         */
        turns: [
            'main section[data-testid^="conversation-turn-"]',
            '#thread section[data-testid^="conversation-turn-"]',
            'section[data-testid^="conversation-turn-"]'
        ]
    };

    const state = {
        intervalId: 0,
        mutationObserver: null,
        cleanupTimerId: 0,
        started: false
    };

    /**
     * Выводит диагностические сообщения при включенном debug-режиме.
     *
     * @param {...any} args
     */
    function log(...args) {
        if (!config.debug) {
            return;
        }

        console.debug('[GPT CUTTER]', ...args);
    }

    /**
     * Возвращает первый найденный элемент по списку селекторов.
     *
     * @param {string[]} candidates
     * @returns {Element | null}
     */
    function queryFirst(candidates) {
        for (const selector of candidates) {
            const element = document.querySelector(selector);

            if (element) {
                return element;
            }
        }

        return null;
    }

    /**
     * Возвращает контейнер прокрутки основного чата.
     *
     * @returns {HTMLElement | null}
     */
    function getScrollRoot() {
        const element = queryFirst(selectors.scrollRoot);

        if (!(element instanceof HTMLElement)) {
            return null;
        }

        return element;
    }

    /**
     * Возвращает turn-элементы переписки в порядке их расположения в DOM.
     *
     * Один turn-элемент соответствует одному сообщению пользователя
     * или одному сообщению ассистента.
     *
     * @returns {HTMLElement[]}
     */
    function getTurns() {
        const unique = new Set();

        for (const selector of selectors.turns) {
            const elements = document.querySelectorAll(selector);

            for (const element of elements) {
                if (element instanceof HTMLElement) {
                    unique.add(element);
                }
            }
        }

        const turns = Array.from(unique);

        turns.sort((left, right) => {
            if (left === right) {
                return 0;
            }

            const position = left.compareDocumentPosition(right);

            if (position & Node.DOCUMENT_POSITION_PRECEDING) {
                return 1;
            }

            return -1;
        });

        return turns;
    }

    /**
     * Возвращает высоту элемента вместе с вертикальными margin.
     *
     * @param {HTMLElement} element
     * @returns {number}
     */
    function getOuterHeight(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const marginTop = Number.parseFloat(style.marginTop) || 0;
        const marginBottom = Number.parseFloat(style.marginBottom) || 0;

        return rect.height + marginTop + marginBottom;
    }

    /**
     * Возвращает массив высот turn-элементов и их суммарную высоту.
     *
     * @param {HTMLElement[]} turns
     * @returns {{ heights: number[], totalHeight: number }}
     */
    function measureTurns(turns) {
        const heights = [];
        let totalHeight = 0;

        for (const turn of turns) {
            const height = getOuterHeight(turn);
            heights.push(height);
            totalHeight += height;
        }

        return {
            heights,
            totalHeight
        };
    }

    /**
     * Удаляет верхние turn-элементы до вхождения в лимит по суммарной высоте,
     * но сохраняет минимально допустимое количество последних сообщений.
     *
     * @param {string} reason
     */
    function cleanup(reason) {
        const scrollRoot = getScrollRoot();
        const turns = getTurns();
        const minTurns = Math.max(1, config.minTurns);
        const maxTurnPixels = Math.max(1, config.maxTurnPixels);

        if (!scrollRoot) {
            log('scroll root not found, skip cleanup', reason);
            return;
        }

        if (turns.length <= minTurns) {
            log('turn count is within minimum', { reason, turns: turns.length, minTurns });
            return;
        }

        const { heights, totalHeight } = measureTurns(turns);

        if (totalHeight <= maxTurnPixels) {
            log('turn height is within limit', {
                reason,
                turns: turns.length,
                totalHeight,
                maxTurnPixels
            });
            return;
        }

        const maxRemovableCount = Math.max(0, turns.length - minTurns);
        let removableCount = 0;
        let removedHeight = 0;
        let currentHeight = totalHeight;

        while (removableCount < maxRemovableCount && currentHeight > maxTurnPixels) {
            const nextHeight = heights[removableCount];
            removedHeight += nextHeight;
            currentHeight -= nextHeight;
            removableCount++;
        }

        if (removableCount <= 0) {
            log('nothing to remove', {
                reason,
                turns: turns.length,
                totalHeight,
                maxTurnPixels,
                minTurns
            });
            return;
        }

        const removableTurns = turns.slice(0, removableCount);
        const scrollTopBefore = scrollRoot.scrollTop;

        for (const turn of removableTurns) {
            turn.remove();
        }

        if (removedHeight > 0) {
            scrollRoot.scrollTop = Math.max(0, scrollTopBefore - removedHeight);
        }

        log('cleanup completed', {
            reason,
            removedTurns: removableTurns.length,
            turnsBefore: turns.length,
            turnsAfter: turns.length - removableTurns.length,
            totalHeightBefore: totalHeight,
            totalHeightAfter: currentHeight,
            removedHeight,
            maxTurnPixels,
            minTurns
        });
    }

    /**
     * Планирует отложенную очистку и объединяет частые вызовы в один.
     *
     * @param {string} reason
     * @param {number} delayMs
     */
    function scheduleCleanup(reason, delayMs) {
        window.clearTimeout(state.cleanupTimerId);

        state.cleanupTimerId = window.setTimeout(() => {
            cleanup(reason);
        }, delayMs);
    }

    /**
     * Проверяет, относится ли мутация к области чата.
     *
     * @param {MutationRecord[]} mutations
     * @returns {boolean}
     */
    function hasChatRelatedMutations(mutations) {
        for (const mutation of mutations) {
            const target = mutation.target;

            if (!(target instanceof Element)) {
                continue;
            }

            if (target.closest('main')) {
                return true;
            }

            for (const node of mutation.addedNodes) {
                if (node instanceof Element && node.closest('main')) {
                    return true;
                }
            }

            for (const node of mutation.removedNodes) {
                if (node instanceof Element && node.closest('main')) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Подключает наблюдение за изменениями DOM в SPA.
     *
     * Наблюдение запускает отложенную очистку после дорисовки контента,
     * чтобы в DOM оставалась только допустимая суммарная высота сообщений.
     */
    function startMutationObserver() {
        if (!config.pruneOnMutation) {
            return;
        }

        if (!(document.body instanceof HTMLElement)) {
            return;
        }

        state.mutationObserver = new MutationObserver((mutations) => {
            if (!hasChatRelatedMutations(mutations)) {
                return;
            }

            scheduleCleanup('mutation', config.mutationDebounceMs);
        });

        state.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Останавливает интервалы и наблюдатели текущего экземпляра скрипта.
     */
    function stop() {
        window.clearInterval(state.intervalId);
        window.clearTimeout(state.cleanupTimerId);

        if (state.mutationObserver) {
            state.mutationObserver.disconnect();
            state.mutationObserver = null;
        }

        state.started = false;
        log('stopped');
    }

    /**
     * Запускает регулярную и событийную очистку DOM.
     */
    function start() {
        if (state.started) {
            return;
        }

        state.started = true;

        scheduleCleanup('startup', 0);
        scheduleCleanup('startup-delayed', 1000);

        state.intervalId = window.setInterval(() => {
            cleanup('interval');
        }, config.intervalMs);

        startMutationObserver();

        log('started', config);
    }

    window[GLOBAL_KEY] = {
        config,
        start,
        stop,
        cleanup
    };

    start();
})();