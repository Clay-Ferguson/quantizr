import { dispatch, getAs, promiseDispatch, StateModFunc } from "./AppContext";
import { AppState } from "./AppState";
import clientInfo from "./ClientInfo";
import { Constants as C } from "./Constants";
import { DialogBase } from "./DialogBase";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { MessageDlg } from "./dlg/MessageDlg";
import { DocumentRSInfo } from "./DocumentRSInfo";
import * as I from "./Interfaces";
import { ConfigProp } from "./Interfaces";
import { TabBase } from "./intf/TabBase";
import * as J from "./JavaIntf";
import { NodeInfo, PrincipalName, PropertyInfo } from "./JavaIntf";
import { S } from "./Singletons";

const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
    // These options are needed to round to whole numbers if that's what you want.
    // minimumFractionDigits: 0,
    // maximumFractionDigits: 0,
});

export class Util {
    // I'd like to enable this but if we don't load the tree right away we have to check the 200ish
    // places in the code where we are doing things like state.node.id, and assuming there IS a node
    // on the state, and that will take more testing than I have time for right now, so we can't do
    // the 'default to feed" functionality for now.
    sendAnonUsersToFeed = false;

    weekday: string[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    fileExtensionTypes: Map<string, string> = new Map<string, string>([
        ["md", "md"],
        ["txt", "txt"],
        ["sh", "txt"],

        ["jpg", "img"],
        ["png", "img"],
        ["jpeg", "img"],

        ["mp3", "audio"],
        ["ogg", "audio"],
        ["wma", "audio"],
        ["opus", "audio"],
        ["m4a", "audio"],
        ["aac", "audio"],
        ["flac", "audio"],
        ["aiff", "audio"],
        ["alac", "audio"],
        ["dsd", "audio"],
        ["pcm", "audio"],
        ["wav", "audio"],

        ["mp4", "video"],
        ["m4p", "video"],
        ["m4v", "video"],
        ["mp2", "video"],
        ["wmv", "video"],
        ["qt", "video"],
        ["mpeg", "video"],
        ["mpe", "video"],
        ["mpv", "video"],
        ["webm", "video"],
        ["mpg", "video"],
        ["avi", "video"],
        ["mov", "video"],
        ["flv", "video"],
        ["swf", "video"],
        ["avchd", "video"]
    ]);

    editableExtensions = {
        md: true,
        txt: true,
        sh: true
    };

    makeHtmlCommentsVisible(content: string): string {
        if (content == null) {
            return null;
        }
        if (content.indexOf("<!--") != -1 && content.indexOf("-->") != -1) {
            content = content.replace("<!--", "**_Private:_** ");
            content = content.replace("-->", "");
        }
        return content;
    }

    getFileIcon(mime: string) {
        if (!mime) return "fa-file-lines";
        if (mime == "application/pdf") return "fa-file-pdf";
        if (mime.startsWith("text")) return "fa-file-lines";
        if (mime.startsWith("image")) return "fa-file-image";
        if (mime.startsWith("audio")) return "fa-file-audio";
        if (mime.startsWith("video")) return "fa-file-video";
        return "fa-file";
    }

    findFirstVisibleElm(parentId: string, childrenClass: string): Element {
        const parent: HTMLElement = document.getElementById(parentId);
        if (parent) {
            const containerRect = parent.getBoundingClientRect();

            // This logic is making the assumption that getElementsByClassName() returns elements on
            // top-down order so it can find the topmost one without verifying by position which is
            // topmost, and I think browsers are required to implement the deterministic ordering in
            // this way. (if not we would have to scan all elements here to find which one had the
            // smallest 'top')
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
    validUsername(v: string): boolean {
        return !!v.match(/^[0-9a-zA-Z\-_]+$/);
    }

    /* To allow functions to be attached directly to any node, without having to create a NEW
    function for each use we call this function to grab the ID off the actual HTML element itself.
    This is the only time and place we ever do this kind of hack, and it's purely for performances
    and make HTML renders significantly faster by avoiding 100s of function object creates per page
    render */
    allowIdFromEvent(evt: Event, id: string): string {
        if (id) return id;
        return S.domUtil.getNodeIdFromDom(evt);
    }

    formatMemory(val: number): string {
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

    searchNodeArray(nodes: NodeInfo[], nodeId: string) {
        if (!nodes) return null;
        for (const n of nodes) {
            if (n.id === nodeId) return n;
        }
        return null;
    }

    hashOfString(s: string): string {
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

    stringifyObject = (obj: any): string => {
        if (!obj) return "null";
        // A helper function to sort the object keys (including nested objects)
        function sortObject(object) {
            if (object === null) return null;
            if (typeof object !== 'object') return object;
            if (Array.isArray(object)) return object.map(sortObject);
            const sortedObj = {};
            Object.keys(object).sort().forEach(key => {
                sortedObj[key] = sortObject(object[key]);
            });
            return sortedObj;
        }

        // Sort the object to ensure consistent serialization
        const sortedObj = sortObject(obj);
        // Serialize the object to a JSON string
        return JSON.stringify(sortedObj);
    }

    hashOfObject(obj: any): string {
        return this.hashOfString(this.stringifyObject(obj));
    }

    /* Returns one of the types listed in 'fileExtensionTypes' based on fileName where fileName can
    either be an actual extension or else a full filename including extension */
    getFileTypeFormFileName(fileName: string): string {
        const ext: string = this.getFileExtensionFromFileName(fileName);
        if (!ext) return;
        return this.fileExtensionTypes.get(ext.toLowerCase());
    }

    getFileExtensionFromFileName(fileName: string): string {
        let ext = "";
        const idx = fileName.lastIndexOf(".");
        if (idx !== -1) {
            ext = fileName.substring(idx + 1);
        }
        return ext;
    }

    isEditableFile(fileName: string): boolean {
        const ext = this.getFileExtensionFromFileName(fileName);
        return this.editableExtensions[ext];
    }

    isImageFileName(fileName: string): boolean {
        return this.getFileTypeFormFileName(fileName) === "img";
    }

    isAudioFileName(fileName: string): boolean {
        return this.getFileTypeFormFileName(fileName) === "audio";
    }

    isVideoFileName(fileName: string): boolean {
        return this.getFileTypeFormFileName(fileName) === "video";
    }

    // note: AI says this is a better method than the one we have below...
    // _buf2hex = (buffer: Uint8Array): string =>
    //     buffer.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

    buf2hex(arr: Uint8Array): string {
        let hexStr = "";
        if (arr) {
            for (const a of arr) {
                const hex = (a & 0xff).toString(16);
                hexStr += (hex.length === 1) ? "0" + hex : hex;
            }
        }
        return hexStr;
    }

    hex2buf(str: string): Uint8Array {
        if (!str) {
            return new Uint8Array([]);
        }

        const a = [];
        for (let i = 0, len = str.length; i < len; i += 2) {
            a.push(parseInt(str.substring(i, i + 2), 16));
        }

        return new Uint8Array(a);
    }

    chopAtLastChar(str: string, char: string): string {
        const idx = str.lastIndexOf(char);
        if (idx !== -1) {
            return str.substring(0, idx);
        }
        else {
            return str;
        }
    }

    stripAllLeading(s: string, char: string): string {
        if (!s) return s;
        while (s.startsWith(char)) {
            s = s.substring(char.length);
        }
        return s;
    }

    stripIfStartsWith(s: string, str: string): string {
        if (!s) return s;
        if (s.startsWith(str)) {
            return s.substring(str.length);
        }
        return s;
    }

    /* chops 'str' off 's' if exists */
    stripIfEndsWith(s: string, str: string): string {
        if (s.endsWith(str)) {
            return s.substring(0, s.length - str.length);
        }
        return s;
    }

    // gets how many of the first chars in 's' match 'char'
    countLeadingChars(s: string, char: string): number {
        if (!s) return 0;
        let count = 0;
        for (let i = 0; i < s.length; i++) {
            if (s.charAt(i) === char) {
                count++;
            }
            else {
                break;
            }
        }
        return count;
    }

    trimLeadingChars(s: string, char: string) {
        if (!s) return s;
        // this would trim leading and trailing: .replace(/^#+|#+$/g, '');
        return s.replace(new RegExp(`^${char}+`, "g"), "");
    }

    arrayClone(a: any[]): any[] {
        if (!a) return null;
        if (a.length === 0) return [];
        return a.slice(0);
    }

    arrayIndexOfItemByProp(props: PropertyInfo[], propName: string, propVal: string): number {
        for (let i = 0; i < props.length; i++) {
            if (props[i][propName] === propVal) {
                return i;
            }
        }
        return -1;
    }

    arrayMoveItem(a: any[], fromIndex: number, toIndex: number) {
        a.splice(toIndex, 0, a.splice(fromIndex, 1)[0]);
    }

    stdTimezoneOffset(date: Date) {
        const jan = new Date(date.getFullYear(), 0, 1);
        const jul = new Date(date.getFullYear(), 6, 1);
        return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    }

    // add with sign=1, subtract with sign=-1
    addTimezoneOffset(date: Date, sign: number): Date {
        const tzOffsetMinutes = date.getTimezoneOffset();

        // make the time value in our current local timezone
        const adjustedTime = date.getTime() + sign * tzOffsetMinutes * 1000 * 60;
        return new Date(adjustedTime);
    }

    getDayOfWeek(date: Date): string {
        return this.weekday[date.getDay()];
    }

    dst(date: Date) {
        return date.getTimezoneOffset() < this.stdTimezoneOffset(date);
    }

    indexOfObject(arr: any[], obj: any) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === obj) {
                return i;
            }
        }
        return -1;
    }

    assert(check: boolean, op: string) {
        if (!check) {
            throw new Error("OP FAILED: " + op);
        }
    }

    /* I'm duplicating toJson for now, because i always expect "prettyPrint", so i need to refactor
    to be all prettyPrint */
    prettyPrint(obj: any): string {
        return obj ? JSON.stringify(obj, null, 4) : "null"
    }

    getParameterByName(name?: any, url?: any): string {
        if (!name) return null;
        url = url || window.location.href;
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

    getHostAndPort(): string {
        return location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "");
    }

    logErr(ex: any, message: string = "") {
        let stack;
        if (!ex.stack) {
            try {
                stack = (<any>new Error()).stack;
            }
            catch (e) {
                stack = "";
            }
        }
        else {
            stack = ex.stack;
        }
        console.error(message + ": " + ex.message + "\nSTACK: " + stack);
    }

    isElmVisible(elm: HTMLElement) {
        return elm?.offsetHeight > 0;
    }

    /*
     * We could have put this logic inside the json method itself, but I can forsee cases where we
     * don't want a message to appear when the json response returns success==false, so we will have
     * to call checkSuccess inside every response method instead, if we want that response to print
     * a message to the user when fail happens.
     */
    checkSuccess(opFriendlyName: string, res: J.ResponseBase): boolean {
        if ((!res || res.code != C.RESPONSE_CODE_OK) && !(res as any).errorShown) {
            this.showMessage(opFriendlyName + " failed: " + (res?.message ? res.message : ""), "Warning");
        }

        return res.code == C.RESPONSE_CODE_OK;
    }

    flashMessage(message: string, title: string, preformatted: boolean = false) {
        new MessageDlg(message, title, null, null, preformatted, 3000, "appModalContNarrowWidth").open();
    }

    flashMessageQuick(message: string, title: string, preformatted: boolean = false) {
        new MessageDlg(message, title, null, null, preformatted, 2000, "appModalContNarrowWidth").open();
    }

    showMessage(message: string, title: string = null, preformatted: boolean = false): Promise<DialogBase> {
        if (!message) return;
        return new MessageDlg(message, title, null, null, preformatted, 0, null).open();
    }

    addAllToSet(set: Set<string>, array: any[]) {
        if (!array) return;
        array.forEach(v => {
            set.add(v);
        });
    }

    isObject(obj: any): boolean {
        return obj && obj.length !== 0;
    }

    currentTimeMillis(): number {
        // warning DO NOT USE getMilliseconds, which is only 0 thru 999
        return new Date().getTime();
    }

    insertString(val: string, text: string, position: number): string {
        return [val.slice(0, position), text, val.slice(position)].join("");
    }

    /*
     * displays message (msg) of object is not of specified type
     */
    verifyType(obj: any, type: string, msg: string) {
        if (typeof obj !== type) {
            this.showMessage(msg, "Warning");
            return false;
        }
        return true;
    }

    /* Note: There is also Object.keys(obj).length, which computes internally an entire array, as
    part of processing so it's debatable wether the overhead of that is better for large objects */
    getPropertyCount(obj: any): number {
        if (!obj) return 0;
        const names: string[] = Object.getOwnPropertyNames(obj);
        return names ? names.length : 0;
    }

    /* Iterates by calling callback with property key/value pairs for each property in the object
    check to see if tyescript has a better native way to iterate 'hasOwn' properties */
    forEachProp(obj: any, callback: I.PropertyIterator) {
        if (!obj) return;
        const names: any[] = Object.getOwnPropertyNames(obj);
        names?.forEach(prop => {
            /* we use the unusual '== false' here so that returning a value is optional, but if you
            return false it terminates looping */
            if (callback(prop, obj[prop]) === false) return;
        });
    }

    /* iterates over an object creating a string containing it's keys */
    printKeys(obj: any): string {
        if (!obj) {
            return "null";
        }

        let val: string = "";
        this.forEachProp(obj, (k, _v): boolean => {
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
    getInstance<T>(context: any, name: string, ...args: any[]): T {
        const instance = Object.create(context[name].prototype);
        instance.constructor.apply(instance, args);
        return <T>instance;
    }

    clipboardReadable(): boolean {
        const allowed = (typeof (navigator as any)?.clipboard?.read) === "function";
        if (!allowed) {
            // looks like on localhost (http) we always end up here unable to access clipboard but the
            // prod server (https) allows the clipboard to work. Not sure the reason.
            console.warn("clipboard.read not available");
        }
        return allowed;
    }

    async copyToClipboard(text: string): Promise<void> {
        try {
            // Use the Clipboard API to write text
            await navigator?.clipboard?.writeText(text);
            S.util.flashMessage("Copied to Clipboard:\n\n" + text, "Clipboard", true);
        } catch (err) {
            console.error("Failed to copy text to clipboard", err);
        }
    }

    formatProperty(val: any, type: string, configProp?: ConfigProp): string {
        switch (type) {
            case I.DomainType.Text:
                return val;
            case I.DomainType.Date:
                if (configProp && !configProp.showTime) {
                    if (typeof val === "string") {
                        return S.util.formatDateShort(new Date(parseInt(val)));
                    }
                    return S.util.formatDateShort(new Date(val));
                }
                else {
                    if (typeof val === "string") {
                        return S.util.formatDateTime(new Date(parseInt(val)));
                    }
                    return S.util.formatDateTime(new Date(val));
                }
            case I.DomainType.Number:
                return "" + val;
            default:
                return val;
        }
    }

    formatDateTime(date: Date): string {
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

    formatDateShort(date: Date): string {
        let year = date.getFullYear();
        if (year > 2000) {
            year -= 2000;
        }
        return (date.getMonth() + 1) + "/" + date.getDate() + "/" + year;
    }

    removeHtmlTags(text: string) {
        if (!text) return text;
        text = text.replaceAll("```", " ");
        const doc = new DOMParser().parseFromString(text, "text/html");
        const ret = doc.body.textContent || "";
        return ret.trim();
    }

    getBrowserMemoryInfo(): string {
        // todo-2: research this. According to TypeScript typings there shouldn't even be a 'memory' attribute so this
        // must be some undocumented feature of Chrome?
        if ((performance as any).memory) {
            return "<br>HeapSizeLimit: " + this.formatMemory((performance as any).memory.jsHeapSizeLimit) +
                "<br>TotalHeapSize: " + this.formatMemory((performance as any).memory.totalJSHeapSize) +
                "<br>UsedHeapSize: " + this.formatMemory((performance as any).memory.usedJSHeapSize);
        }
        return null;
    }

    perfStart(): number {
        return performance.now();
    }

    perfEnd(message: string, startTime: number) {
        const endTime = performance.now();
        console.log(message + " Time=" + (endTime - startTime));
    }

    buildCalendarData(items: J.CalendarItem[]): any[] {
        if (!items) return [];
        const ret: any[] = [];

        items.forEach(v => {
            ret.push({
                id: v.id,
                title: v.title,
                start: v.start,
                end: v.end
            });
        });

        return ret;
    }

    _formatCurrency = (n: number): string => {
        return currencyFormatter.format(n);
    }

    _showBrowserInfo = () => {
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

    _switchBrowsingMode = () => {
        dispatch("SwitchBrowsingMode", s => {
            s.mobileMode = !s.mobileMode;
            S.localDB.setVal(C.LOCALDB_MOBILE_MODE, s.mobileMode ? "true" : "false");
        });
    }

    _sendTestEmail = async () => {
        await S.rpcUtil.rpc<J.SendTestEmailRequest, J.SendTestEmailResponse>("sendTestEmail");
        this.showMessage("Send Test Email Initiated.", "Note");
    }

    // Send emial using the user's default email client
    sendEmail(recipient: string, subject: string, body: string, html: boolean = false) {
        if (html) {
            body = encodeURIComponent(`<!DOCTYPE html><html><body>${body}</body></html>`);
        }

        // Create the mailto link
        const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        // Open the mailto link in a new browser tab
        window.open(mailtoLink, "_blank");
    }

    // Send emial using the user's default email client
    sendTextMessage(phone: string, body: string) {
        // Create the mailto link
        const mailtoLink = `sms:${phone}?body=${encodeURIComponent(body)}`;

        // Open the mailto link in a new browser tab
        window.open(mailtoLink, "_blank");
    }

    // Used to sent a message to the server simply to log into the log file as DEBUG, INFO, TRACE,
    // for the purpose of either checking that logging is working, after a live edit of the logger
    // config file or as a text marker for identifying when specific things are happening by
    // injecting into log file some notes or text.
    _sendLogText = async () => {
        const text = window.prompt("Enter text to log on server: ");
        if (text) {
            await S.rpcUtil.rpc<J.SendLogTextRequest, J.SendLogTextResponse>("sendLogText", { text });
            this.showMessage("Send log text completed.", "Note");
        }
    }

    showSystemNotification(title: string, message: string) {
        if (window.Notification && Notification.permission !== "denied") {
            Notification.requestPermission((_status) => { // status is "granted", if accepted by user
                message = this.removeHtmlTags(message);

                new Notification(title, {
                    body: message,

                    /* todo-2: Chrome is showing it's own icon/image instead of the custom one and
                     I'm not sure why. I've tried both image and icon here and neither works.
                     Another issue is that this 'image' property is apparently deprecated now in
                     current versions of code, so I'm removing it, this is a low priority.

                    image: window.location.origin + "/branding/logo-50px-tr.jpg"
                    */
                });
            });
        }
    }

    // todo-2: We need to accumulate these alerts into a list that's only displayed if the user clicks a
    // notification icon at the top of page. Pull them up in a listbox dialog.
    showPageMessage(message: string) {
        // This outter timer is a very slight hack because when the page re-renders currently it resets
        // pageMessage, so we sneak in here behind that to set this.
        setTimeout(() => {
            dispatch("ShowPageMessage", s => {
                s.pageMessage = message;
            });
            setTimeout(() => {
                dispatch("ClearPageMessage", s => {
                    s.pageMessage = null;
                });
            }, 5000);
        }, 500);
    }

    _loadBookmarks = async () => {
        const ast = getAs();
        if (!ast.isAnonUser) {
            const res = await S.rpcUtil.rpc<J.GetBookmarksRequest, J.GetBookmarksResponse>("getBookmarks", null, true);
            await promiseDispatch("loadBookmarks", s => {
                s.bookmarks = res.bookmarks;
            });
        }
    }

    // caller can optionally pass in the type, and yes for now 'id' is not used, but I want it as a param.
    notifyNodeUpdated(_id: string, type: string) {
        if (type === J.NodeType.BOOKMARK) {
            setTimeout(S.util._loadBookmarks, 100);
        }
    }

    notifyNodeDeleted() {
        const ast = getAs();
        // Update bookmarks, but only if user is viewing the bookmarks page.
        if (ast.node?.type === J.NodeType.BOOKMARK_LIST) {
            setTimeout(S.util._loadBookmarks, 100);
        }
    }

    notifyNodeMoved() {
        const ast = getAs();
        if (ast.node?.type === J.NodeType.BOOKMARK_LIST) {
            setTimeout(S.util._loadBookmarks, 100);
        }
    }

    checkChangePassword() {
        const passCode = this.getParameterByName("passCode");
        if (passCode) {
            setTimeout(() => {
                new ChangePasswordDlg(passCode).open();
            }, 1000);
        }
    }

    _loadAnonPageHome = async () => {
        try {
            if (this.sendAnonUsersToFeed && !getAs().isAnonUser) {
                await S.nav._messagesToFromMe();
            }
            else {
                const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("anonPageLoad", {
                    nodeId: S.quanta.config.initialNodeId || "/r/public/home",
                    upLevel: false,
                    siblingOffset: 0,
                    forceRenderParent: false,
                    offset: 0,
                    goToLastPage: false,
                    singleNode: false,
                    jumpToRss: false
                });

                // if we have trouble accessing even the anon page just drop out to landing page.
                if (res?.code == C.RESPONSE_CODE_OK) {
                    await S.render.renderPage(res, true, null, true, true);
                }
            }
        }
        catch (e) {
            S.util.logErr(e, "anonPageLoad failed.");
            S.rpcUtil.authFail();
        }
    }

    setUserPreferences(flag: boolean) {
        if (flag !== getAs().userPrefs.editMode) {
            this.saveUserPrefs(s => s.userPrefs.editMode = flag);
        }
    }

    async saveUserPrefs(mod: StateModFunc) {
        await promiseDispatch("SetUserPreferences", s => {
            mod(s);
        });

        const ast = getAs();
        if (!ast.isAnonUser) {
            await S.rpcUtil.rpc<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
                userNodeId: ast.userProfile.userNodeId,
                userPreferences: ast.userPrefs
            });
        }
    }

    countChars(val: string, char: string): number {
        if (!val) return 0;
        return val.split(char).length - 1;
    }

    async setInitialStateVars(res: J.LoginResponse) {
        if (!res) return;

        const voice = await S.localDB.getVal(C.LOCALDB_VOICE_INDEX);
        const rate = await S.localDB.getVal(C.LOCALDB_VOICE_RATE);

        await promiseDispatch("LoginResponse", s => {
            s.userProfile = res.userProfile;
            s.userName = res.userProfile.userName;
            s.isAdminUser = res.userProfile.userName === PrincipalName.ADMIN;
            s.isAnonUser = res.userProfile.userName === PrincipalName.ANON;
            s.speechVoice = voice || 0;
            s.speechRate = rate || "normal";

            // bash scripting is an experimental feature, and i'll only enable for admin for now, until i'm
            // sure i'm keeping this feature.
            s.allowBashScripting = false;

            s.anonUserLandingPageNode = res.anonUserLandingPageNode;
            s.allowFileSystemSearch = res.allowFileSystemSearch;
            s.userPrefs = res.userPreferences;

            // s.title = !s.isAnonUser ? res.userName : "";
            s.displayName = !s.isAnonUser ? res.userProfile.displayName : "";
        });
    }

    /* show metadata if the user has the setting ON or if on POSTS node or a COMMENT node as the
        top page-root node */
    showMetaData(ast: AppState, node: NodeInfo) {
        return ast.userPrefs.showMetaData ||
            J.NodeType.POSTS === node?.type ||
            J.NodeType.COMMENT === node?.type;
    }

    fullscreenViewerActive(): boolean {
        return getAs().fullScreenConfig.type !== I.FullScreenType.NONE;
    }

    ctrlKeyCheck(): boolean {
        return S.quanta.ctrlKey && (new Date().getTime() - S.quanta.ctrlKeyTime) < 5000;
    }

    readClipboardFile(): Promise<any> {
        return new Promise<any>((resolve, _reject) => {
            const navigatorAny = navigator as any;
            if (navigatorAny && navigatorAny.clipboard) {
                window.focus();
                navigatorAny.clipboard.read().then((data: any) => {
                    let blob = null;
                    const promises = data.map(item => {
                        return item.types.map(type => {
                            return item.getType(type).then((result: any) => {
                                if (result) {
                                    blob = result;
                                }
                            });
                        });
                    });

                    Promise.all(promises.flat()).then(() => {
                        resolve(blob);
                    });
                });
            }
        });
    }

    _resumeEditingOfAbandoned = async () => {
        const editorData = await S.localDB.getVal(C.STORE_EDITOR_DATA);
        if (editorData?.nodeId && editorData?.content) {
            await S.localDB.setVal(C.STORE_EDITOR_DATA, null);
            S.edit.runEditNode(editorData.content, editorData.nodeId, false, false, false, null);
        }
    }

    getFriendlyPrincipalName(ac: J.AccessControlInfo) {
        return ac.principalName;
    }

    willRenderDocIndex(ast: AppState = null): boolean {
        const data: TabBase = S.tabUtil.getAppTabData(C.TAB_DOCUMENT, ast);
        if (!data || !data.props) return false;
        const info = data.props as DocumentRSInfo;
        if (!info.results || info.results.length < 2) return false;

        let idx = 0;
        for (const node of info.results) {
            // we have idx to skip the top node because we know for sure it does have children, as
            // the root of the document
            if (idx > 0) {
                if (node.hasChildren) {
                    return true;
                }
            }
            idx++;
        }
        return false;
    }

    getNodeFromEvent(evt: Event): NodeInfo {
        const nodeId = S.domUtil.getNodeIdFromDom(evt);
        if (!nodeId) return;
        return S.nodeUtil.findNode(nodeId);
    }

    // We do some line-by-line processing of the content to prepare for rendering as markown.
    // Processing URLS:
    //     You can use "* " to not do opengraph, and that you can use "- " to 
    //     show opengraph but not the link url, and "-- " to show opengraph but without long description and without the link url.
    processLines(content: string): string {
        // check if we have any content to process before looping all lines
        if (!content || content.toLowerCase().indexOf("http") === -1) return content;

        // tricky way to check if no lines at all start with '-'. If none do, then we can skip the
        // whole processing.
        if (content.indexOf("-") !== 0 && content.indexOf("\n-") === -1) return content;

        // When the rendered content contains urls we will load the "Open Graph" data and display it below the content.
        let ret = "";
        const lines = content.split("\n");

        if (lines) {
            lines.forEach(line => {
                if (line.startsWith("-")) {
                    if (line.startsWith("- http://") || line.startsWith("- https://") ||
                        line.startsWith("-- http://") || line.startsWith("-- https://")) {
                        return;
                    }
                }
                if (ret) {
                    ret += "\n";
                }
                ret += line;
            });
        }
        return ret;
    }

    // Leave this at the END of the module since it makes calls to methods that might not be created at
    // arbitrary earlier places in the code.
    _daylightSavingsTime: boolean = (this.dst(new Date())) ? true : false;
}