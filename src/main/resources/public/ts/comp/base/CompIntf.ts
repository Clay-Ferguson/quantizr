import { ReactNode } from "react";

export type ReactRenderFunc = (type: any, props: any, children: React.ReactNode[]) => React.ReactNode;

export interface CompIntf {
    attribs: any;
    renderRawHtml: boolean;

    getId(): string;
    whenElm(func: Function);
    setState(newState: any): void;
    getState(): any;
    mergeState(moreState: any, reuseChildren?: boolean): any;
    setClass(clazz: string): void;
    updateDOM(store: any, id: string): void;
    setInnerHTML(html: string);
    getAttribs() : Object;
    compRender(): ReactNode;
    forceRender(): void;
    addChild(comp: CompIntf): void;
    hasChildren(): boolean;
    setChildren(comps: CompIntf[]): void;
    getChildren(): CompIntf[];
    safeGetChildren(): CompIntf[];
    getRef(): HTMLElement;
    domAddEvent(): void;
    render(): any;
    getCompClass(): string;
    create(): ReactNode;
    domUpdateEvent: Function;
}
