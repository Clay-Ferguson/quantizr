import { ReactNode } from "react";

export type ReactRenderFunc = (type: any, props: any, children: React.ReactNode[]) => React.ReactNode;

export interface CompIntf {
    attribs: any;
    jsClassName: string;
    renderRawHtml: boolean;

    getId(): string;
    whenElm(func: Function);
    setVisible(visible: boolean);
    setState(newState: any): void;
    getState(): any;
    mergeState(moreState: any, reuseChildren?: boolean): any;
    setEnabled(enabled: boolean);
    setClass(clazz: string): void;
    reactRenderHtmlInDiv(type: any): string;
    reactRenderHtmlInSpan(type: any): string;
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
    _render(): any;
    domUpdateEvent: Function;
}
