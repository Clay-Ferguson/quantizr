import { EventInput } from "@fullcalendar/react";
import { marked } from "marked";
import { dispatch, getAppState, promiseDispatch } from "./AppContext";
import { AppState } from "./AppState";
import clientInfo from "./ClientInfo";
import { Menu } from "./comp/Menu";
import { Constants as C } from "./Constants";
import { DialogBase } from "./DialogBase";
import { AudioPlayerDlg } from "./dlg/AudioPlayerDlg";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { MessageDlg } from "./dlg/MessageDlg";
import * as I from "./Interfaces";
import * as J from "./JavaIntf";
import { NodeHistoryItem } from "./NodeHistoryItem";
import { PubSub } from "./PubSub";
import { S } from "./Singletons";

declare let g_nodeId: string;

const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
    // These options are needed to round to whole numbers if that's what you want.
    // minimumFractionDigits: 0,
    // maximumFractionDigits: 0,
});

export class Util {
    // I'd like to enable this but if we don't load the tree right away we have to check the 200ish places in the code where
    // we are doing things like state.node.id, and assuming there IS a node on the state, and that will take more testing
    // than I have time for righ tnow, so we can't do the 'default to feed" functionality for now.
    sendAnonUsersToFeed = false;

    weekday: string[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    fileExtensionTypes = {
        md: "md",
        txt: "txt",
        sh: "txt",

        jpg: "img",
        png: "img",
        jpeg: "img",

        mp3: "audio",
        ogg: "audio",
        wma: "audio",
        opus: "audio",
        m4a: "audio",
        aac: "audio",
        flac: "audio",
        aiff: "audio",
        alac: "audio",
        dsd: "audio",
        pcm: "audio",
        wav: "audio",

        mp4: "video",
        m4p: "video",
        m4v: "video",
        mp2: "video",
        wmv: "video",
        qt: "video",
        mpeg: "video",
        mpe: "video",
        mpv: "video",
        webm: "video",
        mpg: "video",
        avi: "video",
        mov: "video",
        flv: "video",
        swf: "video",
        avchd: "video"
    };

    editableExtensions = {
        md: true,
        txt: true,
        sh: true
    };

    findFirstVisibleElm = (parentId: string, childrenClass: string): Element => {
        const parent: HTMLElement = document.getElementById(parentId);
        if (parent) {
            const containerRect = parent.getBoundingClientRect();

            // This logic is making the assumption that getElementsByClassName() returns elements on top-down order
            // so it can find the topmost one without verifying by position which is topmost, and I think browsers
            // are required to implement the deterministic ordering in this way. (if not we would have to scan all elements
            // here to find which one had the smallest 'top')
            const elements = document.getElementsByClassName(childrenClass);
            if (!elements) return;
            for (const e of elements) {
                const { bottom, height, top } = e.getBoundingClientRect();
                const visible = top <= containerRect.top ? containerRect.top - top <= height : bottom - containerRect.bottom <= height;
                if (visible) {
                    return e;
                }
            }
        }
        return null;
    }

    // accepts letters, numbers, underscore, dash.
    // todo-2: enforce this same rule on the server side
    validUsername = (v: string): boolean => {
        return !!v.match(/^[0-9a-zA-Z\-_]+$/);
    }

    /* To allow functions to be attached directly to any node, without having to create a NEW function for each use
    we call this function to grab the ID off the actual HTML element itself. This is the only time and place we ever
    do this kind of hack, and it's purely for performances and make HTML renders significantly faster by avoiding 100s of
    function object creates per page render */
    allowIdFromEvent = (evt: Event, id: string): string => {
        if (id) return id;
        return S.domUtil.getPropFromDom(evt, "nid");
    }

    // #mouseEffects (do not delete tag)
    delayFunc = (func: Function): Function => {
        const state = getAppState();
        if (!func || !state.mouseEffect) {
            return func;
        }

        return (evt: any) => {
            setTimeout(() => {
                // func.apply(this, arguments);
                func(evt);
            },
                /* This value needs to match the animation delay time in click-effect.scss, and also the entire purpose of this setTimeout
                and delayFunc method is to give the animation time to run before we execute whatever was clicked on */
                400);
        };
    }

    formatMemory = (val: number): string => {
        // put these vals in const file KB,MB,GB
        if (val < 1024) {
            if (val < 1) {
                return "0 bytes";
            }
            return `${(val)} bytes`;
        }
        else if (val < 1024 * 1024) {
            return `${(val / 1024).toFixed(1)} KB`;
        }
        else if (val < 1024 * 1024 * 1024) {
            return `${(val / (1024 * 1024)).toFixed(1)} MB`;
        }
        else if (val < 1024 * 1024 * 1024 * 1024) {
            return `${(val / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        }
        else {
            return `${(val).toFixed(1)} bytes`;
        }
    }

    searchNodeArray(nodes: J.NodeInfo[], nodeId: string) {
        if (!nodes) return null;
        for (const n of nodes) {
            if (n.id === nodeId) return n;
            if (n.boostedNode?.id === nodeId) return n.boostedNode;
        }
        return null;
    }

    hashOfString = (s: string): string => {
        let hash = 0;
        let i = 0;
        let chr = 0;
        if (s.length === 0) return hash.toString();

        for (i = 0; i < s.length; i++) {
            chr = s.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash.toString();
    }

    hashOfObject = (obj: Object): string => {
        if (!obj) return "null";
        return this.hashOfString(JSON.stringify(obj));
    }

    /** Returns one of the types listed in 'fileExtensionTypes' based on fileName where fileName can either be an actual
    extension or else a full filename including extension */
    getFileTypeFormFileName = (fileName: string): string => {
        const ext: string = this.getFileExtensionFromFileName(fileName);
        if (!ext) return;
        return this.fileExtensionTypes[ext.toLowerCase()];
    }

    getFileExtensionFromFileName = (fileName: string): string => {
        let ext = "";
        const idx = fileName.lastIndexOf(".");
        if (idx !== -1) {
            ext = fileName.substring(idx + 1);
        }
        return ext;
    }

    isEditableFile = (fileName: string): boolean => {
        const ext = this.getFileExtensionFromFileName(fileName);
        return this.editableExtensions[ext];
    }

    isImageFileName = (fileName: string): boolean => {
        return this.getFileTypeFormFileName(fileName) === "img";
    }

    isAudioFileName = (fileName: string): boolean => {
        return this.getFileTypeFormFileName(fileName) === "audio";
    }

    isVideoFileName = (fileName: string): boolean => {
        return this.getFileTypeFormFileName(fileName) === "video";
    }

    buf2hex = (arr: Uint8Array): string => {
        // return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');

        // Diferent Algorithm:
        let hexStr = "";
        if (arr) {
            for (const a of arr) {
                const hex = (a & 0xff).toString(16);
                hexStr += (hex.length === 1) ? "0" + hex : hex;
            }
        }
        return hexStr;
    }

    hex2buf = (str: string): Uint8Array => {
        if (!str) {
            return new Uint8Array([]);
        }

        const a = [];
        for (let i = 0, len = str.length; i < len; i += 2) {
            a.push(parseInt(str.substring(i, i + 2), 16));
        }

        return new Uint8Array(a);
    }

    escapeRegExp = (s: string): string => {
        if (!s) return s;
        return s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    replaceAll = (s: string, find: string, replace: string): string => {
        if (!s || s.indexOf(find) === -1) return s;
        return s.replace(new RegExp(this.escapeRegExp(find), "g"), replace);
    }

    chopAtLastChar = (str: string, char: string): string => {
        const idx = str.lastIndexOf(char);
        if (idx !== -1) {
            return str.substring(0, idx);
        }
        else {
            return str;
        }
    }

    stripIfStartsWith = (s: string, str: string): string => {
        if (!s) return s;
        if (s.startsWith(str)) {
            return s.substring(str.length);
        }
        return s;
    }

    /* chops 'str' off 's' if exists */
    stripIfEndsWith = (s: string, str: string): string => {
        if (s.endsWith(str)) {
            return s.substring(0, s.length - str.length);
        }
        return s;
    }

    arrayClone(a: any[]): any[] {
        if (!a) return null;
        if (a.length === 0) return [];
        return a.slice(0);
    };

    arrayIndexOfItemByProp = (props: J.PropertyInfo[], propName: string, propVal: string): number => {
        for (let i = 0; i < props.length; i++) {
            if (props[i][propName] === propVal) {
                return i;
            }
        }
        return -1;
    };

    arrayMoveItem = (a: any[], fromIndex: number, toIndex: number) => {
        a.splice(toIndex, 0, a.splice(fromIndex, 1)[0]);
    };

    stdTimezoneOffset = (date: Date) => {
        const jan = new Date(date.getFullYear(), 0, 1);
        const jul = new Date(date.getFullYear(), 6, 1);
        return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    }

    // add with sign=1, subtract with sign=-1
    addTimezoneOffset = (date: Date, sign: number): Date => {
        const tzOffsetMinutes = date.getTimezoneOffset();
        // console.log("offset: " + tzOffsetMinutes);

        // make the time value in our current local timezone
        const adjustedTime = date.getTime() + sign * tzOffsetMinutes * 1000 * 60;
        return new Date(adjustedTime);
    }

    getDayOfWeek = (date: Date): string => {
        return this.weekday[date.getDay()];
    }

    dst = (date: Date) => {
        return date.getTimezoneOffset() < this.stdTimezoneOffset(date);
    }

    indexOfObject = (arr: any[], obj: any) => {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === obj) {
                return i;
            }
        }
        return -1;
    }

    assert = (check: boolean, op: string) => {
        if (!check) {
            throw new Error("OP FAILED: " + op);
        }
    }

    /* I'm duplicating toJson for now, because i always expect "prettyPrint", so i need to refactor to be all prettyPrint */
    prettyPrint = (obj: Object): string => {
        return obj ? JSON.stringify(obj, null, 4) : "null"
    }

    /*
     * This came from here:
     * http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
     */
    getParameterByName = (name?: any, url?: any): string => {
        if (!name) return null;
        url = url || window.location.href;

        name = name.replace(/[\[\]]/g, "\\$&");
        const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
        const results = regex.exec(url);
        if (!results) {
            return null;
        }
        if (!results[2]) {
            return "";
        }
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    getHostAndPort = (): string => {
        return location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "");
    }

    logAndThrow = (message: string) => {
        let stack = "[stack, not supported]";
        try {
            stack = (<any>new Error()).stack;
        }
        catch (e) { }
        console.error(message + "STACK: " + stack);
        throw message;
    }

    logAndReThrow = (message: string, exception: any) => {
        let stack = "[stack, not supported]";
        try {
            stack = (<any>new Error()).stack;
        }
        catch (e) { }
        console.error(message + ": " + exception.message + "\nSTACK: " + stack);
        throw exception;
    }

    isElmVisible = (elm: HTMLElement) => {
        return elm?.offsetHeight > 0;
    }

    /*
     * We could have put this logic inside the json method itself, but I can forsee cases where we don't want a
     * message to appear when the json response returns success==false, so we will have to call checkSuccess inside
     * every response method instead, if we want that response to print a message to the user when fail happens.
     *
     * requires: res.success res.message
     */
    checkSuccess = (opFriendlyName: string, res: J.ResponseBase): boolean => {
        if ((!res || !res.success) && res.message) {
            this.showMessage(opFriendlyName + " failed: " + res.message, "Warning");
        }
        return res.success;
    }

    flashMessage = (message: string, title: string, preformatted: boolean = false) => {
        new MessageDlg(message, title, null, null, preformatted, 3000, "app-modal-content-narrow-width").open();
    }

    flashMessageQuick = (message: string, title: string, preformatted: boolean = false) => {
        new MessageDlg(message, title, null, null, preformatted, 2000, "app-modal-content-narrow-width").open();
    }

    showMessage = (message: string, title: string = null, preformatted: boolean = false): Promise<DialogBase> => {
        if (!message) return;
        return new MessageDlg(message, title, null, null, preformatted, 0, null).open();
    }

    addAllToSet = (set: Set<string>, array: any[]) => {
        if (!array) return;
        array.forEach(v => {
            set.add(v);
        });
    }

    isObject = (obj: any): boolean => {
        return obj && obj.length !== 0;
    }

    currentTimeMillis = (): number => {
        // warning DO NOT USE getMilliseconds, which is only 0 thru 999
        return new Date().getTime();
    }

    insertString = (val: string, text: string, position: number): string => {
        return [val.slice(0, position), text, val.slice(position)].join("");
    }

    /*
     * displays message (msg) of object is not of specified type
     */
    verifyType = (obj: any, type: string, msg: string) => {
        if (typeof obj !== type) {
            this.showMessage(msg, "Warning");
            return false;
        }
        return true;
    }

    /* Note: There is also Object.keys(obj).length, which computes internally an entire array, as part of processing
    so it's debatable wether the overhead of that is better for large objects */
    getPropertyCount = (obj: Object): number => {
        if (!obj) return 0;
        const names: string[] = Object.getOwnPropertyNames(obj);
        return names ? names.length : 0;
    }

    /* Iterates by callling callback with property key/value pairs for each property in the object
    check to see if tyescript has a better native way to iterate 'hasOwn' properties */
    forEachProp = (obj: Object, callback: I.PropertyIterator) => {
        if (!obj) return;
        const names: any[] = Object.getOwnPropertyNames(obj);
        if (names) {
            names.forEach(function (prop) {
                /* we use the unusual '== false' here so that returning a value is optional, but if you return false it terminates looping */
                if (callback(prop, obj[prop]) === false) return;
            }, this);
        }
    }

    /* iterates over an object creating a string containing it's keys */
    printKeys = (obj: Object): string => {
        if (!obj) {
            return "null";
        }

        let val: string = "";
        this.forEachProp(obj, (k, v): boolean => {
            if (!k) {
                k = "null";
            }

            if (val.length > 0) {
                val += ",";
            }
            val += k;
            return true;
        });
        return val;
    }

    /* Programatically creates objects by name, similar to what Java reflection does

    * ex: let example = InstanceLoader.getInstance<NamedThing>(window, 'ExampleClass', args...);
    */
    getInstance = <T>(context: Object, name: string, ...args: any[]): T => {
        const instance = Object.create(context[name].prototype);
        instance.constructor.apply(instance, args);
        return <T>instance;
    }

    clipboardReadable = (): boolean => {
        const allowed = (typeof (navigator as any)?.clipboard?.read) === "function";
        if (!allowed) {
            // looks like on localhost (http) we always end up here unable to access clipboard but the
            // prod server (https) allows the clipboard to work. Not sure the reason.
            console.warn("clipboard.read not available");

            // This experiment fails on localhost
            // const f: Function = navigator.permissions.query;
            // f({ name: "clipboard-read" }).then((result: any) => {
            //     if (result.state === "granted" || result.state === "prompt") {
            //         console.log("granted");
            //     }
            // });
        }
        return allowed;
    }

    copyToClipboard = (text: string) => {
        (<any>navigator)?.clipboard?.writeText(text).then(() => {
            console.log("Copied to clipboard successfully!");
        }, () => {
            this.showMessage("Unable to write to clipboard.", "Warning");
        });
    }

    formatDateTime = (date: Date): string => {
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? "pm" : "am";
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const strTime = hours + ":" + (minutes < 10 ? "0" + minutes : minutes) + ampm;
        let year = date.getFullYear();
        if (year > 2000) {
            year -= 2000;
        }
        return (date.getMonth() + 1) + "-" + date.getDate() + "-" + year + " " + strTime;
    }

    formatDateShort = (date: Date): string => {
        let year = date.getFullYear();
        if (year > 2000) {
            year -= 2000;
        }
        return (date.getMonth() + 1) + "/" + date.getDate() + "/" + year;
    }

    /* NOTE: There's also a 'history.replaceState()' which doesn't build onto the history but modifies what it thinks
    the current location is. */
    updateHistory = (node: J.NodeInfo, childNode: J.NodeInfo = null, appState: AppState) => {
        if (!node) {
            node = appState.node;
        }
        if (!node) {
            return;
        }

        S.localDB.setVal(C.LOCALDB_LAST_PARENT_NODEID, node.id);
        if (childNode) {
            S.localDB.setVal(C.LOCALDB_LAST_CHILD_NODEID, childNode.id);
        }

        const content = S.nodeUtil.getShortContent(node);
        // console.log("updateHistory: id=" + node.id + " subId=" + childNodeId + " cont=" + content);
        let url, title, state;
        if (node.name) {
            const queryPath = S.nodeUtil.getPathPartForNamedNode(node);
            url = window.location.origin + queryPath;

            if (childNode && childNode.id && childNode.id !== node.id) {
                url += "#" + childNode.id;
            }
            state = {
                nodeId: ":" + node.name,
                highlightId: (childNode && childNode.id && childNode.id !== node.id) ? childNode.id : null
            };
            title = node.name;
        }
        else {
            url = window.location.origin + "?id=" + node.id;
            if (childNode && childNode.id && childNode.id !== node.id) {
                url += "#" + childNode.id;
            }
            state = {
                nodeId: node.id,
                highlightId: (childNode && childNode.id && childNode.id !== node.id) ? childNode.id : null
            };
            // title = node.id;
            title = content;
        }

        if (history.state && state.nodeId === history.state.nodeId) {
            history.replaceState(state, title, url);
            // console.log("REPLACED STATE: url: " + url + ", state: " + JSON.stringify(state) + " length=" + history.length);
        }
        else {
            history.pushState(state, title, url);
            // console.log("PUSHED STATE: url: " + url + ", state: " + JSON.stringify(state) + " length=" + history.length);
        }

        this.updateNodeHistory(node, childNode, appState);
    }

    removeHistorySubItem = (nodeId: string) => {
        /* First whenever we have a new 'node' we need to remove 'node' from any of the
         subItems that exist, because any top level item doesn't need to also exist as a subItem */
        S.quanta.nodeHistory.forEach(h => {
            if (h.subItems) {
                h.subItems = h.subItems.filter(function (hi: NodeHistoryItem) {
                    return hi.id !== nodeId;
                });
            }
        });
    }

    updateNodeHistory = (node: J.NodeInfo, childNode: J.NodeInfo = null, appState: AppState) => {
        if (S.quanta.nodeHistoryLocked) return;
        let subItems: NodeHistoryItem[] = null;

        this.removeHistorySubItem(node.id);

        /* First whenever we have a new 'node' we need to remove 'node' from any of the
         subItems that exist, because any top level item doesn't need to also exist as a subItem */
        S.quanta.nodeHistory.forEach(h => {
            if (h.subItems) {
                h.subItems = h.subItems.filter(function (hi: NodeHistoryItem) {
                    return hi.id !== node.id;
                });
            }
        });

        // Lookup this history item so we can update the subIds first.
        const histItem: NodeHistoryItem = S.quanta.nodeHistory.find(function (h: NodeHistoryItem) {
            return h.id === node.id;
        });

        // if we found the histItem we need to update subIds
        if (histItem) {
            subItems = histItem.subItems;

            if (childNode) {
                if (subItems) {
                    // remove id if it exists in history (so we can add to top)
                    subItems = subItems.filter(function (item: NodeHistoryItem) {
                        return item.id !== childNode.id && item.id !== node.id;
                    });
                }
                else {
                    subItems = [];
                }

                if (childNode.id !== node.id) {
                    const childFound = S.quanta.nodeHistory.find(function (h: NodeHistoryItem) {
                        return h.id === childNode.id;
                    });

                    // if this child at at a top level now, don't let it be appended as a child second level item.
                    if (!childFound) {
                        // new NodeHistoryItem
                        subItems.unshift({
                            id: childNode.id,
                            type: childNode.type,
                            content: S.nodeUtil.getShortContent(childNode),
                            subItems: null
                        });
                    }
                }
            }
        }

        // remove node if it exists in history (so we can add to top)
        S.quanta.nodeHistory = S.quanta.nodeHistory.filter(function (h: NodeHistoryItem) {
            return h.id !== node.id;
        });

        // now add to top.
        S.quanta.nodeHistory.unshift({ id: node.id, type: node.type, content: S.nodeUtil.getShortContent(node), subItems });
    }

    removeHtmlTags = (text: string) => {
        if (!text) return text;
        text = this.replaceAll(text, "```", " ");
        const doc = new DOMParser().parseFromString(text, "text/html");
        const ret = doc.body.textContent || "";
        return ret.trim();
    }

    getBrowserMemoryInfo = (): string => {
        // todo-1: research this. According to TypeScript typings there shouldn't even be a 'memory' attribute so this
        // must be some undocumented feature of Chrome?
        if ((performance as any).memory) {
            return "<br>HeapSizeLimit: " + this.formatMemory((performance as any).memory.jsHeapSizeLimit) +
                "<br>TotalHeapSize: " + this.formatMemory((performance as any).memory.totalJSHeapSize) +
                "<br>UsedHeapSize: " + this.formatMemory((performance as any).memory.usedJSHeapSize);
        }
        return null;
    }

    perfStart = (): number => {
        return performance.now();
    }

    perfEnd = (message: string, startTime: number) => {
        const endTime = performance.now();
        console.log(message + " Time=" + (endTime - startTime));
    }

    buildCalendarData = (items: J.CalendarItem[]): EventInput[] => {
        if (!items) return [];
        const ret: EventInput[] = [];

        items.forEach((v: J.CalendarItem) => {
            ret.push({
                id: v.id,
                title: v.title,
                start: v.start,
                end: v.end
            });
        });

        return ret;
    }

    markdown = (val: string): any => {
        if (!val) return "";
        val = marked(val);

        // the marked adds a 'p tag' wrapping we don't need so we remove it just to speed up DOM as much as possible
        val = val.trim();
        val = this.stripIfStartsWith(val, "<p>");
        val = this.stripIfEndsWith(val, "</p>");
        return val;
    }

    // External Emojis!
    insertActPubTags = (val: string, node: J.NodeInfo) => {
        // todo-1: need some typesafety here. what if 'forEach' doesn't even exist?
        let tags: any = S.props.getPropObj(J.NodeProp.ACT_PUB_TAG, node);
        if (tags && tags.forEach) {
            tags.forEach((t: any) => {
                if (t.name && t.icon?.url && t.type === "Emoji") {
                    const img = `<img src='${t.icon.url}'">`;
                    val = this.replaceAll(val, t.name, img);
                }
            })
        }

        // the above algo isn't working fully yet so we rip out any ":tag:" items still in the text
        if (val.indexOf(":") !== -1) {

            // split val into words (space delimited)
            tags = val.split(/ /);
            val = "";
            tags.forEach((t: any) => {
                // skip any `:tag:` words.
                if (t.startsWith(":") && t.endsWith(":")) return;

                // put words back together
                if (val) {
                    val += " ";
                }
                val += t;
            });
        }

        return val;
    }

    formatCurrency = (n: number): string => {
        return currencyFormatter.format(n);
    }

    showBrowserInfo = () => {
        let info = "Browser: " + navigator.userAgent || navigator.vendor || (window as any).opera + "\n  ";

        info += "\n\nType: ";
        if (clientInfo.isMobileOrTablet) {
            info += "Mobile or Tablet";
        }
        else {
            info += "Desktop";
        }

        this.showMessage(info, "Browser Info");
    }

    switchBrowsingMode = () => {
        dispatch("SwitchBrowsingMode", s => {
            s.mobileMode = !s.mobileMode;
            S.localDB.setVal(C.LOCALDB_MOBILE_MODE, s.mobileMode ? "true" : "false", "all-users");
            return s;
        });
    }

    isLocalUserName = (userName: string): boolean => {
        return userName && userName.indexOf("@") === -1;
    }

    // Queries the url for 'Open Graph' data and sendes it back using the callback.
    loadOpenGraph = async (url: string, callback: Function) => {
        // console.log("loadOpenGraph: " + url);
        try {
            const res: J.GetOpenGraphResponse = await S.rpcUtil.rpc<J.GetOpenGraphRequest, J.GetOpenGraphResponse>("getOpenGraph", {
                url
            }, true);
            callback(res.openGraph);
        }
        catch (e) {
            callback(null);
        }
    }

    sendTestEmail = async () => {
        await S.rpcUtil.rpc<J.SendTestEmailRequest, J.SendTestEmailResponse>("sendTestEmail");
        this.showMessage("Send Test Email Initiated.", "Note");
    }

    // Used to sent a message to the server simply to log into the log file as DEBUG, INFO, TRACE, for the purpose of
    // either checking that logging is working, after a live edit of the logger config file or as a text marker
    // for identifying when specific things are happening by injecting into log file some notes or text.
    sendLogText = async () => {
        const text = window.prompt("Enter text to log on server: ");
        if (text) {
            await S.rpcUtil.rpc<J.SendLogTextRequest, J.SendLogTextResponse>("sendLogText", { text });
            this.showMessage("Send log text completed.", "Note");
        }
    }

    showSystemNotification = (title: string, message: string) => {
        if (window.Notification && Notification.permission !== "denied") {
            Notification.requestPermission(function (status) { // status is "granted", if accepted by user
                message = this.removeHtmlTags(message);

                // eslint-disable-next-line no-unused-vars
                const n = new Notification(title, {
                    body: message,

                    /* Chrome is showing it's own icon/image instead of the custom one and I'm not sure why. I've tried
                     both image and icon here and neither works. */
                    image: window.location.origin + "/branding/logo-50px-tr.jpg"
                });
            });
        }
    }

    showPageMessage = (message: string) => {
        // This outter timer is a very slight hack because when the page re-renders currently it resets pageMessage, so we sneak in
        // here behind that to set this.
        setTimeout(() => {
            dispatch("ShowPageMessage", s => {
                s.pageMessage = message;
                return s;
            });
            setTimeout(() => {
                dispatch("ClearPageMessage", s => {
                    s.pageMessage = null;
                    return s;
                });
            }, 5000);
        }, 500);
    }

    loadBookmarks = async () => {
        const state = getAppState();
        if (!state.isAnonUser) {
            const res = await S.rpcUtil.rpc<J.GetBookmarksRequest, J.GetBookmarksResponse>("getBookmarks", null, true);
            // let count = res.bookmarks ? res.bookmarks.length : 0;
            // Log.log("bookmark count=" + count);
            dispatch("loadBookmarks", s => {
                s.bookmarks = res.bookmarks;

                // use a timer to let this dispatch completely finish setting bookmarks before we sent the click to expand.
                setTimeout(() => {
                    // if user has not yet clicked any menus and we just loaded bookmarks, then open up and display the bookmarks menu
                    if (!Menu.userClickedMenu && s.bookmarks?.length > 0) {
                        PubSub.pub(C.PUBSUB_menuClicked, C.BOOKMARKS_MENU_TEXT);
                    }
                }, 250);
                return s;
            });
        }
    }

    playAudioIfRequested = () => {
        const audioUrl = this.getParameterByName("audioUrl");
        if (audioUrl) {
            const startTimeStr = this.getParameterByName("t");
            const startTime = startTimeStr ? parseInt(startTimeStr) : 0;
            setTimeout(() => {
                new AudioPlayerDlg(null, null, null, audioUrl, startTime).open();
            }, 500);
        }
    }

    processUrlParams = (state: AppState) => {
        const passCode = this.getParameterByName("passCode");
        if (passCode) {
            setTimeout(() => {
                new ChangePasswordDlg(passCode).open();
            }, 100);
        }
    }

    loadAnonPageHome = async () => {
        console.log("loadAnonPageHome()");

        try {
            if (this.sendAnonUsersToFeed) {
                S.nav.messagesFediverse();
            }
            else {
                const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("anonPageLoad", {
                    nodeId: g_nodeId || ":home",
                    upLevel: false,
                    siblingOffset: 0,
                    renderParentIfLeaf: false,
                    forceRenderParent: false,
                    offset: 0,
                    goToLastPage: false,
                    forceIPFSRefresh: false,
                    singleNode: false,
                    parentCount: 0
                });

                // if we have trouble accessing even the anon page just drop out to landing page.
                if (!res || !res.success || res.errorType === J.ErrorType.AUTH) {
                    console.log("can't access anonymous page. Has admin user signed all landing page nodes?");
                    // this scenario should only ever happen on a system where the admin has not yet logged in thru a
                    // secure browser (https) with crypto enabled in the browser (or you can use Firefox), and therefore
                    // the admin public landing page nodes are not signed and so we get this error.
                    // We could maybe send back a message to the user that explains this?...but that message could really only
                    // say "Server is not fully configured, check back later"
                    S.user.userLogin();
                    return;
                }
                console.log("renderPage for anonymous");
                S.render.renderPage(res, false, null, true, true);
            }
        }
        catch (e) {
            console.warn("anonPageLoad failed.");
            S.user.userLogin();
        }
    }

    setUserPreferences = (state: AppState, flag: boolean) => {
        if (flag !== state.userPrefs.editMode) {
            state.userPrefs.editMode = flag;
            this.saveUserPreferences(state);
        }
    }

    saveUserPreferences = async (state: AppState, dispatchNow: boolean = true) => {
        if (!state.isAnonUser) {
            await S.rpcUtil.rpc<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
                userNodeId: state.homeNodeId,
                userPreferences: state.userPrefs
            });
        }

        if (dispatchNow) {
            await promiseDispatch("SetUserPreferences", s => {
                s.userPrefs = state.userPrefs;
                if (!s.userPrefs.showParents && s.node) {
                    s.node.parents = null;
                }
                return s;
            });
        }
    }

