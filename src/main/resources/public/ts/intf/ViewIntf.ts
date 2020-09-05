import { AppState } from "../AppState";

export interface ViewIntf {
    docElm: any;

    refreshTree(nodeId: string, renderParentIfLeaf: boolean, highlightId: string, isInitialRender: boolean, forceIPFSRefresh: boolean, allowScroll: boolean, setTab: boolean, state: AppState): void;
    firstPage(state: AppState): void;
    prevPage(state: AppState): void;
    nextPage(state: AppState): void;
    lastPage(state: AppState): void;
    scrollRelativeToNode(dir: string, state: AppState): void;
    scrollToSelectedNode(state: AppState): void;
    scrollToTop(afterFunc?: Function): Promise<void>;
    runServerCommand(command: string, dlgTitle: string, dlgDescription: string, state: AppState): any;
    displayNotifications(command: string, state: AppState): any;
}
