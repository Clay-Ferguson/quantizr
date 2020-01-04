import * as I from "../Interfaces";

export interface ViewIntf {
    compareNodeA: I.NodeInfo;

    updateStatusBar(): void;
    refreshTreeResponse(res?: I.RenderNodeResponse, targetId?: any, scrollToTop?: boolean): void;
    refreshTree(nodeId?: string, 
        renderParentIfLeaf?: boolean, 
        highlightId?: string, 
        isInitialRender?: boolean, 
        forceIPFSRefresh?: boolean,
        scrollToFirstChild?: boolean): void;
    firstPage(): void;
    prevPage(): void;
    nextPage(): void;
    lastPage(): void;
    scrollRelativeToNode(dir: string): void;
    scrollToSelectedNode(): Promise<void>;
    scrollToTop(afterFunc?: Function): Promise<void>;
    getPathDisplay(node: I.NodeInfo, delim: string): string;
    runServerCommand(command: string): any;
    graphDisplayTest(): any;
    displayNotifications(command: string): any;
    setCompareNodeA(): any;
    compareAsBtoA(): any;
    processNodeHashes(verify: boolean): any;
}