    countChars = (val: string, char: string): number => {
        if (!val) return 0;
        return val.split(char).length - 1;
    }

    setStateVarsUsingLoginResponse = (res: J.LoginResponse) => {
        if (!res) return;

        dispatch("LoginResponse", s => {
            if (res.userProfile.userNodeId) {
                s.homeNodeId = res.userProfile.userNodeId;
                s.homeNodePath = res.rootNodePath;
            }
            s.userProfile = res.userProfile;
            s.userName = res.userProfile.userName;
            s.isAdminUser = res.userProfile.userName === "admin";
            s.isAnonUser = res.userProfile.userName === J.PrincipalName.ANON;

            // allow for everyone for now
            s.allowedFeatures = "web3"; // res.allowedFeatures;
            // s.allowedFeatures = res.allowedFeatures;

            // Log.log("LoginResponse userName = " + res.userName + ". Features: " + s.allowedFeatures);

            // bash scripting is an experimental feature, and i'll only enable for admin for now, until i'm
            // sure i'm keeping this feature.
            s.allowBashScripting = false;

            s.anonUserLandingPageNode = res.anonUserLandingPageNode;
            s.allowFileSystemSearch = res.allowFileSystemSearch;
            s.userPrefs = res.userPreferences;
            // s.title = !s.isAnonUser ? res.userName : "";
            s.displayName = !s.isAnonUser ? res.userProfile.displayName : "";
            return s;
        });
    }

