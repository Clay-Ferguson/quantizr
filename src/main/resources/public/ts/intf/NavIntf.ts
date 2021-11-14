import { AppState } from "../AppState";
import * as J from "../JavaIntf";

export interface NavIntf {
    _UID_ROWID_PREFIX: string;

    login(state: AppState): void;
    logout(state: AppState): void;
    signup(state: AppState): void;
    preferences(state: AppState): void;
    openContentNode(nodePathOrId: string, state?: AppState): Promise<void>;
    geoLocation(state: AppState): void;
    displayingHome(state: AppState): boolean;
    displayingRepositoryRoot(state: AppState): boolean;
    parentVisibleToUser(state: AppState): boolean;
    upLevelResponse(res: J.RenderNodeResponse, id: string, scrollToTop: boolean, state: AppState): void;
    navUpLevelClick(): void;
    navUpLevel(processingDelete: boolean): Promise<void>;
    navOpenSelectedNode(state: AppState): void;
    getSelectedDomElement(state: AppState): HTMLElement;
    clickNodeRow(evt: Event, id: string, state?: AppState): void;
    openNodeById(evt: Event, id: string, state?: AppState): void;
    setNodeSel(selected: boolean, id: string, state: AppState): void;
    navPageNodeResponse(res: J.RenderNodeResponse, state: AppState): void;
    navHome(state: AppState): Promise<void>;
    navPublicHome(state: AppState): void;
    showMainMenu(state: AppState): void;
    navToSibling(siblingOffset: number, state?: AppState): Promise<void>;
    navToPrev(): void;
    navToNext(): void;
    runSearch(evt: Event): void;
    runTimeline(evt: Event): void;
    openNodeFeed(evt: Event, id: string): Promise<void>;
    closeFullScreenViewer(appState: AppState): void;
    prevFullScreenImgViewer(appState: AppState): void;
    nextFullScreenImgViewer(appState: AppState): void;
    getAdjacentNode(dir: string, state: AppState): J.NodeInfo;
    messages(props: Object): void;
}
