import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface UtilIntf {
    logAjax: boolean;
    //offline: boolean;
    waitCounter: number;
    pgrsDlg: any;

    validUsername(inputtxt: string): boolean;
    hashOfString(s: string) : number;
    isImageFileName(fileName: string): boolean;
    isAudioFileName(fileName: string): boolean;
    isVideoFileName(fileName: string): boolean;
    isEditableFile(fileName: string) : boolean;
    prettyPrint(obj: Object): void;
    buf2hex(arr: Uint8Array): string;
    hex2buf(str: string): Uint8Array;
    escapeRegExp(s: string): string;
    escapeForAttrib(s: string): string;
    unencodeHtml(s: string): string;
    escapeHtml(str: string): string; 
    replaceAll(s: string, find: string, replace: string): string;
    contains(s: string, str: string): boolean;
    startsWith(s: string, str: string): boolean;
    endsWith(s: string, str: string): boolean;
    chopAtLastChar(str: string, char: string): string;
    stripIfStartsWith(s: string, str: string): string;
    stripIfEndsWith(s: string, str: string): string;
    arrayClone(a: any[]): any[];
    arrayIndexOfItemByProp(a: any[], propName: string, propVal: string): number;
    arrayMoveItem(a: any[], fromIndex: number, toIndex: number);
    stdTimezoneOffset(date: Date);
    dst(date: Date);
    indexOfObject(arr: any[], obj);
    assertNotNull(varName);
    domSelExec(selectors: string[], func: Function, level?: number);

    daylightSavingsTime: boolean;

    getCheckBoxStateById(id: string): boolean;
    toJson(obj: Object);

    getParameterByName(name?: any, url?: any): string;
    initProgressMonitor(): void;
    progressInterval(): void;
    getHostAndPort(): string;
    getRpcPath(): string;

    //todo-1: need to make all calls to these functions use promises (be careful about failure case)
    ajax<RequestType, ResponseType>(postName: string, postData: RequestType,
        callback?: (response: ResponseType) => void,
         failCallback?: (response: string) => void);
    logAndThrow(message: string);
    logAndReThrow(message: string, exception: any);
    ajaxReady(requestName): boolean;
    isAjaxWaiting(): boolean;
    focusElmById(id: string);
    isElmVisible(elm: HTMLElement);
    delayedFocus(id: string): void;
    checkSuccess(opFriendlyName, res): boolean;
    flashMessage(message: string, preformatted?: boolean, sizeStyle?: string): void;
    showMessage(message: string, preformatted?: boolean, sizeStyle?: string): void;
    addAll(obj, a): void;
    addAll(obj, a): void;
    nullOrUndef(obj): boolean;
    elementExists(id): boolean;
    getTextAreaValById(id): string;
    domElm(id: string): HTMLElement;
    domElmObjRemove(elm: Element);
    domElmRemove(id : string): void;
    domElmObjCss(elm: HTMLElement, prop: string, val: string): void;
    setInnerHTMLById(id: string, val: string): void;
    setInnerHTML(elm: HTMLElement, val: string): void;
    isObject(obj: any): boolean;
    currentTimeMillis(): number;
    getInputVal(id: string): any;
    setInputVal(id: string, val: string): boolean;
    verifyType(obj: any, type: any, msg: string);
    setHtml(id: string, content: string): void;
    setElmDisplayById(id: string, showing: boolean);
    setElmDisplay(elm: HTMLElement, showing: boolean);
    getPropertyCount(obj: Object): number;
    forEachElmBySel(sel: string, callback: Function): void;
    mergeProps(dst: Object, src: Object): void;
    mergeAndMixProps(dst: Object, src: Object, mixPrefix: string): void;
    forEachProp(obj: Object, callback: I.PropertyIterator): void;
    printObject(obj: Object): string;
    printKeys(obj: Object): string;
    setEnablement(elmId: string, enable: boolean): void;
    getInstance<T>(context: Object, name: string, ...args: any[]): T;
    changeOrAddClassToElm(elm: HTMLElement, oldClass: string, newClass: string);
    changeOrAddClass(id: string, oldClass: string, newClass: string);
    removeClassFromElmById(id: string, clazz: string);
    removeClassFromElm(el: HTMLElement, clazz: string): void;
    addClassToElmById(id: string, clazz: string): void;
    addClassToElm(el: HTMLElement, clazz: string): void;
    toggleClassFromElm(el: any, clazz: string): void;
    copyToClipboard(text: string);
    triggerCustom(elm: HTMLElement, evt: string, obj: Object): void;
    trigger(elm: HTMLElement, evt: string): void;
    formatDate(date) : string;
    updateHistory(node: J.NodeInfo, childNode?: J.NodeInfo): void;
    getElm(id: string, exResolve?: (elm: HTMLElement) => void): Promise<HTMLElement>;
    animateScrollToTop(): any;
    assert(check: boolean, op: string): void;
}