    // todo-2: need to decide if I want this. It's disabled currently (not called)
    removeRedundantFeedItems = (feedRes: J.NodeInfo[]): J.NodeInfo[] => {
        if (!feedRes || feedRes.length === 0) return feedRes;

        // first build teh set of ids that that are in 'ni.parent.id'
        const idSet: Set<string> = new Set<string>();
        feedRes.forEach((ni: J.NodeInfo) => {
            if (ni.parent) {
                idSet.add(ni.parent.id);
            }
        });

        // now return filtered list only for items where 'id' is not in the set above.
        return feedRes.filter(ni => !idSet.has(ni.id));
    }

    fullscreenViewerActive = (state: AppState): boolean => {
        return state.fullScreenConfig.type !== I.FullScreenType.NONE;
    }

    ctrlKeyCheck = (): boolean => {
        return S.quanta.ctrlKey && (new Date().getTime() - S.quanta.ctrlKeyTime) < 5000;
    }

    readClipboardFile = (): Promise<any> => {
        return new Promise<any>(async (resolve, reject) => {
            (navigator as any)?.clipboard?.read().then(async (data: any) => {
                let done: boolean = false;
                let blob = null;
                for (const item of data) {
                    for (const type of item.types) {
                        blob = await item.getType(type);
                        if (blob) {
                            done = true;
                            break;
                        }
                    }
                    if (done) break;
                }
                resolve(blob);
            });
        });
    }

    resumeEditingOfAbandoned = async () => {
        const editorData = await S.localDB.getVal(C.STORE_EDITOR_DATA);
        if (editorData?.nodeId && editorData?.content) {
            await S.localDB.setVal(C.STORE_EDITOR_DATA, null);
            S.edit.runEditNode(null, editorData.content, editorData.nodeId, true, false, false, null, null);
        }
    }

    adminScriptCommand = (cmd: string) => {
        switch (cmd) {
            case C.ADMIN_COMMAND_FEDIVERSE:
                S.nav.messagesFediverse();
                break;
            case C.ADMIN_COMMAND_TRENDING:
                S.nav.showTrendingHashtags();
                break;
            default:
                break;
        }
    }

    // Leave this at the END of the module since it makes calls to methods that might not be created at
    // arbitrary earlier places in the code.
    daylightSavingsTime: boolean = (this.dst(new Date())) ? true : false;
}
