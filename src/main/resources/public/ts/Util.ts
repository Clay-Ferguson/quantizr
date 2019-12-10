console.log("Util.ts");

declare var Dropzone;
declare var ace;
declare var prettyPrint;

import { MessageDlg } from "./dlg/MessageDlg";
import { ProgressDlg } from "./dlg/ProgressDlg";
import { PasswordDlg } from "./dlg/PasswordDlg";
import * as I from "./Interfaces";
import { UtilIntf } from "./intf/UtilIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";

import axios, { AxiosRequestConfig } from 'axios';
import { NodeInfo } from "./Interfaces";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Util implements UtilIntf {

    static escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    //todo-p1: need to complete these
    fileExtensionTypes = {
        'md': 'md',
        'txt': 'txt',
        'sh': 'txt',
        'jpg': 'img',
        'png': 'img',
        'jpeg': 'img',
        'mp3': 'audio',
        'm4a': 'audio',
        'mp4': 'video'
    };

    editableExtensions = {
        'md': true,
        'txt': true,
        'sh': true
    };

    rhost: string;
    logAjax: boolean = true;
    timeoutMessageShown: boolean = false;
    offline: boolean = false;

    waitCounter: number = 0;
    pgrsDlg: ProgressDlg = null;

    autoReloadIfSessionTimeout: boolean = true;

    hashOfString = (s: string): number => {
        let hash = 0, i, chr;
        if (s.length === 0) return hash;
        for (i = 0; i < s.length; i++) {
            chr = s.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    /** Returns one of the types listed in 'fileExtensionTypes' based on fileName where fileName can either be an actual
    extension or else a full filename including extension */
    getFileTypeFormFileName = (fileName: string): string => {
        let ext = this.getFileExtensionFromFileName(fileName);
        return this.fileExtensionTypes[ext];
    }

    getFileExtensionFromFileName = (fileName: string): string => {
        let ext = "";
        let idx = fileName.lastIndexOf(".");
        if (idx != -1) {
            ext = fileName.substring(idx + 1);
        }
        return ext;
    }

    isEditableFile = (fileName: string): boolean => {
        let ext = this.getFileExtensionFromFileName(fileName);
        return this.editableExtensions[ext];
    }

    getNameFromPath = (fileName: string): string => {
        let name = fileName;
        let idx = fileName.lastIndexOf("/");
        if (idx != -1) {
            name = fileName.substring(idx + 1);
        }
        return name;
    }

    /* The node name is considered to be the last part of the path, but if it matches the 'id' then
    the node is not considered to have a 'name' at all and we return null to indicate that */
    getNodeName = (node: NodeInfo): string => {
        let pathName = this.getNameFromPath(node.path);
        return pathName === node.id ? null : pathName;
    }

    isImageFileName = (fileName: string): boolean => {
        return "img" == this.getFileTypeFormFileName(fileName);
    }

    isAudioFileName = (fileName: string): boolean => {
        return "audio" == this.getFileTypeFormFileName(fileName);
    }

    isVideoFileName = (fileName: string): boolean => {
        return "video" == this.getFileTypeFormFileName(fileName);
    }

    buf2hex = (arr: Uint8Array): string => {
        //return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');

        //Diferent Algorithm:
        var hexStr = '';
        for (var i = 0; i < arr.length; i++) {
            var hex = (arr[i] & 0xff).toString(16);
            hex = (hex.length === 1) ? '0' + hex : hex;
            hexStr += hex;
        }
        return hexStr;
    }

    hex2buf = (str): Uint8Array => {
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

    escapeForAttrib = (s: string): string => {
        //Disabling. When was this ever needed?
        //return this.replaceAll(s, "\"", "&quot;");
        return s;
    }

    unencodeHtml = (s: string): string => {
        if (!this.contains(s, "&"))
            return s;

        let ret = s;
        ret = this.replaceAll(ret, '&amp;', '&');
        ret = this.replaceAll(ret, '&gt;', '>');
        ret = this.replaceAll(ret, '&lt;', '<');
        ret = this.replaceAll(ret, '&quot;', '"');
        ret = this.replaceAll(ret, '&#39;', "'");

        return ret;
    }

    /* this supposedly came from mustache codebase */
    escapeHtml = (str: string): string => {
        if (!str) return str;
        return String(str).replace(/[&<>"'`=\/]/g, function (s) {
            return Util.escapeMap[s];
        });
    }

    replaceAll = (s: string, find: string, replace: string): string => {
        if (!s) return s;
        return s.replace(new RegExp(this.escapeRegExp(find), 'g'), replace);
    }

    contains = (s: string, str: string): boolean => {
        if (!s) return false;
        return s.indexOf(str) != -1;
    }

    startsWith = (s: string, str: string): boolean => {
        if (!s) return false;
        return s.indexOf(str) === 0;
    }

    endsWith = (s: string, str: string): boolean => {
        return s.indexOf(str, s.length - str.length) !== -1;
    }

    chopAtLastChar = (str: string, char: string): string => {
        let idx = str.lastIndexOf(char);
        if (idx != -1) {
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
        return a.slice(0);
    };

    arrayIndexOfItemByProp = (a: any[], propName: string, propVal: string): number => {
        let len = a.length;
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
        let jan = new Date(date.getFullYear(), 0, 1);
        let jul = new Date(date.getFullYear(), 6, 1);
        return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
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

    assertNotNull = (varName) => {
        if (typeof eval(varName) === 'undefined') {
            this.showMessage("Variable not found: " + varName);
        }
    }

    /*
     * We use this variable to determine if we are waiting for an ajax call, but the server also enforces that each
     * session is only allowed one concurrent call and simultaneous calls would just "queue up".
     */
    private _ajaxCounter: number = 0;

    daylightSavingsTime: boolean = (this.dst(new Date())) ? true : false;

    getCheckBoxStateById = (id: string): boolean => {
        let checkbox = this.domElm(id);
        if (checkbox) {
            return (<any>checkbox).checked;
        }
        else {
            throw "checkbox not found: " + id;
        }
    }

    toJson = (obj: Object) => {
        return JSON.stringify(obj, null, 4);
    }

    /* I'm duplicating toJson for now, because i always expect "prettyPrint", so i need to refactor to be all prettyPrint */
    prettyPrint = (obj: Object) => {
        return JSON.stringify(obj, null, 4);
    }

    /*
     * This came from here:
     * http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
     */
    getParameterByName = (name?: any, url?: any): string => {
        if (!url)
            url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"), results = regex.exec(url);
        if (!results)
            return null;
        if (!results[2])
            return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    initProgressMonitor = (): void => {
        setInterval(this.progressInterval, 1000);
    }

    progressInterval = (): void => {
        let isWaiting = this.isAjaxWaiting();
        if (isWaiting) {
            this.waitCounter++;
            if (this.waitCounter >= 3) {
                if (!this.pgrsDlg) {
                    let dlg = new ProgressDlg();
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
        return location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '');
    }

    /* Calls to SERVER must to to this URL. We allow CORS, and can run the server itself on port 8181 for example, and then let
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

    ajax = <RequestType, ResponseType>(postName: string, postData: RequestType, //
        callback?: (response: ResponseType) => void, //
        failCallback?: (info: string) => void) => {
        let axiosRequest;

        try {
            if (this.offline) {
                console.log("offline: ignoring call for " + postName);
                return;
            }

            if (this.logAjax) {
                console.log("JSON-POST: [" + this.getRpcPath() + postName + "]" + JSON.stringify(postData));
            }

            this._ajaxCounter++;
            S.meta64.setOverlay(true);
            axiosRequest = axios.post(this.getRpcPath() + postName, postData, <AxiosRequestConfig>{
                //Without this withCredentials axios (at least for CORS requests) doesn't send enough info to allow the server
                //to recognize the same "session", and makes the server malfunction becasue it basically thinks each request is a 
                //new session and fails the login security. 
                withCredentials: true
            });

        } catch (ex) {
            this.logAndReThrow("Failed starting request: " + postName, ex);
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
        axiosRequest.then(//
            //------------------------------------------------
            // Handle Success
            // Note all paths out of this function MUST call setOverlay(false) before returning
            //------------------------------------------------
            (response) => {
                try {
                    this._ajaxCounter--;
                    this.progressInterval();

                    if (this.logAjax) {
                        console.log("    JSON-RESULT: " + postName + "\n    JSON-RESULT-DATA: "
                            + JSON.stringify(response));
                    }

                    if (!response.data.success) {
                        if (response.data.message) {
                            this.showMessage(response.data.message);
                            return;
                        }
                        //return; //this is VERY much not able to work here yet! looks right but we can'd do it yet
                    }

                    if (typeof callback == "function") {
                        callback(<ResponseType>response.data);
                    }
                } catch (ex) {
                    this.logAndReThrow("Failed handling result of: " + postName, ex);
                }
                finally {
                    S.meta64.setOverlay(false);
                }
            },
            //------------------------------------------------
            // Handle Fail
            //------------------------------------------------
            //todo-2: lookup format for what ths error object will be.
            (error) => {
                try {
                    this._ajaxCounter--;
                    this.progressInterval();
                    console.log("HTTP RESP [" + postName + "]: Error: " + error.response.status);

                    if (error.response && error.response.status === 401) {
                        console.log("Not logged in detected.");
                        this.offline = true;
                        if (!this.timeoutMessageShown) {
                            this.timeoutMessageShown = true;

                            //removing this message. It used to display right before the page autorefreshes using the window.location.href below
                            //after the short timeout.
                            //this.showMessage("Session timed out?");
                        }

                        if (this.autoReloadIfSessionTimeout) {
                            //we wait about a second for user to have time to see the message that their session had timed out.
                            setTimeout(() => {
                                window.onbeforeunload = null;
                                window.location.href = window.location.origin;
                            }, 1000);
                            return;
                        }
                    }

                    let msg: string = `Server request failed: \nPostName: ${postName}\n`;
                    msg += "PostData: " + this.prettyPrint(postData) + "\n";

                    if (error.response && error.response.data) {
                        msg += "Status: " + this.prettyPrint(error.response.data) + "\n";
                    }

                    console.log("Request failed: msg=" + msg);

                    if (typeof failCallback == "function") {
                        failCallback(msg);
                    }
                    else {
                        // That's TMI for getting into to a user.
                        this.showMessage("Request failed: ERROR: " + error.response.status, true);
                    }
                } catch (ex) {
                    this.logAndReThrow("Failed processing server-side fail of: " + postName, ex);
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
        console.error(message + "\nSTACK: " + stack);
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
        let elm: HTMLElement = this.domElm(id);

        if (elm) {
            //console.log(`Element found (${id}), focusing`);
            elm.focus();
        }
    }

    //todo-3: Haven't yet verified this is correct, but i'm not using it anywhere important yet.
    isElmVisible = (elm: HTMLElement) => {
        return elm && elm.offsetHeight > 0;
    }

    /* set focus to element by id (id must be a query selector) */
    delayedFocus = (id: string): void => {
        /* so user sees the focus fast we try at .5 seconds */
        setTimeout(() => {
            this.focusElmById(id);
        }, 500);

        /* we try again a full second later. Normally not required, but never undesirable */
        setTimeout(() => {
            //console.log("Focusing ID: "+id);
            this.focusElmById(id);
        }, 1000);
    }

    /*
     * We could have put this logic inside the json method itself, but I can forsee cases where we don't want a
     * message to appear when the json response returns success==false, so we will have to call checkSuccess inside
     * every response method instead, if we want that response to print a message to the user when fail happens.
     *
     * requires: res.success res.message
     */
    checkSuccess = (opFriendlyName, res): boolean => {
        if (!res.success) {
            this.showMessage(opFriendlyName + " failed: " + res.message);
        }
        return res.success;
    }

    showMessage = (message: string, preformatted: boolean = false, sizeStyle: string = null): void => {
        new MessageDlg(message, "Message", null, null, preformatted).open();
    }

    /* adds all array objects to obj as a set */
    addAll = (obj, a): void => {
        for (let i = 0; i < a.length; i++) {
            if (!a[i]) {
                console.error("null element in addAll at idx=" + i);
            } else {
                obj[a[i]] = true;
            }
        }
    }

    nullOrUndef = (obj): boolean => {
        return obj === null || obj === undefined;
    }

    /*
     * We have to be able to map any identifier to a uid, that will be repeatable, so we have to use a local
     * 'hashset-type' implementation
     */
    getUidForId = (map: { [key: string]: string }, id): string => {
        /* look for uid in map */
        let uid: string = map[id];

        /* if not found, get next number, and add to map */
        if (!uid) {
            uid = "" + S.meta64.nextUid++;
            map[id] = uid;
        }
        return uid;
    }

    elementExists = (id): boolean => {
        if (this.startsWith(id, "#")) {
            id = id.substring(1);
        }

        if (this.contains(id, "#")) {
            console.log("Invalid # in domElm");
            return null;
        }

        let e = document.getElementById(id);
        return e != null;
    }

    /* Takes textarea dom Id (# optional) and returns its value */
    getTextAreaValById = (id): string => {
        let de: HTMLInputElement = <HTMLInputElement>this.domElm(id);
        return de.value;
    }

    setInnerHTMLById = (id: string, val: string): void => {
        S.domBind.whenElm(id, (elm) => {
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

    //This may fail. oddly the API where i get the object from here wants to reutrn Elements not HTMLElements.
    domElmObjRemove = (elm: Element): void => {
        if (elm) {
            elm.parentNode.removeChild(elm);
        }
    }

    domElmRemove = (id: string): void => {
        let elm = this.domElm(id);
        if (elm) {
            elm.parentNode.removeChild(elm);
        }
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

        let e: HTMLElement = document.getElementById(id);
        return e;
    }

    isObject = (obj: any): boolean => {
        return obj && obj.length != 0;
    }

    currentTimeMillis = (): number => {
        return new Date().getMilliseconds();
    }

    emptyString = (val: string): boolean => {
        return !val || val.length == 0;
    }

    getInputVal = (id: string): any => {
        return (<any>this.domElm(id)).value;
    }

    /* returns true if element was found, or false if element not found */
    setInputVal = (id: string, val: string): boolean => {
        if (val == null) {
            val = "";
        }
        let elm = this.domElm(id);
        if (elm) {
            //elm.node.value = val;
            (<any>elm).value = val;
        }
        return elm != null;
    }

    /*
     * displays message (msg) of object is not of specified type
     */
    verifyType = (obj: any, type: any, msg: string) => {
        if (typeof obj !== type) {
            this.showMessage(msg);
            return false;
        }
        return true;
    }

    setHtml = (id: string, content: string): void => {
        if (content == null) {
            content = "";
        }

        let elm: HTMLElement = this.domElm(id);
        if (!elm) {
            console.log("Unable to setHtml on ID: " + id + ". Not found.");
            return;
        }
        elm.innerHTML = content;
    }

    //Finds all elements that are under selectors[0], and then finds all under THOSE that are under selectors[1], etc, 
    //and executes 'func' on the leaf nodes of that kind of search. There may be a way that querySelectorAll can do this all
    //at once but i want to get in the chain here in case i need to do other processing along this chain of selections
    domSelExec = (selectors: string[], func: Function, level: number = 0) => {
        if (!selectors || selectors.length == 0) return;

        let elements = document.querySelectorAll(selectors[level]);
        Array.prototype.forEach.call(elements, (el: HTMLElement) => {
            //if at final dept level, exec the function
            if (selectors.length - 1 == level) {
                func(el);
            }
            //else drill deeper, using recursion 
            else {
                this.domSelExec(selectors, func, level + 1);
            }
        }
        );
    }

    setElmDisplayById = (id: string, showing: boolean) => {
        let elm: HTMLElement = this.domElm(id);
        if (elm) {
            this.setElmDisplay(elm, showing);
        }
    }

    setElmDisplay = (elm: HTMLElement, showing: boolean) => {
        //elm.style.display = showing ? "" : "none";
        if (showing) {
            //$(elm).show();
            elm.style.display = '';
        }
        else {
            elm.style.display = 'none';
            //$(elm).hide();
        }
    }

    getPropertyCount = (obj: Object): number => {
        let count = 0;
        let prop;

        for (prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                count++;
            }
        }
        return count;
    }

    forEachElmBySel = (sel: string, callback: Function): void => {
        let elements = document.querySelectorAll(sel);
        Array.prototype.forEach.call(elements, callback);
    }

    /* Equivalent of ES6 Object.assign(). Takes all properties from src and merges them onto dst */
    mergeProps = (dst: Object, src: Object): void => {
        if (!src) return;
        this.forEachProp(src, (k, v): boolean => {
            dst[k] = v;
            return true;
        });
    }

    /* Equivalent of ES6 Object.assign(). Takes all properties from src and merges them onto dst, except this one
    will notice if the src and dest both have any of the keys defined and will combine the dest by concatinating it to the source 
    rather than setting (overwriting) that property value from the source */
    mergeAndMixProps = (dst: Object, src: Object, mixPrefix: string): void => {
        if (!src) return;
        this.forEachProp(src, (k, v): boolean => {
            if (dst[k] && (typeof dst[k] === 'string')) {
                dst[k] += mixPrefix + v;
            }
            else {
                dst[k] = v;
            }
            return true;
        });
    }

    /* Iterates by callling callback with property key/value pairs for each property in the object 
    
    check to see if tyescript has a better native way to iterate 'hasOwn' properties
    */
    forEachProp = (obj: Object, callback: I.PropertyIterator): void => {
        if (!obj) return;
        for (let prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                /* we use the unusual '== false' here so that returning a value is optional, but if you return false it terminates looping */
                if (callback(prop, obj[prop]) === false) return;
            }
        }
    }

    /*
     * iterates over an object creating a string containing it's keys and values
     */
    printObject = (obj: Object): string => {
        if (!obj) {
            return "null";
        }

        let val: string = ""
        try {
            let count: number = 0;
            this.forEachProp(obj, (prop, v): boolean => {
                console.log("Property[" + count + "]");
                count++;
                return true;
            });

            this.forEachProp(obj, (k, v): boolean => {
                val += k + " , " + v + "\n";
                return true;
            });
        } catch (err) {
            return "err";
        }
        return val;
    }

    /* iterates over an object creating a string containing it's keys */
    printKeys = (obj: Object): string => {
        if (!obj)
            return "null";

        let val: string = "";
        this.forEachProp(obj, (k, v): boolean => {
            if (!k) {
                k = "null";
            }

            if (val.length > 0) {
                val += ',';
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
        if (typeof elmId == "string") {
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
        let instance = Object.create(context[name].prototype);
        instance.constructor.apply(instance, args);
        return <T>instance;
    }

    changeOrAddClassToElm = (elm: HTMLElement, oldClass: string, newClass: string) => {
        this.removeClassFromElmById(elm.id, oldClass);
        this.addClassToElmById(elm.id, newClass);
    }

    /*
     * Removed oldClass from element and replaces with newClass, and if oldClass is not present it simply adds
     * newClass. If old class existed, in the list of classes, then the new class will now be at that position. If
     * old class didn't exist, then new Class is added at end of class list.
     */
    changeOrAddClass = (id: string, oldClass: string, newClass: string) => {
        this.removeClassFromElmById(id, oldClass);
        this.addClassToElmById(id, newClass);
    }

    removeClassFromElmById = (id: string, clazz: string) => {
        S.domBind.whenElm(id, (elm) => {
            this.removeClassFromElm(elm, clazz);
        });
    }

    removeClassFromElm = (el: HTMLElement, clazz: string): void => {
        if (el.classList)
            el.classList.remove(clazz);
        else if (el.className) {
            //WCF: I think this came from here: http://youmightnotneedjquery.com/
            //I personally would have never written this mess of RegExp and found some other way. I hate RegExp!
            el.className = el.className.replace(new RegExp('(^|\\b)' + clazz.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
        }
    }

    addClassToElmById = (id: string, clazz: string): void => {
        //console.log("Adding class "+clazz+" to dom id "+id);
        S.domBind.whenElm(id, (elm) => {
            //console.log("found dom id, adding class now.");
            this.addClassToElm(elm, clazz);
        });
    }

    addClassToElm = (el: HTMLElement, clazz: string): void => {
        if (el.classList) {
            //console.log("add to classList " + clazz);
            el.classList.add(clazz);
        }
        else {
            if (el.className) {
                //console.log("appending to className " + clazz);
                el.className += " " + clazz;
            }
            else {
                //console.log("setting className " + clazz);
                el.className = clazz;
            }
        }
    }

    toggleClassFromElm = (el: any, clazz: string): void => {
        if (el.classList) {
            el.classList.toggle(clazz);
        } else {
            if (el.className) {
                let classes = el.className.split(" ");
                let existingIndex = classes.indexOf(clazz);

                if (existingIndex >= 0)
                    classes.splice(existingIndex, 1);
                else
                    classes.push(clazz);

                el.className = classes.join(" ");
            }
            else {
                el.className = clazz;
            }
        }
    }

    copyToClipboard = (text: string) => {
        (<any>navigator).clipboard.writeText(text).then(function () {
            console.log("Copied to clipboard successfully!");
        }, function () {
            S.util.showMessage("Unable to write to clipboard.");
        });
    }

    triggerCustom = (elm: HTMLElement, evt: string, obj: Object) => {
        if (!elm) {
            console.error("Ignoring Util.triggerCustom. elm is null");
        }

        if ((<any>window).CustomEvent) {
            let event = new CustomEvent(evt, { detail: obj });
        } else {
            let event = document.createEvent('CustomEvent');
            event.initCustomEvent(evt, true, true, obj);
        }

        elm.dispatchEvent(event);
    }

    trigger = (elm: HTMLElement, evt: string) => {
        if (!elm) {
            console.error("Ignoring Util.trigger. elm is null");
        }
        // For a full list of event types: https://developer.mozilla.org/en-US/docs/Web/API/document.createEvent
        let event = document.createEvent('HTMLEvents');
        event.initEvent(evt, true, false);
        elm.dispatchEvent(event);
    }

    formatDate = (date): string => {
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let ampm = hours >= 12 ? "pm" : "am";
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        let strTime = hours + ":" + minutes + ampm;
        return (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getFullYear() + " " + strTime;
    }

    updateHistory = (node: NodeInfo): void => {
        if (!node || !node.path) {
            return;
        }

        let url: string = window.location.origin + "?id=" + node.path;

        history.pushState({ "nodeId": node.path }, node.path, url);
    }
}

