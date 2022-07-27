import { EventInput } from "@fullcalendar/react";
import * as marked from "marked";
import { dispatch, getAppState } from "./AppRedux";
import { AppState } from "./AppState";
import clientInfo from "./ClientInfo";
import { Menu } from "./comp/Menu";
import { Constants as C } from "./Constants";
import { DialogBase } from "./DialogBase";
import { AudioPlayerDlg } from "./dlg/AudioPlayerDlg";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { MessageDlg } from "./dlg/MessageDlg";
import { ProgressDlg } from "./dlg/ProgressDlg";
import * as I from "./Interfaces";
import * as J from "./JavaIntf";
import { NodeHistoryItem } from "./NodeHistoryItem";
import { S } from "./Singletons";

declare var __page;

let currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
    // These options are needed to round to whole numbers if that's what you want.
    // minimumFractionDigits: 0,
    // maximumFractionDigits: 0,
});

export class Util {
    annotations: HTMLDivElement[] = [];
    mouseX: number;
    mouseY: number;

    // I'd like to enable this but if we don't load the tree right away we have to check the 200ish places in the code where
    // we are doing things like state.node.id, and assuming there IS a node on the state, and that will take more testing
    // than I have time for righ tnow, so we can't do the 'default to feed" functionality for now.
    sendAnonUsersToFeed = false;

    weekday: string[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    static escapeMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "/": "&#x2F;",
        "`": "&#x60;",
        "=": "&#x3D;"
    };

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

    rhost: string;
    logAjax: boolean = false;
    logAjaxShort: boolean = false;
    timeoutMessageShown: boolean = false;
    waitCounter: number = 0;
    pgrsDlg: ProgressDlg = null;

