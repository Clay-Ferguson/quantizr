import { AppState } from "../AppState";

export interface ViewIntf {
    docElm: any;
    jumpToId(id: string, forceRenderParent?: boolean): void;
    refreshTree(nodeId: string, zeroOffset: boolean, renderParentIfLeaf: boolean, highlightId: string,
         forceIPFSRefresh: boolean, scrollToTop: boolean, allowScroll: boolean, setTab: boolean, forceRenderParent: boolean, state: AppState): Promise<void>;
    firstPage(state: AppState): void;
    prevPage(state: AppState): void;
    nextPage(state: AppState): void;
    growPage(state: AppState): void;
    lastPage(state: AppState): void;
    scrollRelativeToNode(dir: string, state: AppState): void;
    scrollToSelectedNode(state: AppState): void;
    scrollToTop(afterFunc?: Function): Promise<void>;
    runServerCommand(command: string, dlgTitle: string, dlgDescription: string, state: AppState): Promise<void>;
    getNodeStats(state: AppState, trending: boolean, feed: boolean): Promise<void>;
    scrollAllTop(state: AppState): void;
}
