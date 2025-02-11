




mw.lib.require('rangy');
 mw.lib.require('xss');

;(function (){
    var _filterXSS = function (html){
        var options = {
            onTagAttr: function (tag, name, value, isWhiteAttr) {
                var allow = ['class', 'id', 'target', 'title', 'alt', 'for', 'contenteditable'];
                if(!isWhiteAttr && (allow.includes(name) || name.indexOf('data-'))){
                    return name + '=' + value;
                }
            }
        };

        return (filterXSS(html, options)) ;
    };


    MWEditor.api = function (scope) {
        return {
            getSelection: function () {
                return scope.getSelection();
            },
            isPlainText: function(sel) {
                // in case one element is plain text all the elements in the selection are treated as plain text
                if(!sel) {
                    sel = scope.getSelection();
                }

                const anchorNode = scope.api.elementNode(sel.anchorNode);
                const focusNode = scope.api.elementNode(sel.focusNode);

                const isNativePlainText = mw.tools.firstMatchesOnNodeOrParent(anchorNode, '[contenteditable="plaintext-only"]') || mw.tools.firstParentOrCurrentWithClass(focusNode, '[contenteditable="plaintext-only"]');
                const isPlainClass = mw.tools.firstMatchesOnNodeOrParent(anchorNode, 'plain-text') || mw.tools.firstParentOrCurrentWithClass(focusNode, 'plain-text');

                if(isNativePlainText || isPlainClass) {
                    return true;
                }

                return false;

            },
            setCursorAtStart: function(target){
                var sel = scope.getSelection();
                if(!target) {
                    return
                }
                range = document.createRange();
                range.selectNodeContents(target);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            },
            eachRange: function (c){
                var sel = scope.getSelection();
                if(sel.rangeCount && c) {
                    for(var i = 0; i < sel.rangeCount; i++) {
                        var range = sel.getRangeAt(i);
                        c.call(scope, range);
                    }
                }
            },
            getSelectionHTML: function (){
                var sel = scope.getSelection();
                var html = scope.actionWindow.document.createElement('div');
                if(sel.rangeCount) {
                    var frag = sel.getRangeAt(0).cloneContents();
                    while (frag.firstChild) {
                        html.append(frag.firstChild);
                    }
                }
                return html.innerHTML;
            },
            cleanWord: function (content) {
                var wrapListRoots = function () {
                    var all = scope.$editArea.querySelectorAll('li[data-level]'), i = 0, has = false;
                    for (; i < all.length; i++) {
                        var parent = all[i].parentElement.nodeName;
                        if (parent !== 'OL' && parent !== 'UL') {
                            has = true;
                            var group = mw.$([]), curr = all[i];
                            while (!!curr && curr.nodeName === 'LI') {
                                group.push(curr);
                                curr = curr.nextElementSibling;
                            }
                            var el = scope.actionWindow.document.createElement(all[i].getAttribute('data-type') === 'ul' ? 'ul' : 'ol');
                            el.className = 'element';
                            group.wrapAll(el);
                            break;
                        }
                    }
                    if (has) return wrapListRoots();
                };

                var buildWordList = function (lists, count) {
                    var i, check = false, max = 0;
                    count = count || 0;
                    if (count === 0) {
                        for (i in lists) {
                            var curr = lists[i];
                            if (!curr.nodeName || curr.nodeType !== 1) continue;
                            var $curr = mw.$(curr);
                            lists[i] = mw.tools.setTag(curr, 'li');
                        }
                    }

                    lists.each(function () {
                        var num = this.textContent.trim().split('.')[0], check = parseInt(num, 10);
                        var curr = mw.$(this);
                        if (!curr.attr('data-type')) {
                            if (!isNaN(check) && num > 0) {
                                this.innerHTML = this.innerHTML.replace(num + '.', '');
                                curr.attr('data-type', 'ol');
                            }
                            else {
                                curr.attr('data-type', 'ul');
                            }
                        }
                        if (!this.__done) {
                            this.__done = false;
                            var level = parseInt($(this).attr('data-level'));
                            if (!isNaN(level) && level > max) {
                                max = level;
                            }
                            if (!isNaN(level) && level > 1) {
                                var prev = this.previousElementSibling;
                                if (!!prev && prev.nodeName === 'LI') {
                                    var type = this.getAttribute('data-type');
                                    var wrap = scope.actionWindow.document.createElement(type === 'ul' ? 'ul' : 'ol');
                                    wrap.setAttribute('data-level', level);
                                    mw.$(wrap).append(this);
                                    mw.$(wrap).appendTo(prev);
                                    check = true;
                                }
                                else if (!!prev && (prev.nodeName === 'UL' || prev.nodeName === 'OL')) {
                                    var where = mw.$('li[data-level="' + level + '"]', prev);
                                    if (where.length > 0) {
                                        where.after(this);
                                        check = true;
                                    }
                                    else {
                                        var type = this.getAttribute('data-type');
                                        var wrap = scope.actionWindow.document.createElement(type === 'ul' ? 'ul' : 'ol');
                                        wrap.setAttribute('data-level', level)
                                        mw.$(wrap).append(this);
                                        mw.$(wrap).appendTo($('li:last', prev))
                                        check = true;
                                    }
                                }
                                else if (!prev && (this.parentNode.nodeName !== 'UL' && this.parentNode.nodeName !== 'OL')) {
                                    var $curr = mw.$([this]), curr = this;
                                    while ($(curr).next('li[data-level="' + level + '"]').length > 0) {
                                        $curr.push($(curr).next('li[data-level="' + level + '"]')[0]);
                                        curr = mw.$(curr).next('li[data-level="' + level + '"]')[0];
                                    }
                                    $curr.wrapAll($curr.eq(0).attr('data-type') === 'ul' ? '<ul></ul>' : '<ol></ol>')
                                    check = true;
                                }
                            }
                        }
                    });

                    mw.$("ul[data-level!='1'], ol[data-level!='1']").each(function () {
                        var level = parseInt($(this).attr('data-level'));
                        if (!!this.previousElementSibling) {
                            var plevel = parseInt($(this.previousElementSibling).attr('data-level'));
                            if (level > plevel) {
                                mw.$('li:last', this.previousElementSibling).append(this)
                                check = true;
                            }
                        }
                    });
                    if (count === 0) {
                        setTimeout(function () {
                            buildWordList($('li[data-level]'), 1);
                            wrapListRoots();
                        }, 1);
                    }
                    return lists;
                };

                var word_listitem_get_level = function (item) {
                    var msspl = item.getAttribute('style').split('mso-list');
                    if (msspl.length > 1) {
                        var mssplitems = msspl[1].split(' ');
                        for (var i = 0; i < mssplitems.length; i++) {
                            if (mssplitems[i].indexOf('level') !== -1) {
                                return parseInt(mssplitems[i].split('level')[1], 10);
                            }
                        }
                    }
                };

                var isWordHtml = function (html) {
                    return html.indexOf('urn:schemas-microsoft-com:office:word') !== -1;
                };

                var _cleanWordList = function (html) {

                    if (!isWordHtml(html)) return html;
                    if (html.indexOf('</body>') !== -1) {
                        html = html.split('</body>')[0];
                    }
                    var parser = mw.tools.parseHtml(html).body;

                    var lists = mw.$('[style*="mso-list:"]', parser);
                    lists.each(function () {
                        var level = word_listitem_get_level(this);
                        if (!!level) {
                            this.setAttribute('data-level', level)
                            this.setAttribute('class', 'level-' + level)
                        }

                    });

                    mw.$('[style]', parser).removeAttr('style');

                    if (lists.length > 0) {
                        lists = buildWordList(lists);
                        var start = mw.$([]);
                        mw.$('li', parser).each(function () {
                            this.innerHTML = this.innerHTML

                                .replace(new RegExp(String.fromCharCode(160), "g"), "")
                                .replace(/&nbsp;/gi, '')

                                .replace(/<\/?span[^>]*>/g, "")

                        });
                    }
                    return parser.innerHTML;
                };

                var cleanWord = function (html) {
                    html = _cleanWordList(html);
                    html = html.replace(/<td([^>]*)>/gi, '<td>');
                    html = html.replace(/<table([^>]*)>/gi, '<table cellspacing="0" cellpadding="0" border="1" style="width:100%;" width="100%" class="element">');
                    html = html.replace(/<o:p>\s*<\/o:p>/g, '');
                    html = html.replace(/<o:p>[\s\S]*?<\/o:p>/g, '&nbsp;');
                    html = html.replace(/\s*mso-[^:]+:[^;"]+;?/gi, '');
                    html = html.replace(/\s*MARGIN: 0cm 0cm 0pt\s*;/gi, '');
                    html = html.replace(/\s*MARGIN: 0cm 0cm 0pt\s*"/gi, "\"");
                    html = html.replace(/\s*TEXT-INDENT: 0cm\s*;/gi, '');
                    html = html.replace(/\s*TEXT-INDENT: 0cm\s*"/gi, "\"");
                    html = html.replace(/\s*TEXT-ALIGN: [^\s;]+;?"/gi, "\"");
                    html = html.replace(/\s*PAGE-BREAK-BEFORE: [^\s;]+;?"/gi, "\"");
                    html = html.replace(/\s*FONT-VARIANT: [^\s;]+;?"/gi, "\"");
                    html = html.replace(/\s*tab-stops:[^;"]*;?/gi, '');
                    html = html.replace(/\s*tab-stops:[^"]*/gi, '');
                    html = html.replace(/\s*face="[^"]*"/gi, '');
                    html = html.replace(/\s*face=[^ >]*/gi, '');
                    html = html.replace(/\s*FONT-FAMILY:[^;"]*;?/gi, '');
                    html = html.replace(/<(\w[^>]*) class=([^ |>]*)([^>]*)/gi, "<$1$3");
                    html = html.replace(/<STYLE[^>]*>[\s\S]*?<\/STYLE[^>]*>/gi, '');
                    html = html.replace(/<(?:META|LINK)[^>]*>\s*/gi, '');
                    html = html.replace(/\s*style="\s*"/gi, '');
                    html = html.replace(/<SPAN\s*[^>]*>\s*&nbsp;\s*<\/SPAN>/gi, '&nbsp;');
                    html = html.replace(/<SPAN\s*[^>]*><\/SPAN>/gi, '');
                    html = html.replace(/<(\w[^>]*) lang=([^ |>]*)([^>]*)/gi, "<$1$3");
                    html = html.replace(/<SPAN\s*>([\s\S]*?)<\/SPAN>/gi, '$1');
                    html = html.replace(/<FONT\s*>([\s\S]*?)<\/FONT>/gi, '$1');
                    html = html.replace(/<\\?\?xml[^>]*>/gi, '');
                    html = html.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, '');
                    html = html.replace(/<\/?\w+:[^>]*>/gi, '');
                    html = html.replace(/<\!--[\s\S]*?-->/g, '');
                    html = html.replace(/<(U|I|STRIKE)>&nbsp;<\/\1>/g, '&nbsp;');
                    html = html.replace(/<H\d>\s*<\/H\d>/gi, '');
                    html = html.replace(/<(\w+)[^>]*\sstyle="[^"]*DISPLAY\s?:\s?none[\s\S]*?<\/\1>/ig, '');
                    html = html.replace(/<(\w[^>]*) language=([^ |>]*)([^>]*)/gi, "<$1$3");
                    html = html.replace(/<(\w[^>]*) onmouseover="([^\"]*)"([^>]*)/gi, "<$1$3");
                    html = html.replace(/<(\w[^>]*) onmouseout="([^\"]*)"([^>]*)/gi, "<$1$3");
                    html = html.replace(/<H(\d)([^>]*)>/gi, '<h$1>');
                    html = html.replace(/<font size=2>(.*)<\/font>/gi, '$1');
                    html = html.replace(/<font size=3>(.*)<\/font>/gi, '$1');
                    html = html.replace(/<a name=.*>(.*)<\/a>/gi, '$1');
                    html = html.replace(/<H1([^>]*)>/gi, '<H2$1>');
                    html = html.replace(/<\/H1\d>/gi, '<\/H2>');
                    //html = html.replace(/<span>/gi, '$1');
                    html = html.replace(/<\/span\d>/gi, '');
                    html = html.replace(/<(H\d)><FONT[^>]*>([\s\S]*?)<\/FONT><\/\1>/gi, '<$1>$2<\/$1>');
                    html = html.replace(/<(H\d)><EM>([\s\S]*?)<\/EM><\/\1>/gi, '<$1>$2<\/$1>');
                    return html;
                };

                var cleanTables = function (root) {
                    var toRemove = "tbody > *:not(tr), thead > *:not(tr), tr > *:not(td)",
                        all = root.querySelectorAll(toRemove),
                        l = all.length,
                        i = 0;
                    for (; i < l; i++) {
                        mw.$(all[i]).remove();
                    }
                    var tables = root.querySelectorAll('table'),
                        l = tables.length,
                        i = 0;
                    for (; i < l; i++) {
                        var item = tables[i],
                            l = item.children.length,
                            i = 0;
                        for (; i < l; i++) {
                            var item = item.children[i];
                            if (typeof item !== 'undefined' && item.nodeType !== 3) {
                                var name = item.nodeName.toLowerCase();
                                var posibles = "thead tfoot tr tbody col colgroup";
                                if (!posibles.contains(name)) {
                                    mw.$(item).remove();
                                }
                            }
                        }
                    }
                };
                return cleanWord(content)

            },
            _actionTimeout: null,
            _preactionTimeout: null,
            action: function(targetParent, func, recordTimeout) {
                if(recordTimeout) {
                    clearTimeout( scope.api._actionTimeout )
                }

                scope.api._actionTimeout = setTimeout(function(){
                scope.state.record({
                    target: targetParent,
                    value: targetParent.innerHTML
                });
                func.call();

                scope.state.record({
                    target: targetParent,
                    value: targetParent.innerHTML
                });
                    scope.dispatch('action');
                    scope.registerChange();
                }, (recordTimeout ? 600 : 78));
            },
            elementNode: function (c) {
                if( !c || !c.parentNode || c.parentNode === document.body ){
                    return null;
                }
                try {   /* Firefox returns wrong target (div) when you click on a spin-button */
                    if (typeof c.querySelector === 'function') {
                        return c;
                    }
                    else {
                        return scope.api.elementNode(c.parentNode);
                    }
                }
                catch (e) {
                    return null;
                }
            },
            fontFamily: function (font_name, sel) {
                var range = (sel || scope.getSelection()).getRangeAt(0);
                scope.api.execCommand("styleWithCSS", null, true);
                if (range.collapsed) {
                    var el = scope.api.elementNode(range.commonAncestorContainer);
                    scope.api.action(mw.tools.firstBlockLevel(el), function () {

                        mw.top().app.cssEditor.temp(el, 'font-family', font_name)
                    });

                }
                else {
                    scope.api.execCommand('fontName', null, font_name);
                }
            },
            selectAll: function (el) {
                var range = scope.document.createRange();
                range.selectNodeContents(el);
                var selection = scope.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            },
            selectElement: function (el) {
                var range = scope.document.createRange();
                try {
                    range.selectNode(el);
                    var selection = scope.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch (e) {

                }
            },
            targetSupportsFormatting: function (target) {
                var case1 = !!target && !!target.classList && !target.classList.contains('edit');
                var case2 = !!target.querySelector && !target.querySelector('table,tr,td,div,p,section,h1,h2,h3,h4,h5,h6,article,aside,figcaption,figure,footer,header,hgroup,main,nav');

                return  case1 && case2;
            },
            getFocusedNeighbours: function(focused) {
                var res = [focused];
                if(!focused) {
                    return res;
                }
                var next = focused.nextSibling;
                var prev = focused.previousSibling;

                var tags = ['a','abbr','acronym','b','bdo','big','br','button','cite','code','dfn','em','i','img','kbd','label','map','output','q','samp','small','span','strong','sub','sup','time','tt','var' ];

                while (next) {
                    if(next.nodeType === 3 || tags.indexOf(next.nodeName.toLowerCase()) !== -1) {
                        res.push(next);
                        next = next.nextSibling
                    } else{
                        break
                    }
                }
                while (prev) {
                    if(prev.nodeType === 3 || tags.indexOf(prev.nodeName.toLowerCase()) !== -1) {
                        res.unshift(prev);
                        prev = prev.previousSibling
                    } else{
                        break
                    }
                }

                return res;
            },
            isSelectionEditable: function (sel) {
                try {
                    var node = (sel || scope.getSelection()).focusNode;
                    if (node === null) {
                        return false;
                    }
                    if (node.nodeType === 1) {
                        return node.isContentEditable;
                    }
                    else {
                        return node.parentNode.isContentEditable;
                    }
                }
                catch (e) {
                    return false;
                }
            },
            getTextNodes: function (root, target){
                if(!target) target = [];
                var curr = root.firstChild;
                while (curr) {
                    if(curr.nodeType === 3) {
                        target.push(curr);
                    } else if(curr.nodeType === 1){
                        scope.api.getTextNodes(curr, target)
                    }
                    curr = curr.nextSibling;
                }
                return target;
            },
            classApplier: function (className) {
                var sel = scope.getSelection();
                var range = sel.getRangeAt(0);
                var frag = range.cloneContents();
                var nodes = scope.api.getTextNodes(frag).filter(function (node){ return !!node });
                nodes.forEach(function (node){
                    var el = scope.actionWindow.document.createElement('span');
                    el.className = 'mw-richtext-classApplier ' + className;
                    el.textContent = node.textContent;
                    node.parentNode.replaceChild(el, node);
                });
                range.deleteContents()
                range.insertNode(frag)
                scope.registerChange();
            },

            cleanApplier: function (){


                scope.api.saveSelection();
                var cl = () => {
                    var all = document.querySelectorAll('.mw-richtext-cssApplier');
                    for(var i = 0; i < all.length; i++) {
                        var a = all[i];
                        if(a.innerHTML === '') {
                            a.remove();
                            cl();
                            break;
                        } else if(a.parentNode.firstChild === a && a.parentNode.lastChild === a) {
                            var p = a.parentNode;
                            p.after(a);
                            p.remove();
                            cl();
                            break;

                        }
                    }
                }
                cl()
                scope.api.restoreSelection();
                scope.registerChange();
            },
            cssApplier: function (css) {
                var styles = '';
                if (typeof css === 'object') {
                    for (var i in css) {
                        styles += (i + ':' + css[i] + ';');
                    }
                } else if(typeof css === 'string') {
                    styles = css;
                }
                rangy.init();
                var clstemp = 'mw-font-size-' + mw.random();
                var classApplier = rangy.createClassApplier(clstemp, true);
                classApplier.applyToSelection(scope.actionWindow);

                var all = scope.actionWindow.document.querySelectorAll('.' + clstemp),
                    l = all.length,
                    i = 0;

                for ( ; i < l; i++ ) {
                    all[i].setAttribute('style', styles);
                     mw.tools.removeClass(all[i], clstemp);
                }
                scope.registerChange();
            },
            cssApplier2: function (css) {
                var styles = '';
                if (typeof css === 'object') {
                    for (var i in css) {
                        styles += (i + ':' + css[i] + ';');
                    }
                } else if(typeof css === 'string') {
                    styles = css;
                }
                var sel = scope.getSelection();
                var el = scope.api.elementNode(sel.focusNode);
                var range = sel.getRangeAt(0);
                var frag = range.cloneContents();
                var nodes = scope.api.getTextNodes(frag).filter(function (node){ return !!node });

                nodes.forEach(function (node){
                    var el = scope.actionWindow.document.createElement('span');
                    el.className = 'mw-richtext-cssApplier';
                    el.setAttribute('style', styles);
                    el.textContent = node.textContent;
                    node.parentNode.replaceChild(el, node);
                });
                range.deleteContents();
                range.insertNode(frag);
                scope.api.cleanApplier()
            },
            isSafeMode: function(el) {
                if (!el) {
                    var node = scope.getSelection().focusNode;
                    el = scope.api.elementNode(node);
                }
                var hasSafe = mw.tools.hasAnyOfClassesOnNodeOrParent(el, ['safe-mode']);
                var regInsafe = mw.tools.parentsOrCurrentOrderMatchOrNone(el, ['regular-mode', 'safe-mode']);
                return hasSafe && !regInsafe;
            },
            _execCommandCustom: {
                removeFormat: function (cmd, def, val) {
                    scope.actionWindow.document.execCommand(cmd, def, val);
                    var sel = scope.getSelection();

                    var r = sel.getRangeAt(0);
                    var common = r.commonAncestorContainer;
                    var all = common.querySelectorAll('*'), l = all.length, i = 0;
                    for ( ; i < l; i++ ) {
                        var el = all[i];
                        if (typeof sel !== 'undefined' && sel.containsNode(el, true)) {
                            all[i].removeAttribute('style');
                        }
                    }
                    scope.registerChange();
                }
            },
            domCommand: function (method, options) {
                var sel = scope.getSelection();
                try {  // 0x80004005
                    if (  scope.api.isSelectionEditable()) {

                        if (sel.rangeCount > 0) {
                            var node = scope.api.elementNode(sel.focusNode);

                            scope.api.action(mw.tools.firstBlockLevel(node), function () {
                                scope.api[method].call(scope.api, options);
                                mw.$(scope.settings.iframeAreaSelector, scope.actionWindow.document).trigger('execCommand');
                                mw.$(scope).trigger('execCommand');
                                scope.registerChange();
                            });
                        }
                    }
                }
                catch (e) {
                }
            },
            _execCommandWrongFormats:  null,
            cleanNesting: function (target){
                if(!scope.api._execCommandWrongFormats) {
                    var global = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
                    var child = ['ul', 'ol'];
                    var res = [];
                    global.forEach(function (item) {
                        global.forEach(function (citem) {
                            res.push(item + ' ' + citem)
                        });
                        child.forEach(function (citem) {
                            res.push(item + ' ' + citem)
                        });
                    })
                    scope.api._execCommandWrongFormats = res.join(',');
                }
                if(!target || target.nodeType === 3) {
                    return
                }



                var lit = target.querySelectorAll('ul > *:not(li), ol > *:not(li)');
                if(lit.length) {
                     Array.from(lit).forEach(function (node){
                         var cld = node.firstElementChild;
                         if(cld && cld.nodeName === 'li') {
                             node.parentNode.insertBefore(cld, node);
                             while (cld.firstChild) {
                                 node.appendChild(cld.firstChild)
                             }
                             cld.appendChild(node)
                         }
                     })

                }

            },
            afterExecCommand: function ( parent) {
                if(!parent) {
                    var sel = scope.getSelection();
                    parent = sel.focusNode;
                }
                scope.api.cleanNesting(parent);
                const keysToRemove = []
                const keysValuesToRemove = [{'font-size': '0px'}];
                if(parent.nodeType === 3) {
                    return;
                }

                Array.prototype.slice.call(parent.querySelectorAll('[style],[id]')).forEach(node => {
                    if(!!node.getAttribute('style')) {
                        const keys = Array.from(node.style);
                        keys.forEach(key => {
                            if(node.style[key]) {
                                var toRemove = node.style[key].includes('var(')
                                || keysToRemove.indexOf(key) !== -1
                                || keysValuesToRemove.find(a => a[key] === node.style[key]);
                                if(toRemove) {
                                    node.style[key] = '';
                                }
                            }

                        });
                    }
                    if(node.id) {
                        var others = parent.querySelectorAll('[id="'+node.id+'"]');
                        if(others.length > 1) {
                            others.forEach(n => {
                                if(node !== n) {
                                    n.id += mw.id();
                                }
                            })
                        }

                    }

                });


                mw.$(scope.settings.iframeAreaSelector, scope.actionWindow.document).trigger('execCommand');
                mw.$(scope).trigger('execCommand');
            },
            execCommand: function (cmd, def, val, recordTimeout) {


                scope.actionWindow.document.execCommand('styleWithCss', 'false', false);
                var sel = scope.getSelection();
                try {  // 0x80004005
                    if (scope.actionWindow.document.queryCommandSupported(cmd) && scope.api.isSelectionEditable()) {
                        def = def || false;
                        val = val || false;
                        if (sel.rangeCount > 0) {
                            var node = scope.api.elementNode(sel.focusNode);
                            var parent = mw.tools.firstBlockLevel(node).parentNode.parentNode;
                            var area = parent.querySelector('.mw-editor-area');
                            if(area) {
                                parent = area;
                            }


                            scope.api.action(parent, function () {

                                function _execCommand(cmd, def, val) {
                                    var pce = parent.contentEditable
                                    var current = parent.querySelector('[contenteditable="true"]');
                                    parent.contentEditable = true;
                                    if(current) {
                                        current.contentEditable = 'inherit';
                                    }

                                    scope.actionWindow.document.execCommand(cmd, def, val);

                                    parent.contentEditable = pce;

                                    if(current) {
                                        current.contentEditable = true;
                                    }


                                }

                                _execCommand(cmd, def, val);

                                scope.api.afterExecCommand(parent);

                            }, recordTimeout);
                        }
                    }
                }
                catch (e) {
                }
            },
            _fontSize: function (size, unit) {
                unit = unit || 'px';
                scope.api.domCommand('cssApplier', 'font-size:' +  size + unit + ';');
            },
            lineHeight: function (size) {

                if (scope.api.isSelectionEditable()) {
                    var sel = scope.getSelection();
                    var el = scope.api.elementNode(sel.focusNode);
                    var parent = mw.tools.firstBlockLevel(el)
                    scope.api.action(parent.parentNode, function () {
                        parent.style.lineHeight = size
                    });
                }

            },
            fontSize: function (size) {

                var unit = 'px';
                if(typeof size === 'string') {
                    var units =  ['px', '%', 'in', 'cm', 'mm', 'rem', 'em', 'ex', 'pt', 'pc','ex','ch','rem','lh','rlh','vw','vh','vmin','vmax','vb','vi','svw', 'svh','lvw', 'lvh','dvw', 'dvh']
                    unit = size.replace(/[^A-Za-z]/g, '').trim().toLowerCase() || 'px';
                    if(units.indexOf(unit) === -1) {
                        unit = 'px';
                    }
                    size = parseFloat(size.replace( /^\D+/g, ''));
                }
                var sel = scope.getSelection();
                if (sel.isCollapsed) {
                    var node = scope.api.elementNode(sel.focusNode);
                    scope.api.action(node.parentNode, function () {
                        node.style.fontSize = size + unit;
                    });

                    return;
                }
                var range = sel.getRangeAt(0),
                    common = scope.api.elementNode(range.commonAncestorContainer);
                var nodrop_state = mw.tools.parentsOrCurrentOrderMatchOrOnlyFirstOrNone(common, ['allow-drop', 'nodrop']);

                if (scope.api.isSelectionEditable()/* && nodrop_state */) {
                    scope.api._fontSize(size, unit);
                }
            },
            saveSelection: function () {


                scope.api.savedSelection = {
                    selection: scope.getSelection(),
                    range: scope.lastRange,
                    element: mw.$(scope.api.elementNode(scope.lastRange.commonAncestorContainer))
                };
            },
            restoreSelection: function () {
                if (scope.api.savedSelection) {
                    scope.api.savedSelection.element.attr("contenteditable", "true");
                    scope.api.savedSelection.element.focus();
                    scope.api.savedSelection.selection.removeAllRanges();
                    scope.api.savedSelection.selection.addRange(scope.api.savedSelection.range);
                }
            },
            _cleaner: document.createElement('div'),

            cleanHTML: function(html) {
                this._cleaner.innerHTML = html;
                var elements = Array.prototype.slice.call(this._cleaner.querySelectorAll('iframe,script,noscript'));
                while (elements.length) {
                    elements[0].remove();
                    elements.shift();
                }

                Array.prototype.slice.call(this._cleaner.querySelectorAll('[style]')).forEach(node => {
                    const keys = Array.from(node.style);
                    keys.forEach(key => {
                        if(node.style[key].includes('var(')) {
                            node.style[key] = '';
                        }
                    });
                });


                return /*_filterXSS*/ (this._cleaner.innerHTML) || '';
            },
            insertHTML: function(html) {



                return scope.api.execCommand('insertHTML', false, this.cleanHTML(html));
            },
            insertImage: function (url) {
                var id = mw.id('mw-image-');
                var img = '<div class="element"><img style="max-width: 100%;" id="'+id+'" alt="'+url+'" src="' + url + '" /></div>';
                scope.api.insertHTML(img);
                setTimeout(function (){
                    img = scope.actionWindow.document.querySelector('#' + id);
                    img.removeAttribute("_moz_dirty");
                    img.classList.add( 'element');
                }, 78)
                return img[0];
            },
            link: function (result) {
                var sel = scope.getSelection();
                var el = scope.api.elementNode(sel.focusNode);
                var elLink = el.nodeName === 'A' ? el : mw.tools.firstParentWithTag(el, 'a');


                if (elLink) {
                    scope.api.action(mw.tools.firstBlockLevel(elLink), function () {
                        elLink.href = result.url;
                        if (result.target) {
                            elLink.target = '_blank';
                        } else {
                            elLink.removeAttribute('target');
                        }
                        if (result.text && result.text !== elLink.innerHTML) {
                            elLink.innerHTML = result.text;
                        }
                    });

                } else {
                    scope.api.insertHTML('<a '+(result.target ? 'target="_blank"' : '')+' href="'+ result.url +'">'+ (result.text || (sel.toString().trim()) || result.url) +'</a>');
                }
            },
            unlink: function () {
                var sel = scope.getSelection();
                if (!sel.isCollapsed) {
                    this.execCommand('unlink', null, null);
                }
                else {
                    var link = mw.tools.firstParentOrCurrentWithTag(this.elementNode(sel.focusNode), 'a');

                    if (!!link) {
                        this.selectElement(link);
                        this.execCommand('unlink', null, null);
                    }
                }
            }
        };
    };

})();


