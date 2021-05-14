import { EventInput } from "@fullcalendar/react";
import axios, { AxiosPromise, AxiosRequestConfig } from "axios";
import * as marked from "marked";
import { dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import clientInfo from "./ClientInfo";
import { Constants as C } from "./Constants";
import { DialogBase } from "./DialogBase";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { LoadNodeFromIpfsDlg } from "./dlg/LoadNodeFromIpfsDlg";
import { MessageDlg } from "./dlg/MessageDlg";
import { ProgressDlg } from "./dlg/ProgressDlg";
import * as I from "./Interfaces";
import { UtilIntf } from "./intf/UtilIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

let currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
    // These options are needed to round to whole numbers if that's what you want.
    // minimumFractionDigits: 0,
    // maximumFractionDigits: 0,
});

export class Util implements UtilIntf {

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

    // todo-p1: need to complete these
    fileExtensionTypes = {
        md: "md",
        txt: "txt",
        sh: "txt",
        jpg: "img",
        png: "img",
        jpeg: "img",
        mp3: "audio",
        opus: "audio",
        m4a: "audio",
        mp4: "video"
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

        // get the id from this node or any parent node.
        if (evt && evt.target) {
            let target: any = evt.target;
            while (target) {
                // console.log("Checking target.id " + target.id + " for nid");
                id = target.getAttribute("nid");
                if (id) return id;
                target = target.parentElement;
            }
        }

        if (!id) {
            console.log("Unable to get QID from parameter or html element or any parents.");
        }

        return id;
    }

    // #mouseEffects (do not delete tag)
    delayFunc = (func: Function): Function => {
        let state = store.getState();
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
            return `${(val).toFixed(1)} bytes`;
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
        const ext = this.getFileExtensionFromFileName(fileName);
        return this.fileExtensionTypes[ext];
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
        var hexStr = "";
        for (var i = 0; i < arr.length; i++) {
            var hex = (arr[i] & 0xff).toString(16);
            hex = (hex.length === 1) ? "0" + hex : hex;
            hexStr += hex;
        }
        return hexStr;
    }

    hex2buf = (str: string): Uint8Array => {
        if (!str) {
            return new Uint8Array([]);
        }

        var a = [];
        for (var i = 0, len = str.length; i < len; i += 2) {
            a.push(parseInt(str.substr(i, 2), 16));
        }

        return new Uint8Array(a);
    }

