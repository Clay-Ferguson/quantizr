import * as J from "./JavaIntf";

/* These are Client-side only models, and are not seen on the server side ever */

export enum FullScreenType {
    // eslint-disable-next-line no-unused-vars
    NONE, IMAGE, GRAPH, CALENDAR
}

export interface FullScreenConfig {
    type: FullScreenType;
    nodeId?: string;
    ordinal?: number;
}

export interface ValueIntf {
    getValue(): any;
    setValue(val: any): void;
    getValidationError?(): string;
}

/* Function Prototype/Signatore, It is assumed that a return value of false, will abort the iteration, and true continues iterating */
export interface PropertyIterator {
    (prop: string, val: any): boolean;
}

/* Models a time-range in some media where an AD starts and stops */
export class AdSegment {
    constructor(public beginTime: number, public endTime: number) {
    }
}

export interface TextEditorIntf {
    setWordWrap(wordWrap: boolean): void;
    setMode(mode: string): void;
    insertTextAtCursor(text: string, pos?: number): void;
    getSelStart(): number;
    getValue(): string;
    setValue(val: string): void;
    focus(): void;
    onMount(func: Function): void;
    setError(error: string): void;
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

export interface MenuPanelState {
    expanded: Set<string>;

    // we only have these two values to ensure the state change happens even when 'activeMenu' object doesn't itself change
    // because only it's conteined set changes.
    lastClicked: string;
    lastAction: string;
}
