import { ReactNode } from "react";

export interface CompIntf {
    attribs: any;

    getId(): string;
    onMount(func: Function): void;
    setState(newState: any): void;
    getState(): any;
    mergeState(moreState: any): void;
    setClass(clazz: string): void;
    updateDOM(store: any, id: string): void;
    getAttribs() : Object;
    compRender(): ReactNode;
    forceRender(): void;
    addChild(comp: CompIntf): void;
    insertFirstChild(comp: CompIntf): void;
    hasChildren(): boolean;
    setChildren(comps: CompIntf[]): void;
    getChildren(): CompIntf[];
    getRef(): HTMLElement;
    domAddEvent(): void;
    render(): any;
    getCompClass(): string;
    create(): ReactNode;
}
