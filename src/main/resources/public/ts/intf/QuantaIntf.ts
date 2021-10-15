import { AppState } from "../AppState";
import { OpenGraphPanel } from "../comps/OpenGraphPanel";
import { MainMenuDlg } from "../dlg/MainMenuDlg";
import * as J from "../JavaIntf";
import { NodeHistoryItem } from "../NodeHistoryItem";
import { CompIntf } from "../widget/base/CompIntf";
import { TabDataIntf } from "./TabDataIntf";

export interface QuantaIntf {
    hiddenRenderingEnabled: boolean;
    config: any;
    mainMenu: MainMenuDlg;
    app: CompIntf;
    noScrollToId: string;
    appInitialized: boolean;
    curUrlPath: string;
    activeTab: string;
    allowIntersectingObserver: boolean;

    newNodeTargetId: string;
    newNodeTargetOffset: number;

    parentIdToFocusNodeMap: Map<string, string>;
    curHighlightNodeCompRow: CompIntf;

    draggableId: string;
    fadeStartTime: number;
    currentFocusId: string;

    /* doesn't need to be in state */
    userName: string;
    authToken: string;
    loggingOut: boolean;

    // realtime state always holds true if CTRL key is down
    ctrlKey: boolean;
    ctrlKeyTime: number;
    ctrlKeyCheck(): boolean;
    decryptCache: Map<string, string>;
    openGraphData: Map<string, J.OpenGraph>;
    openGraphComps: OpenGraphPanel[];
    nodeHistory: NodeHistoryItem[];

    // after any kind of edit, delete, move, we will be rendering a page that needs to do some scrolling AND MAY
    // potentially render the MORE button onto the screen which would trigger a page grow, so we have this flag to
    // disable the infinite scrolling until it makes sense to allow it.
    // to support: reentry, we consider this 'true' when zero. It's a ref counter type thing.
    allowGrowPage: number;

    tabChanging(prevTab: string, newTab: string, state: AppState): void;
    refreshOpenButtonOnNode(node: J.NodeInfo, state: AppState): void;
    toggleMouseEffect(): void;
    runClickAnimation(x: number, y: number): void;
    setOverlay(showOverlay: boolean): void;
    sendTestEmail(): void;
    showSystemNotification(title: string, message: string): void;
    refresh(state: AppState): void;
    selectTabStateOnly(tabName: string, state: AppState): void;
    selectTab(pageName: string, clickEvent?: boolean): void;
    getSelNodeIdsArray(state: AppState): string[];
    getSelNodesAsMapById(state: AppState): Object;
    getSelNodesArray(state: AppState): J.NodeInfo[];
    clearSelNodes(state: AppState);
    selectAllNodes(nodeIds: string[]);
    updateNodeInfo(node: J.NodeInfo);
    getHighlightedNode(state?: AppState): J.NodeInfo;
    highlightRowById(id: string, scroll: boolean, state: AppState): boolean;
    highlightNode(node: J.NodeInfo, scroll: boolean, state: AppState): void;
    getSingleSelectedNode(state: AppState): J.NodeInfo;
    initApp(): Promise<void>;
    processUrlParams(state: AppState): void;
    displaySignupMessage(): void
    loadAnonPageHome(state: AppState): void;
    setUserPreferences(state: AppState, flag: boolean): void;
    saveUserPreferences(state: AppState): void;
    openSystemFile(fileName: string);
    setStateVarsUsingLoginResponse(res: J.LoginResponse): void;
    updateNodeMap(node: J.NodeInfo, state: AppState): void;
    removeRedundantFeedItems(feedResults: J.NodeInfo[]): J.NodeInfo[];
    getNodeByName(node: J.NodeInfo, name: string, state: AppState): J.NodeInfo;
    findNodeById(state: AppState, nodeId: string): J.NodeInfo;
    fullscreenViewerActive(state: AppState): boolean;
    showMyNewMessages(): void;
    showPublicFediverse(): void;
    tabScrollTop(state: AppState, tabName?: string): void;
    loadBookmarks(): void;
    nodeIdIsVisible(node: J.NodeInfo, nodeId: string, parentPath: string, state: AppState): boolean;
    getDisplayingNode(state: AppState, nodeId: string): J.NodeInfo;
    clearLastNodeIds(): void;
    getActiveTabComp(state: AppState): CompIntf;
    tempDisableAutoScroll(): void;
    getTabDataById(state: AppState, id: string): TabDataIntf;
}
