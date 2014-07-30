var CLD = (function(){
    // a register is {node, type, context}  
    var widgetRegister = [];

    var toggleString = function(str, s, delimiter) {
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
    };
    return {
        widgetRegister: widgetRegister,
        findWidget: function(node, type) {
            for (var i = 0; i < widgetRegister.length; i++) {
                var reg = widgetRegister[i];
                if (reg.node && reg.node === node && reg.type && reg.type === type && reg.context) {
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
    };
}());

CLD.AutoComplete = function(origNode, conf) {
    var WIDGET_NAME = "AutoComplete";
    var KEY_TAB = 9;
    var KEY_ENTER = 13;
    var KEY_LEFT = 37;
    var KEY_UP = 38;
    var kEY_RIGHT = 39;
    var KEY_DOWN = 40;
    var MOUSE_LEFT = 0;
    var MOUSE_MIDDLE = 1;
    var MOUSE_RIGHT = 2;

    var frameBox;
    var inputBox;
    var promptBox;
    var checkedBox;
    var currSelected = 0;
    var isShowPrompt = false;
    var oldQueryStr = "";
    var filteredItems = [];
    var checkedItems = [];

    //Main content
    var context = CLD.findWidget(origNode, WIDGET_NAME);
    if (typeof context === "object") {
        return context;
    }
    conf = conf || {};
    configure(conf);
    var ACController = {
        query: query,
        moveItem: moveItem,
        checkItem: checkItem,
        unCheckItem: unCheckItem,
        getCheckedItems: getCheckedItems,
        getCheckedString: getCheckedString,
        reConfigure: configure,
        destroyer: destroyer,
    };
    CLD.registerWidget(origNode, WIDGET_NAME, ACController);
    inputBox.addEventListener("keydown", keyDownHandler, false);
    frameBox.addEventListener("input", inputHandler, false);

    return ACController;

    function configure(config) {
        config = config || {};
        conf.delimiter = config.delimiter || conf.delimiter || ",";
        conf.key = config.key || conf.key  ||"id";
        conf.text = config.text || conf.text  || "text";
        conf.frameBoxClassName = config.frameBoxClassName || conf.frameBoxClassName || "CLD_AC_FrameBox";
        conf.inputBoxClassName = config.inputBoxClassName || conf.inputBoxClassName || "CLD_AC_InputBox";
        conf.checkedBoxClassName = config.checkedBoxClassName || conf.checkedBoxClassName || "CLD_AC_CheckedBox";
        conf.promptBoxClassName = config.promptBoxClassName || conf.promptBoxClassName || "CLD_AC_PromptBox";
        conf.promptItemClassName = config.promptItemClassName || conf.promptItemClassName || "CLD_AC_PromptItem";
        conf.checkedClassName = config.checkedClassName || conf.checkedClassName || "CLD_AC_Checked";
        conf.submitCallback = config.submitCallback || conf.submitCallback || {lock: null, unLock: null};
        conf.caseSensitive = config.caseSensitive || conf.caseSensitive || false;
        conf.dataObj = config.dataObj || conf.dataObj || {};

        initDOM(origNode);
    }

    function initDOM(node) {
        if (frameBox) {
            removeDOM();
        }

        inputBox = document.createElement("input");
        inputBox.className = conf.inputBoxClassName;

        checkedBox = document.createElement("span");
        checkedBox.className = conf.inputBoxClassName;

        promptBox = document.createElement("div");
        promptBox.className = conf.promptBoxClassName;
        promptBox.style.display = "None";

        frameBox = document.createElement("span");
        frameBox.className = conf.frameBoxClassName;
        frameBox.appendChild(checkedBox);
        frameBox.appendChild(inputBox);
        frameBox.appendChild(promptBox);

        node.parentNode.insertBefore(frameBox, node);
        node.style.display = "None";

        filteredItems = [];
        checkedItems = [];
    }

    function removeDOM() {
        origNode.parentNode.removeChild(frameBox);
        while (promptBox.firstChild) {
            promptBox.removeChild(promptBox.firstChild);
        }
        while (checkedBox.firstChild) {
            checkedBox.removeChild(checkedBox.firstChild);
        }
        origNode.style.display = "Block";
        promptBox = null;
        frameBox = null;
        checkedBox = null;
        inputBox = null;
    }

    function destroyer() {
        removeDOM();
        CLD.removeWidget(origNode, WIDGET_NAME);
    }

    function hightLightItem(node, scrollIntoView) {
        CLD.addClass(node, "HightLight");
        scrollIntoView = (scrollIntoView === false) ?  false : true;
        if (scrollIntoView) {
            node.scrollIntoView();
        }
    }

    function lowLightItem(node) {
        CLD.removeClass(node, "HightLight");
    }

    function showPromptBox(isShow) {
        if (isShow){
            promptBox.style.display = "block";
            promptBox.style.left = inputBox.offsetLeft;
        } else {
            promptBox.style.display = "none";
        }
        isShowPrompt = isShow;    
    }

    function tryIndex2Node(parent, idx) {
        if (typeof idx === "number") {
            return parent.childNodes[idx];
        }
        return idx;
    }

    function tryNode2Index(node) {
        if (node instanceof HTMLElement) {
            return Array.prototype.indexOf.call(node.parentNode.childNodes, node);
        }
        return node;
    }

    function query(queryStr) {
        var i;
        inputBox.value = queryStr;
        if (!queryStr) {
            showPromptBox(false);
            return;
        }
        if (conf.submitCallback.lock instanceof Function) {
            conf.submitCallback.lock();
        }
        //A new query or from "ABC" into "CDE", clean current result
        if (!oldQueryStr || queryStr.indexOf(oldQueryStr) !== 0) {
            while (promptBox.firstChild) {
                promptBox.removeChild(promptBox.firstChild);
            }
            filteredItems = [];
            conf.dataObj.forEach(function findMatch(val, idx, arr) {
                var v = val[conf.key];
                var s = queryStr;
                if (!conf.caseSensitive) {
                    v = v.toLowerCase();
                    s = s.toLowerCase();
                }
                if (v.indexOf(s) === 0) {
                    filteredItems.push(arr[idx]);
                    var tmpNode = document.createElement("div");
                    tmpNode.innerHTML = val[conf.key];
                    tmpNode.className = conf.promptItemClassName;
                    tmpNode.dataObj = val;
                    tmpNode.addEventListener("mouseover", itemMouseOverHandler ,false);
                    tmpNode.addEventListener("mouseup", itemMouseUpHandler ,false);
                    promptBox.appendChild(tmpNode);
                }
            });
        } else {
            for(i = filteredItems.length - 1; i >= 0; i--) {
                var v = filteredItems[i][conf.key];
                var s = queryStr;
                if (!conf.caseSensitive) {
                    v = v.toLowerCase();
                    s = s.toLowerCase();
                }
                if (v.indexOf(s) !== 0) {
                    filteredItems.splice(i, 1);
                    promptBox.removeChild(promptBox.childNodes[i]);
                }
            }
        }
        oldQueryStr = queryStr;

        if (filteredItems.length > 0) {
            showPromptBox(true);
            currSelected = 0;
            hightLightItem(promptBox.childNodes[currSelected]);
        } else {
            showPromptBox(false);
        }

        return filteredItems;
    }

    function moveItem(inc) {
        lowLightItem(promptBox.childNodes[currSelected]);
        currSelected = (filteredItems.length + (currSelected + inc)) % filteredItems.length;
        hightLightItem(promptBox.childNodes[currSelected]);
    }

    function checkItem(node) {
        //This function seem cost much.
        node = tryIndex2Node(promptBox, node);
        CLD.toggleInputValue(origNode, node.innerHTML, conf.delimiter);
        var tmpNode = document.createElement("span");
        var tmpImgNode = document.createElement("a");

        checkedItems.push(node.dataObj);
        tmpNode.className = conf.checkedClassName;
        tmpNode.innerHTML = node.innerHTML;
        tmpNode.checkedIdx = checkedItems.length - 1;
        tmpImgNode.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
        tmpImgNode.addEventListener("mouseup", checkedMouseUpHandler, false);
        tmpNode.appendChild(tmpImgNode);
        checkedBox.appendChild(tmpNode);
        //frameBox.insertBefore(tmpNode, inputBox);

        
        // This is simliar to multiple check.
        //showPromptBox(true);
        showPromptBox(false);
        if (conf.submitCallback.unLock instanceof Function) {
            conf.submitCallback.unLock();
        }
        inputBox.value = "";
        inputBox.focus();
    }

    function unCheckItem(node) {
        node = tryIndex2Node(checkedBox, node);
        checkedItems.splice(node.checkedIdx, 1);
        CLD.toggleInputValue(origNode, node.childNodes[0].textContent, conf.delimiter);
        checkedBox.removeChild(node);
    }

    function getCheckedItems() {
        return checkedItems;
    }

    function getCheckedString() {
        return origNode.value;
    }

    //=============================================
    // Event Handler Section
    //=============================================
    function inputHandler(e) {
        query(inputBox.value);
    }

    function keyDownHandler(e) {
        var pressAscii = e.keyCode;
        switch (pressAscii) {
            case KEY_ENTER:
                checkItem(promptBox.childNodes[currSelected]);
                break;
            case KEY_UP:
                moveItem(-1);
                break;
            case KEY_DOWN:
                moveItem(1);
                break;
            default:
        }
    }

    function itemMouseOverHandler(e) {
        lowLightItem(promptBox.childNodes[currSelected]);
        currSelected = tryNode2Index(e.target);
        hightLightItem(e.target, false);
    }

    function itemMouseUpHandler(e) {
        if (e.button == MOUSE_LEFT) {
            checkItem(e.target);
        }
    }

    function checkedMouseUpHandler(e) {
        if (e.button == MOUSE_LEFT) {
            unCheckItem(e.target.parentNode);
        }
    }
};
