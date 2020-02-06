import * as J from "./JavaIntf";

/* These are Client-side only models, and are not seen on the server side ever */

/* Function Prototype/Signatore, It is assumed that a return value of false, will abort the iteration, and true continues iterating */
export interface PropertyIterator {
    (prop: string, val: any): boolean;
}

/* Models a time-range in some media where an AD starts and stops */
export class AdSegment {
    constructor(public beginTime: number,//
        public endTime: number) {
    }
}

export interface TextEditorIntf {
    setWordWrap(wordWrap: boolean): void;
    setMode(mode: string): void;
    insertTextAtCursor(text: string): void;
    getValue(): string;
    focus(): void;
    whenElm(func: Function): void;
}

export interface CheckboxIntf {
    setChecked(checked: boolean): void;
    getChecked(): boolean;
}

export class PropEntry {
    //The 'id' is of the EditPropTextarea element. We could theoretially make this hold the ACTUAL EditPropTextarea object reference itself
    //and when doing so probably use an interface of EditPRopTextarea just to be safer against circular references since this interfeces
    //module is imported into pretty much every other module.
    constructor(public property: J.PropertyInfo, //
        public readOnly: boolean, //
        public binary: boolean,
        public comp?: TextEditorIntf,
        public checkBox?: CheckboxIntf) {
    }
}

export interface PrivilegeInfo {
    privilegeName: string;
}

export interface NodePrivilegesInfo {
    aclEntries: J.AccessControlEntryInfo[];
    owners: string[];
    publicAppend: boolean;
}
