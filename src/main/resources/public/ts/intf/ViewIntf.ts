import * as J from "../JavaIntf";

export interface ViewIntf {
    docElm: any;

    refreshTree(nodeId?: string, renderParentIfLeaf?: boolean, highlightId?: string, isInitialRender?: boolean, forceIPFSRefresh?: boolean): void;
    firstPage(): void;
    prevPage(): void;
    nextPage(): void;
    lastPage(): void;
    scrollRelativeToNode(dir: string): void;
    scrollToSelectedNode(): Promise<void>;
    scrollToTop(afterFunc?: Function): Promise<void>;
    getPathDisplay(node: J.NodeInfo, delim: string): string;
    runServerCommand(command: string): any;
    graphDisplayTest(): any;
    displayNotifications(command: string): any;
}
