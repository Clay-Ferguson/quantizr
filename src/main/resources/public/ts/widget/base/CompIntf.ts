import { ReactNode } from "react";

export type ReactRenderFunc = (type: any, props: any, children: React.ReactNode[]) => React.ReactNode;

export interface CompIntf {

    clazz: string;

    setDomAttr(attrName: string, attrVal: string);

    setIsEnabledFunc(isEnabledFunc: Function); 

    setIsVisibleFunc(isVisibleFunc: Function);

    removeAllChildren(): void;

    getId(): string;

    getElement(): HTMLElement; 

    whenElm(func: Function); 
    whenElmEx(func: Function); 

    setVisible(visible: boolean); 

    setState(newState: any): void;
    mergeState(moreState: any): any;

    setEnabled(enabled: boolean);

    setClass(clazz: string): void; 

    setOnClick(onClick: Function): void; 

    reactRenderHtmlInDiv(type: any): string;
    reactRenderHtmlInSpan(type: any): string;
    updateDOM(store: any, id: string): void;

    setInnerHTML(html: string); 

    getAttribs() : Object;

    compRender(): ReactNode;
}
