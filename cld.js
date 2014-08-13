var CLD = (function () {
    // a register is {node, type, context}  
    var widgetRegister = [];

    function toggleString(str, s, delimiter) {
        var list = str.split(delimiter);
        if (list.length === 1 && list[0] === "") {
            list[0] = s;
        } else {
            var i = list.indexOf(s);
            if (i >= 0) {
                list.splice(i, 1);
            }
            else {
                list.push(s);
            }
        }
        return list.join(delimiter);
    }

    return {
        findWidget: function(node, type) {
            for (var i = 0; i < widgetRegister.length; i++) {
                var reg = widgetRegister[i];
                if (reg.node && reg.node === node &&
                    reg.type && reg.type === type &&
                    reg.context) {
                    return reg.context;
                }
            }
            return;
        },
        registerWidget: function(node, type, context) {
            widgetRegister.push({
                node: node,
                type: type,
                context: context
            });
        },
        removeWidget: function(node, type){
            for (var i = widgetRegister.length - 1; i >= 0; i--) {
                var reg = widgetRegister[i];
                if (reg.node && reg.node === node &&
                    reg.type && reg.type === type) {
                    widgetRegister.splice(i, 1);
                }
            }
            return;
        },
        toggleClass: function (node, className) {
            node.className = toggleString(node.className, className, " ");
        },
        toggleInputValue: function(node, str, delimiter) {
            node.value = toggleString(node.value, str, delimiter);
        },
        addClass: function (node, className) {
            var classList = node.className.split(" ");
            var i = classList.indexOf(className);
            if (i < 0) {
                classList.push(className);
                node.className = classList.join(" ");
            }
        },
        removeClass: function (node, className) {
            var classList = node.className.split(" ");
            var i = classList.indexOf(className);
            if (i >= 0) {
                classList.splice(i, 1);
                node.className = classList.join(" ");
            }
        },
        // Modify from jquery, only non-deep copy
        extend: function extend() {
            var options, name, src, copy, copyIsArray, clone,
                i = 1,
                target = arguments[0], 
                length = arguments.length;

            if ( typeof target !== "object") {
                target = {};
            }

            for ( ; i < length; i++ ) { 
                // Only deal with non-null/undefined values
                if ( (options = arguments[ i ]) != null ) { 
                    // Extend the base object
                    for ( name in options ) { 
                        src = target[ name ];
                        copy = options[ name ];

                        // Prevent never-ending loop
                        if ( target === copy ) { 
                            continue;
                        } else if ( copy !== undefined ) { 
                            target[ name ] = copy;
                        }
                    }
                }
            }

            // Return the modified object
            return target;
        },
    };
}());

