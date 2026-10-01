(() => {
    const ROOT_SELECTOR = 'a[href^="javascript:"][onclick*="get_product_data_list_more"]';

    function runInlineOnclick(code, context)
    {
        if (!code) {
            return;
        }

        return Function(code).call(context || window);
    }

    function bindAction(target, onclickCode)
    {
        if (!target || target.dataset.prodActionBound === '1') {
            return;
        }

        target.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
            }

            runInlineOnclick(onclickCode, this);
        }, true);

        target.dataset.prodActionBound = '1';
    }

    function getNumericPx(value, fallback)
    {
        const number = parseFloat(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function bindProdTxt(prodTxt)
    {
        if (!prodTxt || prodTxt.dataset.prodTxtBound === '1') {
            return;
        }

        const text = (prodTxt.textContent || '').trim();
        const computed = window.getComputedStyle(prodTxt);
        const blockHeight = Math.max(prodTxt.offsetHeight || 30, 30);
        const fontSize = getNumericPx(computed.fontSize, 16);
        const lineHeight = computed.lineHeight === 'normal'
            ? Math.round(fontSize * 1.2)
            : getNumericPx(computed.lineHeight, Math.round(fontSize * 1.2));
        const verticalPadding = Math.max(Math.floor((blockHeight - lineHeight) / 2), 0);

        prodTxt.textContent = '';

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.readOnly = true;
        textarea.className = 'prod_txt_input';
        textarea.setAttribute('spellcheck', 'false');
        textarea.setAttribute('autocomplete', 'off');
        textarea.setAttribute('rows', '1');
        textarea.setAttribute('wrap', 'off');

        textarea.style.height = blockHeight + 'px';
        textarea.style.width = '200px';
        textarea.style.boxSizing = 'border-box';
        textarea.style.textAlign = 'center';
        textarea.style.display = 'block';
        textarea.style.margin = '0 auto';
        textarea.style.paddingTop = verticalPadding + 'px';
        textarea.style.paddingBottom = verticalPadding + 'px';
        textarea.style.paddingLeft = '0';
        textarea.style.paddingRight = '0';
        textarea.style.border = '0';
        textarea.style.outline = '0';
        textarea.style.background = 'transparent';
        textarea.style.boxShadow = 'none';
        textarea.style.resize = 'none';
        textarea.style.overflow = 'hidden';
        textarea.style.appearance = 'none';
        textarea.style.webkitAppearance = 'none';
        textarea.style.MozAppearance = 'none';
        textarea.style.font = 'inherit';
        textarea.style.fontFamily = 'inherit';
        textarea.style.fontSize = computed.fontSize;
        textarea.style.fontWeight = computed.fontWeight;
        textarea.style.fontStyle = computed.fontStyle;
        textarea.style.lineHeight = lineHeight + 'px';
        textarea.style.letterSpacing = computed.letterSpacing;
        textarea.style.textTransform = computed.textTransform;
        textarea.style.color = computed.color;
        textarea.style.whiteSpace = 'nowrap';
        textarea.style.wordBreak = 'normal';
        textarea.style.overflowWrap = 'normal';
        textarea.style.cursor = 'text';
        textarea.style.userSelect = 'text';
        textarea.style.webkitUserSelect = 'text';
        textarea.style.MozUserSelect = 'text';
        textarea.style.msUserSelect = 'text';

        textarea.addEventListener('click', function(e) {
            e.stopPropagation();
            this.select();
        }, true);

        textarea.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        }, true);

        textarea.addEventListener('mouseup', function(e) {
            e.stopPropagation();
        }, true);

        textarea.addEventListener('dblclick', function(e) {
            e.stopPropagation();
            this.select();
        }, true);

        textarea.addEventListener('focus', function() {
            this.select();
        });

        prodTxt.appendChild(textarea);
        prodTxt.dataset.prodTxtBound = '1';
    }

    function transformLink(link)
    {
        if (!link || link.dataset.prodLinkTransformed === '1') {
            return;
        }

        const onclickCode = link.getAttribute('onclick');
        const description = link.querySelector(':scope > .description');

        if (!onclickCode || !description) {
            return;
        }

        const prodDraw = description.querySelector('.prod_draw');
        const prodMore = description.querySelector('.prod_more');
        const prodTxt = description.querySelector('.prod_txt');

        const parent = link.parentNode;
        if (!parent) {
            return;
        }

        parent.insertBefore(description, link);
        link.remove();

        bindAction(prodDraw, onclickCode);
        bindAction(prodMore, onclickCode);
        bindProdTxt(prodTxt);

        description.dataset.prodLinkTransformed = '1';
    }

    function apply()
    {
        document.querySelectorAll(ROOT_SELECTOR).forEach(transformLink);
        document.querySelectorAll('.prod_txt').forEach(bindProdTxt);
    }

    const originalAppend = $.fn.append;
    $.fn.append = function() {
        const result = originalAppend.apply(this, arguments);
        apply();
        return result;
    };

    apply();
})();