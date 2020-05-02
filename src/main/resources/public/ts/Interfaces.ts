import * as J from "./JavaIntf";
import { AppState } from "./AppState";
import { Action } from "redux";
import { CompIntf } from "./widget/base/CompIntf";

/* These are Client-side only models, and are not seen on the server side ever */

export interface AppAction extends Action<any> {
    type: string;
    func?: (AppState: any) => AppState;
    update?: (AppState: any) => void;
    data?: any;
}

export interface MainTabPanelIntf extends CompIntf {

}

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

export interface PrivilegeInfo {
    privilegeName: string;
}

export interface NodePrivilegesInfo {
    aclEntries: J.AccessControlInfo[];
    owners: string[];
}
