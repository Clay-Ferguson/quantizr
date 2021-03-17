import { ReactNode } from "react";
import { AppState } from "../../AppState";

export type ReactRenderFunc = (type: any, props: any, children: React.ReactNode[]) => React.ReactNode;

export interface CompIntf {
    clazz: string;
    e : Function;
    attribs: any;
    jsClassName: string;

    getId(): string;
    getElement(): HTMLElement;
    whenElm(func: Function);
    whenElmEx(func: Function);
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
    childrenExist(): boolean;
    setChildren(comps: CompIntf[]): void;
    getChildren(): CompIntf[];
    _render(): ReactNode;
}
