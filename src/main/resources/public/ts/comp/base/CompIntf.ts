import { ReactNode } from "react";

export interface CompIntf {
    attribs: any;
    debug: boolean;

    getId(prefix?: string): string;
    onMount(func: Function): void;
    setState(newState: any): void;
    getState(): any;
    mergeState(moreState: any): void;
    setClass(clazz: string): void;
    updateDOM(store: any, id: string): void;
    getAttribs() : Object;
    compRender(): ReactNode;
    addChild(comp: CompIntf): void;
    insertFirstChild(comp: CompIntf): void;
    hasChildren(): boolean;
    setChildren(comps: CompIntf[]): void;
    getChildren(): CompIntf[];
    getRef(warn: boolean): HTMLElement;
    render(): any;
    getCompClass(): string;
    create(): ReactNode;
    tag(type: any, props?: object, childrenArg?: any[]): ReactNode;
}
