export type ReactRenderFunc = (type: any, props: any, children: React.ReactNode[]) => React.ReactNode;

export interface CompIntf {

    refreshState(): void;

    setDomAttr(attrName: string, attrVal: string);

    setIsEnabledFunc(isEnabledFunc: Function); 

    setIsVisibleFunc(isVisibleFunc: Function);

    updateState(): boolean;

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

    setInnerHTML(html: string); 

    getTag() : string;

    getAttribs() : Object;

    render(type: any, props: any, children: React.ReactNode[]): React.ReactNode;
}