    // accepts letters, numbers, underscore, dash.
    // todo-2: enforce this same rule on the server side (Java)
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
        let state = getAppState();
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
        for (let i = 0; i < arr.length; i++) {
            let hex = (arr[i] & 0xff).toString(16);
            hex = (hex.length === 1) ? "0" + hex : hex;
            hexStr += hex;
        }
        return hexStr;
    }

    hex2buf = (str: string): Uint8Array => {
        if (!str) {
            return new Uint8Array([]);
        }

        let a = [];
        for (let i = 0, len = str.length; i < len; i += 2) {
            a.push(parseInt(str.substring(i, i + 2), 16));
        }

        return new Uint8Array(a);
    }

    escapeRegExp = (s: string): string => {
        if (!s) return s;
        return s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    /* this supposedly came from mustache codebase */
    escapeHtml = (str: string): string => {
        if (!str) return str;
        return String(str).replace(/[&<>"'`=\/]/g, function (s) {
            return Util.escapeMap[s];
        });
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

    arrayIndexOfItemByProp = (a: any[], propName: string, propVal: string): number => {
        const len = a.length;
        for (let i = 0; i < len; i++) {
            if (a[i][propName] === propVal) {
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
        let tzOffsetMinutes = date.getTimezoneOffset();
        // console.log("offset: " + tzOffsetMinutes);

        // make the time value in our current local timezone
        let adjustedTime = date.getTime() + sign * tzOffsetMinutes * 1000 * 60;
        return new Date(adjustedTime);
    }

    getDayOfWeek = (date: Date): string => {
        return this.weekday[date.getDay()];
    }

    dst = (date: Date) => {
        return date.getTimezoneOffset() < this.stdTimezoneOffset(date);
    }

    indexOfObject = (arr: any[], obj) => {
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

    /*
     * We use this variable to determine if we are waiting for an ajax call, but the server also enforces that each
     * session is only allowed one concurrent call and simultaneous calls just "queue up".
     */
    private _ajaxCounter: number = 0;

    daylightSavingsTime: boolean = (this.dst(new Date())) ? true : false;

    toJson = (obj: Object): string => {
        return JSON.stringify(obj, null, 4);
    }

    /* I'm duplicating toJson for now, because i always expect "prettyPrint", so i need to refactor to be all prettyPrint */
    prettyPrint = (obj: Object): string => {
        if (!obj) return "null";
        return JSON.stringify(obj, null, 4);
    }

    /*
     * This came from here:
     * http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
     */
    getParameterByName = (name?: any, url?: any): string => {
        if (!name) return null;
        if (!url) {
            url = window.location.href;
        }
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

    initProgressMonitor = () => {
        // This timer is a singleton that runs always so we don't need to ever clear the timeout. Not a resource leak.
        setInterval(this.progressInterval, 1000);
    }

    progressInterval = (state: AppState) => {
        /* welcome.html page doesn't do the overlay (mouse blocking) or progress message when it's
         querying server like the APP would do (index.html) */
        if (__page !== "index") return;

        const isWaiting = this.isAjaxWaiting();
        if (isWaiting) {
            this.waitCounter++;
            if (this.waitCounter >= 3) {
                if (!this.pgrsDlg) {
                    const dlg = new ProgressDlg();
                    this.pgrsDlg = dlg;
                    this.pgrsDlg.open();
                }
            }
        } else {
            this.waitCounter = 0;
            if (this.pgrsDlg) {
                this.pgrsDlg.close();
                this.pgrsDlg = null;
            }
        }
    }

    getHostAndPort = (): string => {
        return location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "");
    }

    getRemoteHost = (): string => {
        if (this.rhost) {
            return this.rhost;
        }

        this.rhost = this.getParameterByName("rhost");
        if (!this.rhost) {
            this.rhost = window.location.origin;
        }

        return this.rhost;
    }

    getRpcPath = (): string => {
        return this.getRemoteHost() + "/mobile/api/";
    }

    ajax = <RequestType extends J.RequestBase, ResponseType>(postName: string, postData: RequestType = null,
        background: boolean = false): Promise<ResponseType> => {
        postData = postData || {} as RequestType;
        let reqPromise: Promise<ResponseType> = null;

        try {
            reqPromise = new Promise<ResponseType>((resolve, reject) => {
                if (this.logAjax) {
                    console.log("JSON-POST: [" + this.getRpcPath() + postName + "]" + this.prettyPrint(postData));
                }
                else if (this.logAjaxShort) {
                    console.log("JSON-POST: [" + this.getRpcPath() + postName + "]");
                }

                if (!background) {
                    this._ajaxCounter++;
                    S.quanta.setOverlay(true);
                }

                // console.log("fetch: " + this.getRpcPath() + postName + " Bearer: " + S.quanta.authToken);
                fetch(this.getRpcPath() + postName, {
                    method: "POST",
                    body: JSON.stringify(postData),
                    headers: {
                        "Content-Type": "application/json",
                        Bearer: S.quanta.authToken || ""
                    },
                    mode: "cors", // no-cors, *cors, same-origin
                    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
                    credentials: "same-origin", // include, *same-origin, omit
                    referrerPolicy: "no-referrer"
                })
                    .then((res: any) => {
                        if (res.status !== 200) {
                            reject({ response: res });
                        }
                        else {
                            return res.text();
                        }
                    })
                    .then((json: string) => {
                        /* if we did a reject above in the first 'then' we will get here with json undefined
                        so we ignore that */
                        if (json) {
                            resolve(JSON.parse(json));
                        }
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
        } catch (ex) {
            this.logAndReThrow("Failed starting request: " + postName, ex);
            if (!background) {
                S.quanta.setOverlay(false);
            }
            return null;
        }

        /**
         * Notes
         * <p>
         * If using then function: promise.then(successFunction, failFunction);
         * <p>
         * I think the way these parameters get passed into done/fail functions, is because there are resolve/reject
         * methods getting called with the parameters. Basically the parameters passed to 'resolve' get distributed
         * to all the waiting methods just like as if they were subscribing in a pub/sub model. So the 'promise'
         * pattern is sort of a pub/sub model in a way
         * <p>
         * The reason to return a 'promise.promise()' method is so no other code can call resolve/reject but can
         * only react to a done/fail/complete.
         * <p>
         * deferred.when(promise1, promise2) creates a new promise that becomes 'resolved' only when all promises
         * are resolved. It's a big "and condition" of resolvement, and if any of the promises passed to it end up
         * failing, it fails this "ANDed" one also.
         */
        reqPromise.then(//
            // ------------------------------------------------
            // Handle Success
            // ------------------------------------------------
            (data: any) => {
                try {
                    if (!background) {
                        this._ajaxCounter--;
                        this.progressInterval(null);
                    }

                    if (this.logAjax) {
                        console.log("    JSON-RESULT: " + postName + "\n    JSON-RESULT-DATA: " +
                            this.prettyPrint(data));
                    }

                    if (!data.success && data.message) {
                        // if we didn't just console log it then console log it now.
                        if (!this.logAjax) {
                            console.error("FAILED JSON-RESULT: " + postName + "\n    JSON-RESULT-DATA: " +
                                this.prettyPrint(data));
                        }
                        this.showMessage(data.message, "Message");

                        // get rid of message so it can't be shown again
                        data.message = null;
                        return;
                    }
                } catch (ex) {
                    this.logAndReThrow("Failed handling result of: " + postName, ex);
                }
                finally {
                    if (!background) {
                        S.quanta.setOverlay(false);
                    }
                }
            })
            // ------------------------------------------------
            // Handle Fail
            // We should only reach here when there's an actual failure to call the server, and is completely
            // separete from the server perhaps haveing an exception where it sent back an error.
            // ------------------------------------------------
            .catch((error) => {
                try {
                    if (!background) {
                        this._ajaxCounter--;
                        this.progressInterval(null);
                    }
                    let status = error.response ? error.response.status : "";
                    const info = "Status: " + status + " message: " + error.message + " stack: " + error.stack;
                    console.log("HTTP RESP [" + postName + "]: Error: " + info);

                    if (error.response?.status === 401) {
                        console.log("Not logged in detected.");
                        if (!this.timeoutMessageShown) {
                            this.timeoutMessageShown = true;
                        }
                        return;
                    }

                    let msg: string = `Failed: \nPostName: ${postName}\n`;
                    msg += "PostData: " + this.prettyPrint(postData) + "\n";

                    if (error.response) {
                        msg += "Error Response: " + this.prettyPrint(error.response) + "\n";
                    }

                    msg += info;
                    console.error("Request failed: msg=" + msg);

                    status = error.response ? error.response.status : "";

                    if (!background) {
                        console.error("Failed: " + status + " " + (error.message || ""));
                        this.showMessage("Something went wrong. Try refreshing your browser page.", "Oops", true);
                    }
                } catch (ex) {
                    this.logAndReThrow("Failed processing: " + postName, ex);
                }
                finally {
                    if (!background) {
                        S.quanta.setOverlay(false);
                    }
                }
            });
        return reqPromise;
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

    ajaxReady = (requestName): boolean => {
        if (this._ajaxCounter > 0) {
            console.log("Ignoring requests: " + requestName + ". Ajax currently in progress.");
            return false;
        }
        return true;
    }

    isAjaxWaiting = (): boolean => {
        return this._ajaxCounter > 0;
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
    checkSuccess = (opFriendlyName, res): boolean => {
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

    addAllToSet = (set: Set<string>, array) => {
        if (!array) return;
        array.forEach(v => {
            set.add(v);
        });
    }

    nullOrUndef = (obj): boolean => {
        return obj === null || obj === undefined;
    }

    isObject = (obj: any): boolean => {
        return obj && obj.length !== 0;
    }

    currentTimeMillis = (): number => {
        // warning DO NOT USE getMilliseconds, which is only 0 thru 999
        return new Date().getTime();
    }

    getInputVal = (id: string): any => {
        return (<any>S.domUtil.domElm(id)).value;
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
        return (typeof (navigator as any).clipboard?.read) === "function";
    }

    copyToClipboard = (text: string) => {
        (<any>navigator).clipboard.writeText(text).then(() => {
            console.log("Copied to clipboard successfully!");
        }, () => {
            this.showMessage("Unable to write to clipboard.", "Warning");
        });
    }

    triggerCustom = (elm: HTMLElement, evt: string, obj: Object) => {
        if (!elm) {
            console.error("Ignoring Util.triggerCustom. elm is null");
        }

        let event = null;
        if ((<any>window).CustomEvent) {
            event = new CustomEvent(evt, { detail: obj });
        } else {
            event = document.createEvent("CustomEvent");
            event.initCustomEvent(evt, true, true, obj);
        }

        elm.dispatchEvent(event);
    }

    trigger = (elm: HTMLElement, evt: string) => {
        if (!elm) {
            console.error("Ignoring Util.trigger. elm is null");
        }
        // For a full list of event types: https://developer.mozilla.org/en-US/docs/Web/API/document.createEvent
        const event = document.createEvent("HTMLEvents");
        event.initEvent(evt, true, false);
        elm.dispatchEvent(event);
    }

    formatDate = (date): string => {
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

    formatDateShort = (date): string => {
        return (date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear();
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

        let content = S.nodeUtil.getShortContent(node);
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
        let subItems = null;

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
        let histItem: NodeHistoryItem = S.quanta.nodeHistory.find(function (h: NodeHistoryItem) {
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
                    let childFound = S.quanta.nodeHistory.find(function (h: NodeHistoryItem) {
                        return h.id === childNode.id;
                    });

                    // if this child at at a top level now, don't let it be appended as a child second level item.
                    if (!childFound) {
                        // new NodeHistoryItem
                        subItems.unshift({ id: childNode.id, type: childNode.type, content: S.nodeUtil.getShortContent(childNode), subIds: null });
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
        let doc = new DOMParser().parseFromString(text, "text/html");
        let ret = doc.body.textContent || "";
        return ret.trim();
    }

    // DO NOT DELETE: THIS CODE WORKS FINE
    // //Linear Animated Scroll
    // //https://stackoverflow.com/questions/21474678/scrolltop-animation-without-jquery
    // scrollToTopLinear = () => {
    //     let scrollDuration = 900;
    //     var scrollStep = -window.scrollY / (scrollDuration / 15),
    //         scrollInterval = setInterval(function () {
    //             if (window.scrollY != 0) {
    //                 window.scrollBy(0, scrollStep);
    //             }
    //             else clearInterval(scrollInterval);
    //         }, 15);
    // }

    // //Non-Linear Animated Scroll (ease in and out):
    // //https://stackoverflow.com/questions/21474678/scrolltop-animation-without-jquery
    animateScrollToTop_v1 = () => {
        const scrollDuration = 900;
        const scrollHeight = window.scrollY;
        const scrollStep = Math.PI / (scrollDuration / 15);
        const cosParameter = scrollHeight / 2;
        let scrollCount = 0;
        let scrollMargin = 0;

        const scrollInterval = setInterval(() => {
            if (window.scrollY !== 0) {
                scrollCount = scrollCount + 1;
                scrollMargin = cosParameter - cosParameter * Math.cos(scrollCount * scrollStep);
                window.scrollTo(0, (scrollHeight - scrollMargin));
            }
            else {
                clearInterval(scrollInterval);
            }
        }, 15);
    }

    animateScrollToTop = () => {

        // just to be careful we can fall back to simpler version of animation frames aren't supported.
        if (!window.requestAnimationFrame) {
            this.animateScrollToTop_v1();
            return;
        }

        const scrollDuration = 900;
        const cosParameter = window.scrollY / 2;
        let scrollCount = 0;
        let oldTimestamp = performance.now();

        const step = (newTimestamp: number) => {
            scrollCount += Math.PI / (scrollDuration / (newTimestamp - oldTimestamp));
            if (scrollCount >= Math.PI) window.scrollTo(0, 0);
            if (window.scrollY === 0) return;
            window.scrollTo(0, Math.round(cosParameter + cosParameter * Math.cos(scrollCount)));
            oldTimestamp = newTimestamp;
            window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }
    /*
        Explanations:
        - pi is the length/end point of the cosinus intervall (see above)
        - newTimestamp indicates the current time when callbacks queued by requestAnimationFrame begin to fire.
          (for more information see https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
        - newTimestamp - oldTimestamp equals the duration

          a * cos (bx + c) + d                      | c translates along the x axis = 0
        = a * cos (bx) + d                          | d translates along the y axis = 1 -> only positive y values
        = a * cos (bx) + 1                          | a stretches along the y axis = cosParameter = window.scrollY / 2
        = cosParameter + cosParameter * (cos bx)    | b stretches along the x axis = scrollCount = Math.PI / (scrollDuration / (newTimestamp - oldTimestamp))
        = cosParameter + cosParameter * (cos scrollCount * x)
    */

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

    resetDropHandler = (attribs: any) => {
        delete attribs.onDragEnter;
        delete attribs.onDragOver;
        delete attribs.onDragLeave;
        delete attribs.onDrop;
    }

    // https://www.w3schools.com/jsref/tryit.asp?filename=tryjsref_ondragenter
    setDropHandler = (attribs: any, fullOutline: boolean, func: (elm: any) => void) => {
        // console.log("setDropHandler: nodeId=" + attribs.id);
        const nonDragBorder = "";

        attribs.onDragEnter = function (event) {
            event.stopPropagation();
            event.preventDefault();
        };

        attribs.onDragOver = function (event) {
            event.stopPropagation();
            event.preventDefault();
            // console.log("onDragOver: id=" + event.target.id);
            event.dataTransfer.dropEffect = "copy"; // See the section on the DataTransfer object.
            if (fullOutline) {
                event.currentTarget.style.border = "2px solid green";
            }
            else {
                event.currentTarget.style.borderTop = "2px solid green";
            }
        };

        attribs.onDragLeave = function (event) {
            event.stopPropagation();
            event.preventDefault();
            if (fullOutline) {
                event.currentTarget.style.border = "2px solid transparent";
            }
            else {
                event.currentTarget.style.borderTop = "2px solid transparent";
            }
        };

        attribs.onDrop = function (event) {
            // console.log("onDrop: id="+event.target.id);
            event.stopPropagation();
            event.preventDefault();
            if (fullOutline) {
                event.currentTarget.style.border = "2px solid transparent";
            }
            else {
                event.currentTarget.style.borderTop = "2px solid transparent";
            }
            func(event);
        };
    }

    generateNewCryptoKeys = async (state: AppState): Promise<any> => {
        let dlg = new ConfirmDlg("Gernerate new Crypto Keys?", "Warning",
            "btn-danger", "alert alert-danger");
        await dlg.open();
        if (!dlg.yes) return;

        dlg = new ConfirmDlg("Warning: Any data encrypted with your current key will become inaccessible, unless you reimport your current key back in.", "Last Chance... One more Click",
            "btn-danger", "alert alert-danger");
        await dlg.open();
        if (dlg.yes) {
            S.encryption.initKeys(true);
        }
    }

    buildCalendarData = (items: J.CalendarItem[]): EventInput[] => {
        if (!items) return [];
        let ret = [];

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
        let tags: any = S.props.getPropObj(J.NodeProp.ACT_PUB_TAG, node);
        if (tags) {
            tags.forEach(t => {
                if (t.name && t.icon?.url && t.type === "Emoji") {
                    let img = `<img src='${t.icon.url}'">`;
                    val = S.util.replaceAll(val, t.name, img);
                }
            })
        }

        // the above algo isn't working fully yet so we rip out any ":tag:" items still in the text
        if (val.indexOf(":") !== -1) {

            // split val into words (space delimited)
            tags = val.split(/ /);
            val = "";
            tags.forEach(t => {
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
            let res: J.GetOpenGraphResponse = await this.ajax<J.GetOpenGraphRequest, J.GetOpenGraphResponse>("getOpenGraph", {
                url
            }, true);
            callback(res.openGraph);
        }
        catch (e) {
            callback(null);
        }
    }

    sendTestEmail = async () => {
        await S.util.ajax<J.SendTestEmailRequest, J.SendTestEmailResponse>("sendTestEmail");
        S.util.showMessage("Send Test Email Initiated.", "Note");
    }

    // Used to sent a message to the server simply to log into the log file as DEBUG, INFO, TRACE, for the purpose of
    // either checking that logging is working, after a live edit of the logger config file or as a text marker
    // for identifying when specific things are happening by injecting into log file some notes or text.
    sendLogText = async () => {
        let text = window.prompt("Enter text to log on server: ");
        if (text) {
            await S.util.ajax<J.SendLogTextRequest, J.SendLogTextResponse>("sendLogText", { text });
            S.util.showMessage("Send log text completed.", "Note");
        }
    }

    showSystemNotification = (title: string, message: string) => {
        if (window.Notification && Notification.permission !== "denied") {
            Notification.requestPermission(function (status) { // status is "granted", if accepted by user
                message = S.util.removeHtmlTags(message);

                let n = new Notification(title, {
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
        let state = getAppState();
        if (!state.isAnonUser) {
            let res = await S.util.ajax<J.GetBookmarksRequest, J.GetBookmarksResponse>("getBookmarks");
            // let count = res.bookmarks ? res.bookmarks.length : 0;
            // Log.log("bookmark count=" + count);
            dispatch("loadBookmarks", s => {
                s.bookmarks = res.bookmarks;

                // if user has not yet clicked any menus and we just loaded bookmarks, then open up and display the bookmarks menu
                if (!Menu.userClickedMenu && s.bookmarks?.length > 0) {
                    s.activeMenu = C.BOOKMARKS_MENU_TEXT;
                }
                return s;
            });
        }
    }

    /* We look at the node, and get the parent path from it, and then if there is a node matching that's being displayed
    in the tree we ensure that the "Open" button is visible. This normally indicates this node has been replied to

    If a reducer is running, just pass the state, because it will be the state we need, but if not we will be doing a
    getState and then dispatching the change.

    WARNING: Both places that were calling this are commented out, so I need to remember why, becasue I didn't 
    add comments when comment thing out saying why.
    */
    refreshOpenButtonOnNode = (node: J.NodeInfo, state: AppState) => {
        if (!node || !state.node || !state.node.children) return;
        let doDispatch = !state;
        state = getAppState(state);
        
        let path = node.path;
        let slashIdx: number = path.lastIndexOf("/");
        if (slashIdx === -1) return;
        let parentPath = path.substring(0, slashIdx);

        /* scan all children being displayed and if one of them is the target parent set the hasChildren
        on it so it'll display the "open" button */
        for (let node of state.node.children) {
            if (node.path === parentPath) {
                node.hasChildren = true;
                if (doDispatch) {
                    dispatch("NodeChanges", s => {
                        // 1: this is a bug even if everything's working ok. We need the entire for loop
                        // to be INSIDE this dispatch, and when you do that be careful and check how 'doDispatch'
                        // flag is supposed to work. This will also be FASTER with only a single dispatch
                        return state;
                    });
                }
                // break out of loop, we're done here.
                break;
            }
        }
    }

    enableMouseEffect = async () => {
        let mouseEffect = await S.localDB.getVal(C.LOCALDB_MOUSE_EFFECT, "allUsers");
        dispatch("ToggleMouseEffect", s => {
            s.mouseEffect = mouseEffect === "1";
            return s;
        });
    }

    /* #mouseEffects (do not delete tag) */
    toggleMouseEffect = () => {
        dispatch("ToggleMouseEffect", s => {
            s.mouseEffect = !s.mouseEffect;
            S.localDB.setVal(C.LOCALDB_MOUSE_EFFECT, s.mouseEffect ? "1" : "0", "allUsers");
            return s;
        });
    }

    /*
    The other part of this is contained in click-effects.scss
    */
    initClickEffect = () => {
        let clickEffect = (e) => {
            // use a timeout so we can call 'getState()' without a react error.
            setTimeout(() => {
                let state = getAppState();
                /* looks like for some events there's not a good mouse position (happened on clicks to drop down cobo boxes),
                 and is apparently 0, 0, so we just check the sanity of the coordinates here */
                if (!state.mouseEffect || (e.clientX < 10 && e.clientY < 10)) return;
                this.runClickAnimation(e.clientX, e.clientY);
            }, 10);
        };
        document.addEventListener("click", clickEffect);
    }

    runClickAnimation = (x: number, y: number) => {
        let d = document.createElement("div");
        d.className = "clickEffect";

        /* todo-2: make this 5 and 12 offset user configurable. I'm using a custom moust pointer that draws a yellow
        circle around my mouse for use with this effect, to record screencast videos, and that icon circle is not centered
        around the actual mouse click arrow tip location, so we have to use an offset here (only when that Linux OS mouse theme is used)
        to get our expanding circle in CSS to be perfectly centered with the one in the mouse theme, becasue an off center look
        is terrible but the 5 and 12 makes it perfect */
        d.style.left = `${x + 5}px`;
        d.style.top = `${y + 12}px`;
        document.body.appendChild(d);

        // This proved not to be reliable and was able to leave
        // dangling orphans not in use, but the timer approach below
        // should be bulletproof.
        // let func = () => {
        //     d.parentElement.removeChild(d);
        // };
        // d.addEventListener("animationend", func);

        setTimeout(() => {
            d.parentElement.removeChild(d);
        }, 400); // this val is in 3 places. put the TS two in a constants file.
    }

    addAnnotation = () => {
        let arrowOption = window.prompt("Annotation Location: tl,tr,bl,br");
        if (!arrowOption) {
            arrowOption = "tl";
        }

        let text = window.prompt("Annotation Text:");
        if (!text) {
            return;
        }

        let d = document.createElement("div");

        let a = document.createElement("div");
        a.className = "arrow-up";
        a.style.left = `${this.mouseX + 15}px`;
        a.style.top = `${this.mouseY - 10}px`;
        document.body.appendChild(a);

        let h = document.createElement("h4");
        h.className = "annotationText";
        let c: any = document.createTextNode(text);
        c.className = "annotationText";
        h.appendChild(c);
        d.appendChild(h);

        d.className = "annotationBox";
        d.style.left = `${this.mouseX}px`;
        d.style.top = `${this.mouseY}px`;
        d.setAttribute("arrowOption", arrowOption);
        this.annotations.push(d);
        this.annotations.push(a);
        document.body.appendChild(d);
        this.dragElement(d, a);
    }

    removeAnnotation = () => {
        if (this.annotations.length > 0) {
            let a = this.annotations.pop();
            a.parentElement.removeChild(a);

            let e = this.annotations.pop();
            e.parentElement.removeChild(e);
        }
    }

    // from here: https://www.w3schools.com/howto/howto_js_draggable.asp
    dragElement(elmnt, arrow) {
        let pos1 = 0;
        let pos2 = 0;
        let pos3 = 0;
        let pos4 = 0;

        // DO NOT DELETE
        // This code can be used in the future for moving something using a dialog header for example
        // if (document.getElementById(elmnt.id + "header")) {
        //     /* if present, the header is where you move the DIV from: */
        //     document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
        // } else {
        //     /* otherwise, move the DIV from anywhere inside the DIV: */
        //     elmnt.onmousedown = dragMouseDown;
        // }
        elmnt.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();

            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;

            document.onmousemove = elementDrag;
            elmnt.style.cursor = "move";
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();

            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            let targX = elmnt.offsetLeft - pos1;
            let targY = elmnt.offsetTop - pos2;

            elmnt.style.left = targX + "px";
            elmnt.style.top = targY + "px";

            if (arrow) {
                switch (elmnt.getAttribute("arrowOption")) {
                    case "tl":
                        arrow.style.left = (targX + 15) + "px";
                        arrow.style.top = (targY - 10) + "px";
                        break;
                    case "tr":
                        arrow.style.left = (targX + elmnt.clientWidth - 30) + "px";
                        arrow.style.top = (targY - 10) + "px";
                        break;
                    case "bl":
                        arrow.style.left = (targX + 15) + "px";
                        arrow.style.top = (targY + elmnt.clientHeight - 1) + "px";
                        arrow.className = "arrow-down";
                        break;
                    case "br":
                        arrow.style.left = (targX + elmnt.clientWidth - 30) + "px";
                        arrow.style.top = (targY + elmnt.clientHeight - 1) + "px";
                        arrow.className = "arrow-down";
                        break;
                    default: break;
                }
            }
        }

        function closeDragElement() {
            /* stop moving when mouse button is released: */
            document.onmouseup = null;
            document.onmousemove = null;
            elmnt.style.cursor = "default";
        }
    }

    playAudioIfRequested = () => {
        let audioUrl = S.util.getParameterByName("audioUrl");
        if (audioUrl) {
            let startTimeStr = S.util.getParameterByName("t");
            let startTime = startTimeStr ? parseInt(startTimeStr) : 0;
            setTimeout(() => {
                new AudioPlayerDlg(null, null, null, audioUrl, startTime).open();
            }, 500);
        }
    }

    processUrlParams = (state: AppState) => {
        let passCode = S.util.getParameterByName("passCode");
        if (passCode) {
            setTimeout(() => {
                new ChangePasswordDlg(passCode).open();
            }, 100);
        }
    }

    loadAnonPageHome = async (state: AppState) => {
        console.log("loadAnonPageHome()");

        try {
            if (this.sendAnonUsersToFeed) {
                S.nav.messagesFediverse();
            }
            else {
                let res = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("anonPageLoad", null, true);

                // if we have trouble accessing even the anon page just drop out to landing page.
                if (!res || !res.success || res.errorType === J.ErrorType.AUTH) {
                    console.log("can't access anonymous page");
                    // check we aren't already at origin (no parameters) then set to origin.
                    if (window.location.href !== window.location.origin) {
                        window.location.href = window.location.origin;
                    }
                    return;
                }
                state = getAppState(state);
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
            await S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
                userNodeId: state.homeNodeId,
                userPreferences: state.userPrefs
            });
        }

        if (dispatchNow) {
            dispatch("SetUserPreferences", s => {
                s.userPrefs = state.userPrefs;
                if (!s.userPrefs.showParents) {
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
            if (res.rootNode) {
                s.homeNodeId = res.rootNode;
                s.homeNodePath = res.rootNodePath;
            }
            s.userName = res.userName;
            s.isAdminUser = res.userName === "admin";
            s.isAnonUser = res.userName === J.PrincipalName.ANON;

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
            s.displayName = !s.isAnonUser ? res.displayName : "";
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
        return !!(state.fullScreenViewId || state.fullScreenGraphId || state.fullScreenCalendarId);
    }

    ctrlKeyCheck = (): boolean => {
        return S.quanta.ctrlKey && (new Date().getTime() - S.quanta.ctrlKeyTime) < 5000;
    }

    readClipboardFile = (): Promise<any> => {
        return new Promise<any>(async (resolve, reject) => {
            (navigator as any).clipboard.read().then(async (data) => {
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
            S.edit.pendingContent = editorData.content;
            S.edit.pendingContentId = editorData.nodeId;
            S.edit.runEditNode(null, editorData.nodeId, true, false, false, null, null);
        }
    }
}
