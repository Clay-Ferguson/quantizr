import { ReactNode } from "react";

export type ReactRenderFunc = (type: any, props: any, children: React.ReactNode[]) => React.ReactNode;

export interface CompIntf {

    refreshState(): void;

    setDomAttr(attrName: string, attrVal: string);

    setIsEnabledFunc(isEnabledFunc: Function); 

    setIsVisibleFunc(isVisibleFunc: Function);

    removeAllChildren(): void;

    getId(): string;

    getElement(): HTMLElement; 

    whenElm(func: Function); 

    setVisible(visible: boolean); 

    setEnabled(enabled: boolean);

    setClass(clazz: string): void; 

    setOnClick(onClick: Function): void; 

    reactRenderHtmlInDiv(type: any): string;
    reactRenderHtmlInSpan(type: any): string;
    reactRenderToDOM(id: string): void;

    setInnerHTML(html: string); 

    getTag() : string;

    getAttribs() : Object;

    compRender(): ReactNode;
}
