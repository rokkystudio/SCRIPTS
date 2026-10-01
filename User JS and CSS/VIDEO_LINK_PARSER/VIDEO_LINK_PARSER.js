(() => {
    if (window.__videoLinkParser) {
        window.__videoLinkParser.showButton();
        window.__videoLinkParser.log("VideoLinkParser уже установлен");
        return;
    }

    /**
     * Возвращает абсолютный URL из строки, URL или Request-подобного объекта.
     *
     * @param {string|URL|Request|any} input Значение с URL.
     * @returns {string|null} Абсолютный URL или null.
     */
    function toAbsoluteUrl(input) {
        try {
            if (!input) {
                return null;
            }

            if (typeof input === "string") {
                return new URL(input, location.href).href;
            }

            if (input instanceof URL) {
                return input.href;
            }

            if (typeof input.url === "string") {
                return new URL(input.url, location.href).href;
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    /**
     * Возвращает текущее время в формате HH:mm:ss.
     *
     * @returns {string} Текущее время.
     */
    function nowTime() {
        const date = new Date();

        return [
            String(date.getHours()).padStart(2, "0"),
            String(date.getMinutes()).padStart(2, "0"),
            String(date.getSeconds()).padStart(2, "0")
        ].join(":");
    }

    /**
     * Создаёт DOM-элемент с классом и текстом.
     *
     * @param {string} tag Имя тега.
     * @param {string} className CSS-класс.
     * @param {string} text Текст элемента.
     * @returns {HTMLElement} Созданный элемент.
     */
    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text != null) {
            element.textContent = text;
        }

        return element;
    }

    /**
     * Возвращает тип ссылки для отображения.
     *
     * @param {string} url URL ресурса.
     * @param {string|null} contentType Content-Type ответа.
     * @returns {string} Тип ресурса.
     */
    function detectLinkType(url, contentType) {
        const normalizedUrl = String(url || "").toLowerCase();
        const normalizedContentType = String(contentType || "").toLowerCase();

        if (normalizedUrl.startsWith("blob:")) {
            return "blob";
        }

        if (normalizedUrl.includes(".mp4")) {
            return "mp4";
        }

        if (normalizedUrl.includes(".m3u8") || normalizedContentType.includes("mpegurl")) {
            return "m3u8";
        }

        if (normalizedUrl.includes(".mpd") || normalizedContentType.includes("dash+xml")) {
            return "mpd";
        }

        if (normalizedContentType.includes("video/")) {
            return "video";
        }

        return "other";
    }

    /**
     * Проверяет, относится ли URL или content-type к видео-ресурсу.
     *
     * @param {string|null} url URL ресурса.
     * @param {string|null} contentType Content-Type ответа.
     * @returns {boolean} Признак видео-ресурса.
     */
    function isVideoLike(url, contentType) {
        const type = detectLinkType(url, contentType);

        return type === "blob" ||
            type === "mp4" ||
            type === "m3u8" ||
            type === "mpd" ||
            type === "video";
    }

    /**
     * Отладчик ссылок на видео.
     */
    const VideoLinkParser = {
        panel: null,
        header: null,
        linksBox: null,
        logsBox: null,
        statusBox: null,
        titleBox: null,
        links: new Map(),
        logs: [],
        blobSourceUrlMap: new WeakMap(),
        blobObjectUrlMap: new Map(),
        installed: false,
        wbPatchTimer: null,
        domScanTimer: null,
        resourceScanTimer: null,
        resizeObserver: null,
        originalBodyPaddingTop: "",
        originalScrollPaddingTop: "",
        original: {
            fetch: window.fetch,
            xhrOpen: XMLHttpRequest.prototype.open,
            xhrSend: XMLHttpRequest.prototype.send,
            createObjectURL: URL.createObjectURL,
            revokeObjectURL: URL.revokeObjectURL,
            setAttribute: Element.prototype.setAttribute
        },

        /**
         * Инициализирует панель и перехватчики.
         */
        init() {
            if (this.installed) {
                return;
            }

            this.originalBodyPaddingTop = document.body ? document.body.style.paddingTop : "";
            this.originalScrollPaddingTop = document.documentElement ? document.documentElement.style.scrollPaddingTop : "";

            this.createPanel();
            this.installFetchInterceptor();
            this.installXhrInterceptor();
            this.installBlobInterceptor();
            this.installMediaInterceptor();
            this.installVideoJsInterceptor();
            this.installWbInterceptor();
            this.installScrollIsolation();
            this.installLayoutSync();
            this.scanPerformanceResources();
            this.scanDomForVideos();

            this.resourceScanTimer = setInterval(() => {
                this.scanPerformanceResources();
            }, 3000);

            this.domScanTimer = setInterval(() => {
                this.scanDomForVideos();
            }, 1500);

            this.installed = true;
            this.log("VideoLinkParser установлен");
            this.updateStatus();
            this.showButton();
        },

        /**
         * Создаёт панель вывода.
         */
        createPanel() {
            const root = document.createElement("div");
            root.id = "video-link-parser-root";
            root.classList.add("video-link-parser-collapsed");

            const header = document.createElement("div");
            header.id = "video-link-parser-header";
            header.title = "Показать / скрыть панель";

            const title = createElement("div", "", "VIDEO LINK PARSER");
            title.id = "video-link-parser-title";

            const status = createElement("div", "", "0 video links");
            status.id = "video-link-parser-status";
            this.statusBox = status;
            this.titleBox = title;

            const actions = document.createElement("div");
            actions.id = "video-link-parser-actions";

            const copyVideoLinksButton = createElement("button", "", "Copy video links");
            copyVideoLinksButton.addEventListener("click", async event => {
                event.stopPropagation();
                await this.copyOnlyVideoLinks();
            });

            const copyAllButton = createElement("button", "", "Copy all");
            copyAllButton.addEventListener("click", async event => {
                event.stopPropagation();
                await this.copyAllLinks();
            });

            const scanButton = createElement("button", "", "Scan now");
            scanButton.addEventListener("click", event => {
                event.stopPropagation();
                this.scanPerformanceResources();
                this.scanDomForVideos();
                this.log("Запущен ручной скан");
            });

            const collapseButton = createElement("button", "", "Minimize");
            collapseButton.addEventListener("click", event => {
                event.stopPropagation();
                this.togglePanel();
            });

            const clearLogsButton = createElement("button", "", "Clear logs");
            clearLogsButton.addEventListener("click", event => {
                event.stopPropagation();
                this.logs = [];
                this.renderLogs();
            });

            const clearLinksButton = createElement("button", "", "Clear links");
            clearLinksButton.addEventListener("click", event => {
                event.stopPropagation();
                this.links.clear();
                this.renderLinks();
                this.updateStatus();
            });

            actions.appendChild(copyVideoLinksButton);
            actions.appendChild(copyAllButton);
            actions.appendChild(scanButton);
            actions.appendChild(collapseButton);
            actions.appendChild(clearLogsButton);
            actions.appendChild(clearLinksButton);

            header.appendChild(title);
            header.appendChild(status);
            header.appendChild(actions);

            header.addEventListener("click", () => {
                this.togglePanel();
            });

            const body = document.createElement("div");
            body.id = "video-link-parser-body";

            const linksCol = createElement("div", "video-link-parser-col");
            const logsCol = createElement("div", "video-link-parser-col");

            const linksHeader = createElement("div", "video-link-parser-col-header", "Найденные ссылки");
            const logsHeader = createElement("div", "video-link-parser-col-header", "Логи");

            const linksList = createElement("div", "video-link-parser-list");
            const logsList = createElement("div", "video-link-parser-list");

            linksCol.appendChild(linksHeader);
            linksCol.appendChild(linksList);

            logsCol.appendChild(logsHeader);
            logsCol.appendChild(logsList);

            body.appendChild(linksCol);
            body.appendChild(logsCol);

            root.appendChild(header);
            root.appendChild(body);

            document.documentElement.appendChild(root);

            this.panel = root;
            this.header = header;
            this.linksBox = linksList;
            this.logsBox = logsList;
        },

        /**
         * Переключает состояние панели.
         */
        togglePanel() {
            if (!this.panel) {
                return;
            }

            this.panel.classList.toggle("video-link-parser-collapsed");
            this.syncPageOffset();
            this.updateStatus();
        },

        /**
         * Переводит панель в свернутый режим.
         */
        showButton() {
            if (!this.panel) {
                return;
            }

            this.panel.style.display = "";
            this.panel.classList.add("video-link-parser-collapsed");
            this.syncPageOffset();
            this.updateStatus();
        },

        /**
         * Показывает панель в развернутом виде.
         */
        showPanel() {
            if (!this.panel) {
                return;
            }

            this.panel.style.display = "";
            this.panel.classList.remove("video-link-parser-collapsed");
            this.syncPageOffset();
            this.updateStatus();
        },

        /**
         * Обновляет отступ сайта под панелью.
         */
        syncPageOffset() {
            if (!this.panel) {
                return;
            }

            const isCollapsed = this.panel.classList.contains("video-link-parser-collapsed");
            const panelHeight = isCollapsed
                ? 0
                : Math.ceil(this.panel.getBoundingClientRect().height || 320);

            document.documentElement.style.setProperty("--video-link-parser-page-offset", `${panelHeight}px`);
            document.documentElement.style.scrollPaddingTop = panelHeight ? `${panelHeight + 8}px` : this.originalScrollPaddingTop;
            document.body.style.paddingTop = panelHeight ? `${panelHeight}px` : this.originalBodyPaddingTop;
        },

        /**
         * Поддерживает отступ страницы синхронно с высотой панели.
         */
        installLayoutSync() {
            this.syncPageOffset();

            window.addEventListener("resize", () => {
                this.syncPageOffset();
            });

            if ("ResizeObserver" in window) {
                this.resizeObserver = new ResizeObserver(() => {
                    this.syncPageOffset();
                });

                this.resizeObserver.observe(this.panel);
            }
        },

        /**
         * Изолирует прокрутку панели от сайта.
         */
        installScrollIsolation() {
            if (!this.panel) {
                return;
            }

            const preventOuterScroll = event => {
                const node = event.currentTarget;
                const canScroll = node.scrollHeight > node.clientHeight;

                if (!canScroll) {
                    event.preventDefault();
                    return;
                }

                const delta = event.deltaY;
                const atTop = node.scrollTop <= 0;
                const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;

                if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
                    event.preventDefault();
                }

                event.stopPropagation();
            };

            this.panel.querySelectorAll(".video-link-parser-col").forEach(node => {
                node.addEventListener("wheel", preventOuterScroll, { passive: false });
                node.addEventListener("touchmove", event => {
                    event.stopPropagation();
                }, { passive: true });
            });
        },

        /**
         * Добавляет сообщение в лог и консоль.
         *
         * @param {string} message Текст сообщения.
         */
        log(message) {
            const entry = `[${nowTime()}] ${message}`;
            this.logs.unshift(entry);

            if (this.logs.length > 400) {
                this.logs.length = 400;
            }

            console.log("[VideoLinkParser]", message);
            this.renderLogs();
        },

        /**
         * Отрисовывает лог.
         */
        renderLogs() {
            if (!this.logsBox) {
                return;
            }

            this.logsBox.innerHTML = "";

            for (const entry of this.logs) {
                const item = createElement("div", "video-link-parser-log");
                const time = createElement("span", "video-link-parser-log-time", entry.slice(0, 10));
                const text = document.createTextNode(entry.slice(10));

                item.appendChild(time);
                item.appendChild(text);
                this.logsBox.appendChild(item);
            }
        },

        /**
         * Добавляет ссылку в список найденных ресурсов.
         *
         * @param {string} url Ссылка на ресурс.
         * @param {string} source Источник обнаружения.
         * @param {object} meta Дополнительные данные.
         */
        addLink(url, source, meta = {}) {
            const normalizedUrl = String(url || "").trim();

            if (!normalizedUrl) {
                return;
            }

            const type = meta.type || detectLinkType(normalizedUrl, meta.contentType || "");
            const existing = this.links.get(normalizedUrl);

            if (existing) {
                existing.lastSeenAt = nowTime();
                existing.sources.add(source);

                if (meta.note) {
                    existing.notes.add(meta.note);
                }

                if (meta.resolvedFrom && !existing.resolvedFrom) {
                    existing.resolvedFrom = meta.resolvedFrom;
                }

                this.renderLinks();
                this.updateStatus();
                return;
            }

            this.links.set(normalizedUrl, {
                url: normalizedUrl,
                type: type,
                firstSeenAt: nowTime(),
                lastSeenAt: nowTime(),
                sources: new Set([source]),
                notes: new Set(meta.note ? [meta.note] : []),
                resolvedFrom: meta.resolvedFrom || ""
            });

            this.log(`Найдена ссылка [${source}]: ${normalizedUrl}`);
            this.renderLinks();
            this.updateStatus();
        },

        /**
         * Обновляет количество найденных ссылок.
         */
        updateStatus() {
            if (!this.statusBox) {
                return;
            }

            const videoCount = Array.from(this.links.values()).filter(item => {
                return item.type === "mp4" ||
                    item.type === "m3u8" ||
                    item.type === "mpd" ||
                    item.type === "video" ||
                    item.type === "blob";
            }).length;

            this.statusBox.textContent = `${videoCount} video links`;

            if (this.titleBox) {
                this.titleBox.textContent = this.panel && this.panel.classList.contains("video-link-parser-collapsed")
                    ? `VIDEO LINK PARSER (${videoCount})`
                    : "VIDEO LINK PARSER";
            }
        },

        /**
         * Создаёт DOM-элемент карточки ссылки.
         *
         * @param {object} item Описание ссылки.
         * @returns {HTMLElement} Карточка ссылки.
         */
        createLinkCard(item) {
            const row = createElement("div", "video-link-parser-item");

            const title = createElement("div", "video-link-parser-item-title", item.type || "link");
            const meta = createElement(
                "div",
                "video-link-parser-item-meta",
                `sources: ${Array.from(item.sources).join(", ")} | first: ${item.firstSeenAt} | last: ${item.lastSeenAt}`
            );
            const url = createElement("div", "video-link-parser-item-url", item.url);

            row.appendChild(title);
            row.appendChild(meta);
            row.appendChild(url);

            if (item.resolvedFrom) {
                row.appendChild(
                    createElement("div", "video-link-parser-item-meta", `resolved from: ${item.resolvedFrom}`)
                );
            }

            if (item.notes.size) {
                row.appendChild(
                    createElement("div", "video-link-parser-item-meta", `notes: ${Array.from(item.notes).join(" | ")}`)
                );
            }

            const actions = createElement("div", "video-link-parser-item-actions");

            const openLink = document.createElement("a");
            openLink.href = item.url;
            openLink.target = "_blank";
            openLink.rel = "noopener noreferrer";
            openLink.textContent = "Open";

            const downloadLink = document.createElement("a");
            downloadLink.href = item.url;
            downloadLink.target = "_blank";
            downloadLink.rel = "noopener noreferrer";
            downloadLink.download = "";
            downloadLink.textContent = item.url.startsWith("blob:") ? "Download blob" : "Download";

            const copyButton = createElement("button", "", "Copy");
            copyButton.addEventListener("click", async() => {
                await navigator.clipboard.writeText(item.url);
                this.log(`Скопирована ссылка: ${item.url}`);
            });

            actions.appendChild(openLink);
            actions.appendChild(downloadLink);
            actions.appendChild(copyButton);

            row.appendChild(actions);

            return row;
        },

        /**
         * Отрисовывает список найденных ссылок.
         */
        renderLinks() {
            if (!this.linksBox) {
                return;
            }

            this.linksBox.innerHTML = "";

            const videoItems = Array.from(this.links.values()).sort((a, b) => {
                const order = { mp4: 1, m3u8: 2, mpd: 3, video: 4, blob: 5, other: 6 };
                const aOrder = order[a.type] || 99;
                const bOrder = order[b.type] || 99;

                if (aOrder !== bOrder) {
                    return aOrder - bOrder;
                }

                return a.url.localeCompare(b.url);
            });

            if (videoItems.length) {
                this.linksBox.appendChild(createElement("div", "video-link-parser-group-title", "Video links"));

                for (const item of videoItems) {
                    this.linksBox.appendChild(this.createLinkCard(item));
                }
            }
        },

        /**
         * Копирует все найденные ссылки.
         */
        async copyAllLinks() {
            const all = Array.from(this.links.keys()).join("\n");

            if (!all) {
                this.log("Список ссылок пуст");
                return;
            }

            await navigator.clipboard.writeText(all);
            this.log(`Скопированы все ссылки: ${this.links.size}`);
        },

        /**
         * Копирует только видео-ссылки.
         */
        async copyOnlyVideoLinks() {
            const text = Array.from(this.links.values())
                .filter(item => item.type !== "other")
                .map(item => item.url)
                .join("\n");

            if (!text) {
                this.log("Видео-ссылки не найдены");
                return;
            }

            await navigator.clipboard.writeText(text);
            this.log(`Скопированы video links: ${this.links.size}`);
        },

        /**
         * Сохраняет связь между Blob и исходным URL.
         *
         * @param {Blob} blob Blob-объект.
         * @param {string|null} sourceUrl URL источника.
         */
        rememberBlobSource(blob, sourceUrl) {
            if (!(blob instanceof Blob)) {
                return;
            }

            if (!sourceUrl) {
                return;
            }

            this.blobSourceUrlMap.set(blob, sourceUrl);
            this.log(`Запомнен blob source: ${sourceUrl}`);
        },

        /**
         * Регистрирует перехват fetch.
         */
        installFetchInterceptor() {
            if (typeof this.original.fetch !== "function") {
                return;
            }

            const self = this;

            window.fetch = async function(input, init) {
                const requestUrl = toAbsoluteUrl(input);
                const response = await self.original.fetch.call(this, input, init);

                try {
                    const responseUrl = response.url || requestUrl;
                    const contentType = response.headers && response.headers.get
                        ? response.headers.get("content-type")
                        : "";

                    if (isVideoLike(responseUrl, contentType)) {
                        self.addLink(responseUrl, "fetch", {
                            type: detectLinkType(responseUrl, contentType),
                            contentType: contentType
                        });
                    }

                    const originalBlob = response.blob.bind(response);

                    response.blob = async function() {
                        const blob = await originalBlob();
                        self.rememberBlobSource(blob, responseUrl || requestUrl || null);

                        if (responseUrl && isVideoLike(responseUrl, contentType)) {
                            self.addLink(responseUrl, "fetch.blob", {
                                type: detectLinkType(responseUrl, contentType),
                                contentType: contentType
                            });
                        }

                        return blob;
                    };
                } catch (error) {
                    self.log(`fetch interceptor error: ${error && error.message ? error.message : error}`);
                }

                return response;
            };

            this.log("Установлен fetch interceptor");
        },

        /**
         * Регистрирует перехват XMLHttpRequest.
         */
        installXhrInterceptor() {
            const self = this;

            XMLHttpRequest.prototype.open = function(method, url) {
                this.__videoLinkParserRequestUrl = toAbsoluteUrl(url);
                return self.original.xhrOpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function() {
                if (!this.__videoLinkParserBound) {
                    this.__videoLinkParserBound = true;

                    this.addEventListener("readystatechange", function() {
                        try {
                            if (this.readyState !== 2 && this.readyState !== 4) {
                                return;
                            }

                            const responseUrl = this.responseURL || this.__videoLinkParserRequestUrl || null;
                            const contentType = this.getResponseHeader("content-type") || "";

                            if (isVideoLike(responseUrl, contentType)) {
                                self.addLink(responseUrl, "xhr", {
                                    type: detectLinkType(responseUrl, contentType),
                                    contentType: contentType
                                });
                            }
                        } catch (error) {
                            self.log(`xhr readystatechange error: ${error && error.message ? error.message : error}`);
                        }
                    });

                    this.addEventListener("loadend", function() {
                        try {
                            const responseUrl = this.responseURL || this.__videoLinkParserRequestUrl || null;
                            const contentType = this.getResponseHeader("content-type") || "";

                            if (this.responseType === "blob" && this.response instanceof Blob) {
                                self.rememberBlobSource(this.response, responseUrl);

                                if (responseUrl && isVideoLike(responseUrl, contentType)) {
                                    self.addLink(responseUrl, "xhr.blob", {
                                        type: detectLinkType(responseUrl, contentType),
                                        contentType: contentType
                                    });
                                }
                            }
                        } catch (error) {
                            self.log(`xhr loadend error: ${error && error.message ? error.message : error}`);
                        }
                    });
                }

                return self.original.xhrSend.apply(this, arguments);
            };

            this.log("Установлен xhr interceptor");
        },

        /**
         * Регистрирует перехват URL.createObjectURL и revokeObjectURL.
         */
        installBlobInterceptor() {
            const self = this;

            URL.createObjectURL = function(object) {
                const blobUrl = self.original.createObjectURL.call(this, object);

                try {
                    let sourceUrl = null;

                    if (object instanceof Blob) {
                        sourceUrl = self.blobSourceUrlMap.get(object) || null;
                    }

                    if (sourceUrl) {
                        self.blobObjectUrlMap.set(blobUrl, sourceUrl);
                        self.addLink(blobUrl, "createObjectURL", {
                            type: "blob",
                            resolvedFrom: sourceUrl,
                            note: "blob -> source mapped"
                        });
                        self.addLink(sourceUrl, "blob.source", {
                            type: detectLinkType(sourceUrl, "")
                        });
                    } else {
                        self.addLink(blobUrl, "createObjectURL", {
                            type: "blob"
                        });
                    }
                } catch (error) {
                    self.log(`createObjectURL error: ${error && error.message ? error.message : error}`);
                }

                return blobUrl;
            };

            if (typeof this.original.revokeObjectURL === "function") {
                URL.revokeObjectURL = function(url) {
                    self.blobObjectUrlMap.delete(String(url));
                    return self.original.revokeObjectURL.call(this, url);
                };
            }

            this.log("Установлен blob interceptor");
        },

        /**
         * Регистрирует перехват присваивания src у media-элементов.
         */
        installMediaInterceptor() {
            const self = this;

            const mediaDescriptors = [
                [HTMLMediaElement && HTMLMediaElement.prototype, "HTMLMediaElement.src"],
                [HTMLVideoElement && HTMLVideoElement.prototype, "HTMLVideoElement.src"]
            ];

            for (const [proto, label] of mediaDescriptors) {
                if (!proto) {
                    continue;
                }

                const descriptor = Object.getOwnPropertyDescriptor(proto, "src");

                if (!descriptor || typeof descriptor.set !== "function" || typeof descriptor.get !== "function") {
                    continue;
                }

                Object.defineProperty(proto, "src", {
                    configurable: true,
                    enumerable: descriptor.enumerable,
                    get: function() {
                        return descriptor.get.call(this);
                    },
                    set: function(value) {
                        const url = String(value || "");

                        if (url) {
                            self.addLink(url, label, {
                                type: detectLinkType(url, "")
                            });

                            if (url.startsWith("blob:")) {
                                const resolvedUrl = self.blobObjectUrlMap.get(url);

                                if (resolvedUrl) {
                                    self.addLink(resolvedUrl, "blob.resolved", {
                                        type: detectLinkType(resolvedUrl, ""),
                                        resolvedFrom: url
                                    });
                                }
                            }
                        }

                        return descriptor.set.call(this, value);
                    }
                });

                break;
            }

            Element.prototype.setAttribute = function(name, value) {
                try {
                    if (
                        this &&
                        (this.tagName === "VIDEO" || this.tagName === "SOURCE") &&
                        String(name).toLowerCase() === "src"
                    ) {
                        const url = String(value || "");

                        if (url) {
                            self.addLink(url, `${this.tagName.toLowerCase()}.setAttribute`, {
                                type: detectLinkType(url, "")
                            });
                        }
                    }
                } catch (error) {
                    self.log(`setAttribute interceptor error: ${error && error.message ? error.message : error}`);
                }

                return self.original.setAttribute.apply(this, arguments);
            };

            document.addEventListener("play", event => {
                const element = event.target;

                if (!(element instanceof HTMLVideoElement)) {
                    return;
                }

                this.captureVideoElement(element, "play");
            }, true);

            document.addEventListener("loadedmetadata", event => {
                const element = event.target;

                if (!(element instanceof HTMLVideoElement)) {
                    return;
                }

                this.captureVideoElement(element, "loadedmetadata");
            }, true);

            this.log("Установлен media interceptor");
        },

        /**
         * Считывает ссылки из video-элемента и его source-элементов.
         *
         * @param {HTMLVideoElement} video Video-элемент.
         * @param {string} source Источник вызова.
         */
        captureVideoElement(video, source) {
            try {
                const urls = new Set();

                if (video.currentSrc) {
                    urls.add(video.currentSrc);
                }

                if (video.src) {
                    urls.add(video.src);
                }

                for (const node of video.querySelectorAll("source[src]")) {
                    if (node.src) {
                        urls.add(node.src);
                    }
                }

                urls.forEach(url => {
                    this.addLink(url, `video.${source}`, {
                        type: detectLinkType(url, "")
                    });

                    if (url.startsWith("blob:")) {
                        const resolvedUrl = this.blobObjectUrlMap.get(url);

                        if (resolvedUrl) {
                            this.addLink(resolvedUrl, "video.blob.resolved", {
                                type: detectLinkType(resolvedUrl, ""),
                                resolvedFrom: url
                            });
                        }
                    }
                });

                if (window.videojs && video.id && typeof window.videojs.getPlayer === "function") {
                    const player = window.videojs.getPlayer(video.id);

                    if (player) {
                        try {
                            const currentSource = typeof player.currentSource === "function"
                                ? player.currentSource()
                                : null;

                            if (currentSource && currentSource.src) {
                                this.addLink(currentSource.src, "videojs.currentSource", {
                                    type: detectLinkType(currentSource.src, currentSource.type || "")
                                });
                            }
                        } catch (error) {
                            this.log(`videojs currentSource error: ${error && error.message ? error.message : error}`);
                        }
                    }
                }
            } catch (error) {
                this.log(`captureVideoElement error: ${error && error.message ? error.message : error}`);
            }
        },

        /**
         * Регистрирует перехват методов video.js.
         */
        installVideoJsInterceptor() {
            const patch = () => {
                if (!window.videojs || window.videojs.__videoLinkParserPatched) {
                    return;
                }

                const originalVideoJs = window.videojs;
                const self = this;

                if (originalVideoJs.Player && originalVideoJs.Player.prototype) {
                    const proto = originalVideoJs.Player.prototype;

                    if (typeof proto.src === "function" && !proto.src.__videoLinkParserPatched) {
                        const originalSrc = proto.src;

                        proto.src = function(source) {
                            try {
                                if (typeof source === "string") {
                                    self.addLink(source, "videojs.src", {
                                        type: detectLinkType(source, "")
                                    });
                                } else if (source && typeof source.src === "string") {
                                    self.addLink(source.src, "videojs.src", {
                                        type: detectLinkType(source.src, source.type || "")
                                    });
                                } else if (Array.isArray(source)) {
                                    source.forEach(item => {
                                        if (item && typeof item.src === "string") {
                                            self.addLink(item.src, "videojs.src[]", {
                                                type: detectLinkType(item.src, item.type || "")
                                            });
                                        }
                                    });
                                }
                            } catch (error) {
                                self.log(`videojs src patch error: ${error && error.message ? error.message : error}`);
                            }

                            return originalSrc.apply(this, arguments);
                        };

                        proto.src.__videoLinkParserPatched = true;
                    }

                    if (typeof proto.currentSource === "function" && !proto.currentSource.__videoLinkParserWrapped) {
                        const originalCurrentSource = proto.currentSource;

                        proto.currentSource = function() {
                            const result = originalCurrentSource.apply(this, arguments);

                            try {
                                if (result && result.src) {
                                    self.addLink(result.src, "videojs.currentSource()", {
                                        type: detectLinkType(result.src, result.type || "")
                                    });
                                }
                            } catch (error) {
                                self.log(`videojs currentSource patch error: ${error && error.message ? error.message : error}`);
                            }

                            return result;
                        };

                        proto.currentSource.__videoLinkParserWrapped = true;
                    }
                }

                window.videojs.__videoLinkParserPatched = true;
                this.log("Установлен video.js interceptor");
            };

            patch();

            const timer = setInterval(() => {
                if (window.videojs && !window.videojs.__videoLinkParserPatched) {
                    patch();
                }

                if (window.videojs && window.videojs.__videoLinkParserPatched) {
                    clearInterval(timer);
                }
            }, 500);
        },

        /**
         * Регистрирует перехват методов wb.helpers.url Wildberries.
         */
        installWbInterceptor() {
            const patch = () => {
                const helpers = window.wb && window.wb.helpers;
                const urlHelpers = helpers && helpers.url;

                if (!urlHelpers) {
                    return false;
                }

                const methods = [
                    "urlVideoProduct",
                    "urlFeedbackVideo"
                ];

                methods.forEach(methodName => {
                    const method = urlHelpers[methodName];

                    if (typeof method !== "function" || method.__videoLinkParserPatched) {
                        return;
                    }

                    const self = this;

                    urlHelpers[methodName] = function() {
                        const result = method.apply(this, arguments);

                        try {
                            if (typeof result === "string") {
                                self.addLink(result, `wb.helpers.url.${methodName}`, {
                                    type: detectLinkType(result, "")
                                });
                            }
                        } catch (error) {
                            self.log(`WB helper patch error: ${error && error.message ? error.message : error}`);
                        }

                        return result;
                    };

                    urlHelpers[methodName].__videoLinkParserPatched = true;
                });

                this.log("Установлен WB interceptor");
                return true;
            };

            if (patch()) {
                return;
            }

            this.wbPatchTimer = setInterval(() => {
                if (patch()) {
                    clearInterval(this.wbPatchTimer);
                    this.wbPatchTimer = null;
                }
            }, 500);
        },

        /**
         * Сканирует performance resources и добавляет подходящие ресурсы.
         */
        scanPerformanceResources() {
            try {
                const entries = performance.getEntriesByType("resource");

                for (const entry of entries) {
                    const url = entry.name || "";

                    if (isVideoLike(url, "")) {
                        this.addLink(url, "performance", {
                            type: detectLinkType(url, "")
                        });
                    }
                }
            } catch (error) {
                this.log(`scanPerformanceResources error: ${error && error.message ? error.message : error}`);
            }
        },

        /**
         * Сканирует DOM и video.js плееры на странице.
         */
        scanDomForVideos() {
            try {
                document.querySelectorAll("video").forEach(video => {
                    this.captureVideoElement(video, "dom-scan");
                });

                document.querySelectorAll("source[src]").forEach(source => {
                    if (source.src) {
                        this.addLink(source.src, "source.dom-scan", {
                            type: detectLinkType(source.src, "")
                        });
                    }
                });

                if (window.videojs && typeof window.videojs.getPlayers === "function") {
                    const players = window.videojs.getPlayers();

                    Object.keys(players).forEach(key => {
                        const player = players[key];

                        if (!player) {
                            return;
                        }

                        try {
                            const currentSource = typeof player.currentSource === "function"
                                ? player.currentSource()
                                : null;

                            if (currentSource && currentSource.src) {
                                this.addLink(currentSource.src, "videojs.getPlayers", {
                                    type: detectLinkType(currentSource.src, currentSource.type || "")
                                });
                            }
                        } catch (error) {
                            this.log(`videojs.getPlayers scan error: ${error && error.message ? error.message : error}`);
                        }
                    });
                }
            } catch (error) {
                this.log(`scanDomForVideos error: ${error && error.message ? error.message : error}`);
            }
        },

        /**
         * Возвращает массив найденных video-ссылок.
         *
         * @returns {string[]} Найденные video-ссылки.
         */
        dump() {
            return Array.from(this.links.keys());
        },

        /**
         * Возвращает исходный URL для blob-ссылки.
         *
         * @param {string} blobUrl blob:-URL.
         * @returns {string|null} Исходный URL ресурса или null.
         */
        resolveBlob(blobUrl) {
            return this.blobObjectUrlMap.get(String(blobUrl || "")) || null;
        },

        /**
         * Останавливает интервалы и наблюдатели.
         */
        stop() {
            if (this.wbPatchTimer) {
                clearInterval(this.wbPatchTimer);
                this.wbPatchTimer = null;
            }

            if (this.domScanTimer) {
                clearInterval(this.domScanTimer);
                this.domScanTimer = null;
            }

            if (this.resourceScanTimer) {
                clearInterval(this.resourceScanTimer);
                this.resourceScanTimer = null;
            }

            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }

            this.log("Остановлены фоновые сканы");
        }
    };

    window.__videoLinkParser = VideoLinkParser;
    VideoLinkParser.init();
})();