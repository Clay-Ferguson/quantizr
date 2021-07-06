import { AppState } from "../AppState";

export interface ViewIntf {
    docElm: any;
    jumpToId(id: string): void;
    refreshTree(nodeId: string, zeroOffset: boolean, renderParentIfLeaf: boolean, highlightId: string, forceIPFSRefresh: boolean, allowScroll: boolean, setTab: boolean, state: AppState): void;
    firstPage(state: AppState): void;
    prevPage(state: AppState): void;
    nextPage(state: AppState): void;
    lastPage(state: AppState): void;
    scrollRelativeToNode(dir: string, state: AppState): void;
    scrollToSelectedNode(state: AppState): void;
    scrollToTop(afterFunc?: Function): Promise<void>;
    runServerCommand(command: string, dlgTitle: string, dlgDescription: string, state: AppState): any;
    getNodeStats(state: AppState, trending: boolean, feed: boolean): any;
    scrollAllTop(state: AppState): void;
}
