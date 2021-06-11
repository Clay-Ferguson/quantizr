import { AppState } from "../AppState";
import { MainMenuDlg } from "../dlg/MainMenuDlg";
import * as J from "../JavaIntf";
import { AppTab } from "../widget/AppTab";
import { CompIntf } from "../widget/base/CompIntf";

export interface Meta64Intf {

    hiddenRenderingEnabled: boolean;
    config: any;
    mainMenu: MainMenuDlg;
    app: CompIntf;
    noScrollToId: string;
    appInitialized: boolean;
    curUrlPath: string;
    deviceWidth: number;
    deviceHeight: number;

    parentIdToFocusNodeMap: Map<string, string>;
    curHighlightNodeCompRow: CompIntf;

    scrollPosByTabName: Map<string, number>;

    draggableId: string;
    fadeStartTime: number;

    /* doesn't need to be in state */
    userName: string;
    password: string;

    // realtime state always holds true if CTRL key is down
    ctrlKey: boolean;
    ctrlKeyTime: number;
    ctrlKeyCheck(): boolean;
    decryptCache: Map<string, string>;

    tabChanging(prevTab: string, newTab: string, state: AppState): void;
    showOpenButtonOnNode(node: J.NodeInfo, state: AppState): void;
    toggleMouseEffect(): void;
    runClickAnimation(x: number, y: number): void;
    setOverlay(showOverlay: boolean): void;
    sendTestEmail(): void;
    showSystemNotification(title: string, message: string): void;
    refresh(state: AppState): void;
    selectTabStateOnly(tabName: string, state: AppState): void;
    selectTab(pageName: string, clickEvent?: boolean): void;
    getSelNodeUidsArray(state: AppState): string[];
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
    saveScrollPosition(): void;
}