(function(){
    //Const. If target enviroment will support, it should use 'const' to declare
    var KEY_TAB = 9;
    var KEY_ENTER = 13;
    var KEY_LEFT = 37;
    var KEY_UP = 38;
    var kEY_RIGHT = 39;
    var KEY_DOWN = 40;
    var MOUSE_LEFT = 0;
    var MOUSE_MIDDLE = 1;
    var MOUSE_RIGHT = 2;
    var WIDGET_NAME = "AutoComplete";

    var defConf = {
        delimiter: ",",
        key:  "id",
        text: "text",
        frameBoxClassName: "CLD_AC_FrameBox",
        inputBoxClassName: "CLD_AC_InputBox",
        checkedBoxClassName: "CLD_AC_CheckedBox",
        promptBoxClassName: "CLD_AC_PromptBox",
        promptItemClassName: "CLD_AC_PromptItem",
        checkedClassName: "CLD_AC_Checked",
        submitCallback:  {lock: null, unLock: null},
        caseSensitive: false,
        dataObj: null,
    };

    function AutoCompleteContext (node, conf) {
        var that = this;
        this._conf = null;
        this._frameBox = null;
        this._inputBox = null;
        this._promptBox = null;
        this._checkedBox = null;
        this._currSelected = 0;
        this._isShowPrompt = false;
        this._oldQueryStr = "";
        this._filteredItems = [];
        this._checkedItems = [];
        this._origNode = node;

        this.configure(conf);
        this._initDOM();
        this._frameBox.addEventListener("keydown", function keyDownHandler(e) {
            var pressAscii = e.keyCode;
            switch (pressAscii) {
                case KEY_ENTER:
                    that.checkItem(that._promptBox.childNodes[that._currSelected]);
                    break;
                case KEY_UP:
                    that.moveItem(-1);
                    break;
                case KEY_DOWN:
                    that.moveItem(1);
                    break;
                default:
            }
        }, false);
        this._frameBox.addEventListener("input", function inputHandler(e) {
            that.query(that._inputBox.value);
        }, false);
    }

    AutoCompleteContext.prototype = {
        configure: function configure (conf) {
            var that = this;
            this._conf = CLD.extend({}, defConf, this._conf, conf);
            this._conf.dataObj.sort(function sortData(v1, v2) {
                return v1[that._conf.key] > v2[that._conf.key];
            });
        },

        _initDOM: function _initDOM () {
            var that = this;
            if (this._frameBox) {
                this._removeDOM();
            }

            this._inputBox = document.createElement("input");
            this._inputBox.className = this._conf.inputBoxClassName;

            this._checkedBox = document.createElement("span");
            this._checkedBox.className = this._conf.checkedBoxClassName;

            this._promptBox = document.createElement("div");
            this._promptBox.className = this._conf.promptBoxClassName;
            this._promptBox.style.display = "None";
            this._conf.dataObj.forEach(function findMatch(val, idx, arr) {
                var tmpNode = document.createElement("div");
                tmpNode.innerHTML = val[that._conf.key];
                tmpNode.dataIndex = idx;    //Customize attribute
                tmpNode.className = that._conf.promptItemClassName;
                tmpNode.addEventListener("mouseover", function itemMouseOverHandler(e) {
                    that._lowLightItem(that._promptBox.childNodes[that._currSelected]);
                    that._currSelected = that._tryNode2Index(e.target);
                    that._hightLightItem(e.target, false);
                }, false);
                tmpNode.addEventListener("mouseup", function itemMouseUpHandler(e) {
                    if (e.button == MOUSE_LEFT) {
                        that.checkItem(e.target);
                    }
                }, false);
                that._promptBox.appendChild(tmpNode);
            });

            this._frameBox = document.createElement("span");
            this._frameBox.className = this._conf.frameBoxClassName;
            this._frameBox.appendChild(this._checkedBox);
            this._frameBox.appendChild(this._inputBox);
            this._frameBox.appendChild(this._promptBox);

            this._origNode.parentNode.insertBefore(this._frameBox, this._origNode);
            this._origNode.style.display = "None";

            this._filteredItems = [];
            this._checkedItems = [];
        },

        _removeDOM: function _removeDOM() {
            this._origNode.parentNode.removeChild(this._frameBox);
            while (this._promptBox.firstChild) {
                this._promptBox.removeChild(this._promptBox.firstChild);
            }
            while (this._checkedBox.firstChild) {
                this._checkedBox.removeChild(this._checkedBox.firstChild);
            }
            this._origNode.style.display = "Block";
            this._promptBox = null;
            this._frameBox = null;
            this._checkedBox = null;
            this._inputBox = null;
        },

        destroyer: function destroyer() {
            this._removeDOM();
            CLD.removeWidget(this._origNode, WIDGET_NAME);
        },

        _hightLightItem: function _hightLightItem(node, scrollIntoView) {
            CLD.addClass(node, "HightLight");
            scrollIntoView = (scrollIntoView === false) ?  false : true;
            if (scrollIntoView) {
                node.scrollIntoView();
            }
        },

        _lowLightItem: function _lowLightItem(node) {
            CLD.removeClass(node, "HightLight");
        },

        _showPromptBox: function _showPromptBox(isShow) {
            if (isShow){
                this._promptBox.style.display = "block";
                this._promptBox.style.left = this._inputBox.offsetLeft;
            } else {
                this._promptBox.style.display = "none";
            }
            this._isShowPrompt = isShow;    
        },

        _tryIndex2Node: function _tryIndex2Node(parent, idx) {
            if (typeof idx === "number") {
                return parent.childNodes[idx];
            }
            return idx;
        },

        _tryNode2Index: function _tryNode2Index(node) {
            if (node instanceof HTMLElement) {
                return Array.prototype.indexOf.call(node.parentNode.childNodes, node);
            }
            return node;
        },

        _indexOfCase: function _indexOfCase(str1, str2, caseSensitive) {
            if (!caseSensitive) {
                str1 = str1.toLowerCase();
                str2 = str2.toLowerCase();
            }
            return str1.indexOf(str2);
        },

        query: function query(queryStr) {
            var i;
            this._inputBox.value = queryStr;
            this._lowLightItem(this._promptBox.childNodes[this._currSelected]);
            if (!queryStr) {
                if (this._conf.submitCallback.unLock instanceof Function) {
                    this._conf.submitCallback.unLock();
                }
                this._currSelected = 0;
                this._showPromptBox(false);
                return;
            }

            if (this._conf.submitCallback.lock instanceof Function) {
                this._conf.submitCallback.lock();
            }

            //A new query or different prefix of previous query
            if (!this._oldQueryStr || queryStr.indexOf(this._oldQueryStr) !== 0) {
                this._currSelected = 0;
            }

            for (i = this._currSelected; i < this._conf.dataObj.length; i++) {
                if (this._indexOfCase(this._conf.dataObj[i][this._conf.key], queryStr, this._conf.caseSensitive) === 0) {
                    this._currSelected = i;
                    this._showPromptBox(true);
                    this._hightLightItem(this._promptBox.childNodes[i], true);
                    break;
                }
            }
            this._oldQueryStr = queryStr;

            return;
        },

        moveItem: function moveItem(inc) {
            this._lowLightItem(this._promptBox.childNodes[this._currSelected]);
            this._currSelected = (this._conf.dataObj.length + (this._currSelected + inc)) % this._conf.dataObj.length;
            this._hightLightItem(this._promptBox.childNodes[this._currSelected]);
        },

        checkItem: function checkItem(node) {
            var that = this,
                tmpNode = document.createElement("span"),
                tmpImgNode = document.createElement("a");

            node = this._tryIndex2Node(this._promptBox, node);
            CLD.toggleInputValue(this._origNode, node.innerHTML, this._conf.delimiter);

            this._checkedItems.push(this._conf.dataObj[node.dataIndex]);
            tmpNode.className = this._conf.checkedClassName;
            tmpNode.innerHTML = node.innerHTML;
            tmpNode.checkedIdx = this._checkedItems.length - 1;
            tmpImgNode.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
            tmpImgNode.addEventListener("mouseup", function checkedMouseUpHandler(e) {
                if (e.button == MOUSE_LEFT) {
                    that.unCheckItem(e.target.parentNode);
                }
            }, false);
            tmpNode.appendChild(tmpImgNode);
            this._checkedBox.appendChild(tmpNode);
            //frameBox.insertBefore(tmpNode, inputBox);
            
            // This is simliar to multiple check.
            //showPromptBox(true);
            this._showPromptBox(false);
            if (this._conf.submitCallback.unLock instanceof Function) {
                this._conf.submitCallback.unLock();
            }
            this._inputBox.value = "";
            this._inputBox.focus();
        },

        unCheckItem: function unCheckItem(node) {
            node = this._tryIndex2Node(this._checkedBox, node);
            this._checkedItems.splice(node.checkedIdx, 1);
            CLD.toggleInputValue(this._origNode, node.childNodes[0].textContent, this._conf.delimiter);
            this._checkedBox.removeChild(node);
        },

        getSelectedIndex: function getSelectedIndex () {
            return this._currSelected;
        },

        getCheckedItems: function getCheckedItems() {
            return this._checkedItems;
        },

        getCheckedString: function getCheckedString() {
            return this._origNode.value;
        },
    };


    /*
     * Create new or get existen controller
    */
    CLD.AutoComplete = function AutoComplete (origNode, method) {
        var conf,
            context,
            methodParams = [],
            i = 2;
        
        if (origNode instanceof HTMLElement === false) {
            throw "First paramater is not HTMLElement";
        }

        if (typeof method === 'object') {
            conf = method;
        }

        for (; i < arguments.length; i++) {
            methodParams.push(arguments[i]);
        }

        // If already exist, return existen object
        context = this.findWidget(origNode, WIDGET_NAME);
        if (context && context.constructor === AutoCompleteContext) {
            if (context[method]) {
                return context[method];
            } else if (typeof method === 'object') {
                //re-conf
                CLD.removeWidget(origNode, WIDGET_NAME);
                context = new AutoCompleteContext(origNode, conf);
                this.registerWidget(origNode, WIDGET_NAME, context);
                return context;
            } else if (method === undefined) {
                return context;
            } else {
                throw 'Method is not exist';
            }
        } else {
            if (typeof conf !== 'object') {
                conf = {};
            }
            context = new AutoCompleteContext(origNode, conf);
            this.registerWidget(origNode, WIDGET_NAME, context);
            return context;
        }
    };

})();