    escapeRegExp = (s: string): string => {
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

    contains = (s: string, str: string): boolean => {
        if (!s) return false;
        return s.indexOf(str) !== -1;
    }

    startsWith = (s: string, str: string): boolean => {
        if (!s) return false;
        return s.indexOf(str) === 0;
    }

    endsWith = (s: string, str: string): boolean => {
        return s.indexOf(str, s.length - str.length) !== -1;
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
        if (this.startsWith(s, str)) {
            return s.substring(str.length);
        }
        return s;
    }

    stripIfEndsWith = (s: string, str: string): string => {
        if (this.endsWith(s, str)) {
            return s.substring(0, s.length - str.length);
        }
        return s;
    }

    arrayClone(a: any[]): any[] {
        if (a == null) return null;
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

    getCheckBoxStateById = (id: string): boolean => {
        const checkbox = this.domElm(id);
        if (checkbox) {
            return (<any>checkbox).checked;
        }
        else {
            throw new Error("checkbox not found: " + id);
        }
    }

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

    initProgressMonitor = (): void => {
        // This timer is a singleton that runs always so we don't need to ever clear the timeout. Not a resource leak.
        setInterval(this.progressInterval, 1000);
    }

    progressInterval = (state: AppState): void => {
        const isWaiting = this.isAjaxWaiting();
        if (isWaiting) {
            this.waitCounter++;
            if (this.waitCounter >= 3) {
                if (!this.pgrsDlg) {
                    const dlg = new ProgressDlg(state);
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

    /* Calls to SERVER must do this URL. We allow CORS, and can run the server itself on port 8181 for example, and then let
    the webpack dev server be able to be serving up the JS file(s) on a separate port 8080. Theoretically this should work even
    if the server is truly on a different Machine/IP, but i haven't tried that scenario yet */
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

    ajax = <RequestType extends J.RequestBase, ResponseType>(postName: string, postData: RequestType, //
        callback?: (response: ResponseType) => void, //
        failCallback?: (info: string) => void): AxiosPromise<any> => {
        postData = postData || {} as RequestType;
        postData.userName = postData.userName || S.meta64.userName;
        postData.password = postData.password || S.meta64.password;
        postData.tzOffset = postData.tzOffset || new Date().getTimezoneOffset();
        postData.dst = postData.dst || this.daylightSavingsTime;

        let axiosRequest;

        try {
            if (this.logAjax) {
                console.log("JSON-POST: [" + this.getRpcPath() + postName + "]" + this.prettyPrint(postData));
            }
            else if (this.logAjaxShort) {
                console.log("JSON-POST: [" + this.getRpcPath() + postName + "]");
            }

            this._ajaxCounter++;
            S.meta64.setOverlay(true);
            axiosRequest = axios.post(this.getRpcPath() + postName, postData, <AxiosRequestConfig>{
                // Without this withCredentials axios (at least for CORS requests) doesn't send enough info to allow the server
                // to recognize the same "session", and makes the server malfunction becasue it thinks each request is a
                // new session and fails the login security.
                withCredentials: true
            });
        } catch (ex) {
            this.logAndReThrow("Failed starting request: " + postName, ex);
        }

        // This seems to be just a duplicate of the the/error below so it's redundant.
        // axiosRequest.catch((error) => {
        //     console.error(error);
        // });

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
        axiosRequest.then(//
            // ------------------------------------------------
            // Handle Success
            // ------------------------------------------------
            (response) => {
                try {
                    this._ajaxCounter--;
                    this.progressInterval(null);

                    if (!response.data.success) {
                        if (response.data.message) {
                            console.error("FAILED JSON-RESULT: " + postName + "\n    JSON-RESULT-DATA: " +
                                this.prettyPrint(response));

                            if (typeof failCallback === "function") {
                                failCallback(null);
                            }
                            else {
                                this.showMessage(response.data.message, "Message");
                            }

                            return;
                        }
                        // WARNING: this looks like the right place for a return but does NOT work. Be careful.
                        // return;
                    }

                    if (this.logAjax) {
                        console.log("    JSON-RESULT: " + postName + "\n    JSON-RESULT-DATA: " +
                            this.prettyPrint(response));
                    }

                    if (typeof callback === "function") {
                        callback(<ResponseType>response.data);
                    }
                } catch (ex) {
                    this.logAndReThrow("Failed handling result of: " + postName, ex);
                }
                finally {
                    S.meta64.setOverlay(false);
                }
            },
            // ------------------------------------------------
            // Handle Fail
            // We should only reach here when there's an actual failure to call the server, and is completely
            // separete from the server perhaps haveing an exception where it sent back an error.
            // ------------------------------------------------
            (error) => {
                try {
                    this._ajaxCounter--;
                    this.progressInterval(null);
                    const status = error.response ? error.response.status : "";
                    const info = "Status: " + status + " message: " + error.message + " stack: " + error.stack;
                    console.log("HTTP RESP [" + postName + "]: Error: " + info);

                    if (error.response && error.response.status === 401) {
                        console.log("Not logged in detected.");
                        if (!this.timeoutMessageShown) {
                            this.timeoutMessageShown = true;
                        }

                        // we wait about a second for user to have time to see the message that their session had timed out.
                        // setTimeout(async () => {
                        //     // window.onbeforeunload = null;
                        //     // window.location.href = window.location.origin;
                        //     // await S.localDB.setVal(cnst.LOCALDB_LOGIN_STATE, "0");

                        //     // NOTE: This opens the login dialog. Requires user to click login before attempting a login.
                        //     S.nav.login(state);
                        // }, 200);
                        return;
                    }

                    let msg: string = `Server request failed: \nPostName: ${postName}\n`;
                    msg += "PostData: " + this.prettyPrint(postData) + "\n";

                    if (error.response) {
                        msg += "Error Response: " + this.prettyPrint(error.response) + "\n";
                    }

                    msg += info;
                    console.error("Request failed: msg=" + msg);

                    if (typeof failCallback === "function") {
                        failCallback(msg);
                    }
                    else {
                        const status = error.response ? error.response.status : "";
                        this.showMessage("Request failed: ERROR: " + status + ": " + error.message, "Warning", true);
                    }
                } catch (ex) {
                    this.logAndReThrow("Failed processing: " + postName, ex);
                }
                finally {
                    S.meta64.setOverlay(false);
                }
            });

        return axiosRequest;
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

    focusElmById = (id: string) => {
        const elm: HTMLElement = this.domElm(id);

        if (elm) {
            // console.log(`Element found (${id}), focusing`);
            elm.focus();
        }
    }

    isElmVisible = (elm: HTMLElement) => {
        return elm && elm.offsetHeight > 0;
    }

    /* set focus to element by id */
    delayedFocus = (id: string): void => {
        setTimeout(() => {
            this.focusElmById(id);
        }, 250);
    }

    /*
     * We could have put this logic inside the json method itself, but I can forsee cases where we don't want a
     * message to appear when the json response returns success==false, so we will have to call checkSuccess inside
     * every response method instead, if we want that response to print a message to the user when fail happens.
     *
     * requires: res.success res.message
     */
    checkSuccess = (opFriendlyName, res): boolean => {
        if (!res || !res.success) {
            this.showMessage(opFriendlyName + " failed: " + res.message, "Warning");
        }
        return res.success;
    }

    flashMessage = (message: string, title: string, preformatted: boolean = false, sizeStyle: string = null): void => {
        new MessageDlg(message, title, null, null, preformatted, 4500, null).open();
    }

    showMessage = (message: string, title: string, preformatted: boolean = false, sizeStyle: string = null): Promise<DialogBase> => {
        return new MessageDlg(message, title, null, null, preformatted, 0, null).open();
    }

    addAllToSet = (set: Set<string>, array): void => {
        if (!array) return;
        array.forEach(v => {
            set.add(v);
        });
    }

    nullOrUndef = (obj): boolean => {
        return obj === null || obj === undefined;
    }

    elementExists = (id: string): boolean => {
        if (this.startsWith(id, "#")) {
            id = id.substring(1);
        }

        if (this.contains(id, "#")) {
            console.log("Invalid # in domElm");
            return null;
        }

        const e = document.getElementById(id);
        return !!e;
    }

    /* Takes textarea dom Id (# optional) and returns its value */
    getTextAreaValById = (id: string): string => {
        const de: HTMLInputElement = <HTMLInputElement>this.domElm(id);
        return de.value;
    }

    setInnerHTMLById = (id: string, val: string): void => {
        this.getElm(id, (elm: HTMLElement) => {
            this.setInnerHTML(elm, val);
        });
    }

    setInnerHTML = (elm: HTMLElement, val: string): void => {
        if (elm) {
            elm.innerHTML = val;
        }
    }

    domElmObjCss = (elm: HTMLElement, prop: string, val: string): void => {
        if (elm) {
            elm.style[prop] = val;
        }
    }

    // This may fail. oddly the API where i get the object from here wants to reutrn Elements not HTMLElements.
    domElmObjRemove = (elm: Element): void => {
        if (elm) {
            elm.parentNode.removeChild(elm);
        }
    }

    domElmRemove = (id: string): void => {
        const elm = this.domElm(id);
        if (elm) {
            elm.parentNode.removeChild(elm);
        }
    }

    /* We return a promise that resolves to the element, but also support a callback function
    that can be used optionally whenver that's more convenient */
    getElm = (id: string, exResolve: (elm: HTMLElement) => void = null): Promise<HTMLElement> => {
        return new Promise<HTMLElement>((resolve, reject) => {

            // First we immediately try to get the element.
            const e: HTMLElement = document.getElementById(id);
            if (e) {
                // console.log("ELM found immediately: "+id);
                if (exResolve) {
                    exResolve(e);
                }
                resolve(e);
            }
            // If element not found we just go into a wait for it (polling)
            // (is there a better native JS approach than polling for the element?)
            else {
                let accumWaitTime = 0;
                const timeSlice = 100;

                // don't hang the promise more than 5 seconds, before reporting error and continuing.
                const maxWaitTime = 5000;

                const interval = setInterval(() => {

                    // oops I only want this on PROD because when debugging it can timeout too much when breakpoints are set.
                    accumWaitTime += timeSlice;
                    if (accumWaitTime >= maxWaitTime) {
                        console.error("waited for but never found element: " + id);
                        clearInterval(interval);
                        resolve(null);
                    }

                    const e: HTMLElement = document.getElementById(id);
                    // console.log("waiting for elm: "+id);
                    if (e) {
                        clearInterval(interval);
                        // console.log("Got Elm: "+id);
                        if (exResolve) {
                            exResolve(e);
                        }
                        resolve(e);
                    }
                }, timeSlice);
            }
        });
    }

    /*
    * Gets the RAW DOM element and displays an error message if it's not found. Do not prefix with "#"
    */
    domElm = (id: string): HTMLElement => {

        if (this.startsWith(id, "#")) {
            console.log("whenElm removed obsolete preceding # from ID " + id);
            id = id.substring(1);
        }

        if (this.contains(id, "#")) {
            console.log("Invalid # in domElm");
            return null;
        }

        const e: HTMLElement = document.getElementById(id);
        return e;
    }

    isObject = (obj: any): boolean => {
        return obj && obj.length !== 0;
    }

    currentTimeMillis = (): number => {
        // warning DO NOT USE getMilliseconds, which is only 0 thru 999
        return new Date().getTime();
    }

    getInputVal = (id: string): any => {
        return (<any>this.domElm(id)).value;
    }

    insertString = (val: string, text: string, position: number): string => {
        return [val.slice(0, position), text, val.slice(position)].join("");
    }

    /* returns true if element was found, or false if element not found */
    setInputVal = (id: string, val: string): boolean => {
        if (val == null) {
            val = "";
        }
        const elm = this.domElm(id);
        if (elm) {
            // elm.node.value = val;
            (<any>elm).value = val;
        }
        return !!elm;
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

    setHtml = (id: string, content: string): void => {
        if (content == null) {
            content = "";
        }

        const elm: HTMLElement = this.domElm(id);
        if (!elm) {
            console.log("Unable to setHtml on ID: " + id + ". Not found.");
            return;
        }
        elm.innerHTML = content;
    }

    /* Finds all elements that are under selectors[0], and then finds all under THOSE that are under selectors[1], etc,
    and executes 'func' on the leaf nodes of that kind of search. There may be a way that querySelectorAll can do this all
    at once but i want to get in the chain here in case i need to do other processing along this chain of selections
    */
    domSelExec = (selectors: string[], func: Function, level: number = 0) => {
        if (!selectors || selectors.length === 0) return;

        const elements = document.querySelectorAll(selectors[level]);
        Array.prototype.forEach.call(elements, (el: HTMLElement) => {
            // if at final dept level, exec the function
            if (selectors.length - 1 === level) {
                func(el);
            }
            // else drill deeper, using recursion
            else {
                this.domSelExec(selectors, func, level + 1);
            }
        }
        );
    }

    setElmDisplayById = (id: string, showing: boolean) => {
        const elm: HTMLElement = this.domElm(id);
        if (elm) {
            this.setElmDisplay(elm, showing);
        }
    }

    setElmDisplay = (elm: HTMLElement, showing: boolean) => {
        if (showing) {
            elm.style.display = "";
        }
        else {
            elm.style.display = "none";
        }
    }

    /* Note: There is also Object.keys(obj).length, which computes internally an entire array, as part of processing
    so it's debatable wether the overhead of that is better for large objects */
    getPropertyCount = (obj: Object): number => {
        if (!obj) return 0;
        const names: string[] = Object.getOwnPropertyNames(obj);
        return names ? names.length : 0;
    }

    forEachElmBySel = (sel: string, callback: Function): void => {
        const elements = document.querySelectorAll(sel);
        Array.prototype.forEach.call(elements, callback);
    }

    /* Iterates by callling callback with property key/value pairs for each property in the object
    check to see if tyescript has a better native way to iterate 'hasOwn' properties */
    forEachProp = (obj: Object, callback: I.PropertyIterator): void => {
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

    /*
     * Makes eleId enabled based on vis flag
     *
     * eleId can be a DOM element or the ID of a dom element, with or without leading #
     */
    setEnablement = (elmId: string, enable: boolean): void => {

        let elm: HTMLElement = null;
        if (typeof elmId === "string") {
            elm = this.domElm(elmId);
        } else {
            elm = elmId;
        }

        if (elm == null) {
            console.log("setVisibility couldn't find item: " + elmId);
            return;
        }

        (<any>elm).disabled = !enable;
    }

    /* Programatically creates objects by name, similar to what Java reflection does

    * ex: let example = InstanceLoader.getInstance<NamedThing>(window, 'ExampleClass', args...);
    */
    getInstance = <T>(context: Object, name: string, ...args: any[]): T => {
        const instance = Object.create(context[name].prototype);
        instance.constructor.apply(instance, args);
        return <T>instance;
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
        return (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getFullYear() + " " + strTime;
    }

    formatDateShort = (date): string => {
        return (date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear();
    }

    /* NOTE: There's also a 'history.replaceState()' which doesn't build onto the history but modifies what it thinks
    the current location is. */
    updateHistory = (node: J.NodeInfo, childNodeId: string = null, appState: AppState): void => {
        if (!node) {
            node = appState.node;
        }
        if (!node) {
            return;
        }

        // console.log("updateHistory: id=" + node.id + " name=" + node.name);
        let url, title, state;
        if (node.name) {
            const queryPath = this.getPathPartForNamedNode(node);
            url = window.location.origin + queryPath;

            if (childNodeId && childNodeId !== node.id) {
                url += "#" + childNodeId;
            }
            state = {
                nodeId: ":" + node.name,
                highlightId: (childNodeId && childNodeId !== node.id) ? childNodeId : null
            };
            title = node.name;
        }
        else {
            url = window.location.origin + "/app?id=" + node.id;
            if (childNodeId && childNodeId !== node.id) {
                url += "#" + childNodeId;
            }
            state = {
                nodeId: node.id,
                highlightId: (childNodeId && childNodeId !== node.id) ? childNodeId : null
            };
            title = node.id;
        }

        if (history.state && state.nodeId === history.state.nodeId) {
            history.replaceState(state, title, url);
            // console.log("REPLACED STATE: url: " + url + ", state: " + JSON.stringify(state) + " length=" + history.length);
        }
        else {
            history.pushState(state, title, url);
            // console.log("PUSHED STATE: url: " + url + ", state: " + JSON.stringify(state) + " length=" + history.length);
        }
    }

    getPathPartForNamedNode = (node: J.NodeInfo): string => {
        if (!node || !node.name) return null;

        if (node.owner === "admin") {
            return "/n/" + node.name;
        }
        else {
            return "/u/" + node.owner + "/" + node.name;
        }
    }

    getPathPartForNamedNodeAttachment = (node: J.NodeInfo): string => {
        if (!node || !node.name) return null;

        if (node.owner === "admin") {
            return "/f/" + node.name;
        }
        else {
            return "/f/" + node.owner + "/" + node.name;
        }
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
        let ret = "";
        const p: any = performance as any;
        if (p.memory) {
            ret += "<br>HeapSizeLimit: " + this.formatMemory(p.memory.jsHeapSizeLimit);
            ret += "<br>TotalHeapSize: " + this.formatMemory(p.memory.totalJSHeapSize);
            ret += "<br>UsedHeapSize: " + this.formatMemory(p.memory.usedJSHeapSize);
        }
        return ret;
    }

    perfStart = (): number => {
        return performance.now();
    }

    perfEnd = (message: string, startTime: number): void => {
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
    setDropHandler = (attribs: any, func: (elm: any) => void): void => {
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
            event.currentTarget.style.borderTop = "4px solid green";
        };

        attribs.onDragLeave = function (event) {
            event.stopPropagation();
            event.preventDefault();
            event.currentTarget.style.borderTop = "4px solid transparent";
        };

        attribs.onDrop = function (event) {
            // console.log("onDrop: id="+event.target.id);
            event.stopPropagation();
            event.preventDefault();
            event.currentTarget.style.borderTop = "4px solid transparent";
            func(event);
        };
    }

    generateNewCryptoKeys = (state: AppState): any => {
        new ConfirmDlg("Gernerate new Crypto Keys?", "Warning",
            () => {
                new ConfirmDlg("Warning: Any data encrypted with your current key will become inaccessible, unless you reimport your current key back in.", "Last Chance... One more Click",
                    () => {
                        S.encryption.initKeys(true);
                    }, null, "btn-danger", "alert alert-danger", state
                ).open();
            }, null, "btn-danger", "alert alert-danger", state
        ).open();
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

    // returns true if all children are same owner as parent
    allChildrenAreSameOwner = (node: J.NodeInfo): boolean => {
        if (!node || !node.children) return true;

        for (let child of node.children) {
            if (node.ownerId !== child.ownerId) {
                return false;
            }
        }
        return true;
    }

    formatCurrency = (n: number): string => {
        return currencyFormatter.format(n);
    }

    publishNodeToIpfs = (node: J.NodeInfo): any => {
        this.ajax<J.PublishNodeToIpfsRequest, J.PublishNodeToIpfsResponse>("publishNodeToIpfs", {
            nodeId: node.id
        }, (res) => {
            this.showMessage(res.message, "Server Reply", true);
        });
    }

    loadNodeFromIpfs = (node: J.NodeInfo): any => {
        let state: AppState = store.getState();
        new LoadNodeFromIpfsDlg(state).open();
    }

    getSharingNames = (node: J.NodeInfo, multiLine: boolean): string => {
        if (!node || !node.ac) return null;
        let delimiter = multiLine ? "\n" : ", ";

        let names = S.props.isPublic(node) ? ("public [" + this.getPublicPrivilegesDisplay(node) + "]") : "";
        for (let ac of node.ac) {
            if (ac.principalName !== "public") {
                if (names) {
                    names += delimiter;
                }
                names += "@" + ac.principalName;
            }
        }

        return names;
    }

    getPublicPrivilegesDisplay = (node: J.NodeInfo): string => {
        if (!node || !node.ac) return "";
        let val = "";
        for (let ac of node.ac) {
            if (ac.principalName === "public") {
                // console.log("AC: " + S.util.prettyPrint(ac));
                for (let p of ac.privileges) {
                    if (val) {
                        val += ",";
                    }
                    val += p.privilegeName;
                }
                break;
            }
        }
        return val;
    }

    showBrowserInfo = (): void => {
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

    // remove unused arg (todo-1)
    switchBrowsingMode = (state: AppState): void => {
        dispatch("Action_SwitchBrowsingMode", (s: AppState): AppState => {
            s.mobileMode = !s.mobileMode;
            return s;
        });
    }

    // untested
    // https://stackoverflow.com/questions/1038727/how-to-get-browser-width-using-javascript-code
    getBrowserWidth() {
        return Math.max(
            document.body.scrollWidth,
            document.documentElement.scrollWidth,
            document.body.offsetWidth,
            document.documentElement.offsetWidth,
            document.documentElement.clientWidth
        );
    }

    // untested
    // https://stackoverflow.com/questions/1038727/how-to-get-browser-width-using-javascript-code
    getBrowserHeight() {
        return Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight,
            document.documentElement.clientHeight
        );
    }

    isLocalUserName = (userName: string): boolean => {
        return userName && userName.indexOf("@") !== -1;
    }
}
