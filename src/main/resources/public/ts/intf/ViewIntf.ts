import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface ViewIntf {
    compareNodeA: I.NodeInfo;

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
