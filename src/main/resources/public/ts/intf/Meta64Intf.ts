import { AppState } from "../AppState";
import { MainMenuDlg } from "../dlg/MainMenuDlg";
import * as J from "../JavaIntf";
import { CompIntf } from "../widget/base/CompIntf";

export interface Meta64Intf {

    mainMenu: MainMenuDlg;
    app: CompIntf;

    appInitialized: boolean;

    curUrlPath: string;

    deviceWidth: number;
    deviceHeight: number;

    // todo-1: convert this to a TypeScript Map<string,string>
    parentIdToFocusNodeMap: { [key: string]: string };
    curHighlightNodeCompRow: CompIntf;

    draggableId: string;
    fadeStartTime: number;

    /* doesn't need to be in state */
    userName: string;
    password: string;

    // realtime state always holds true if CTRL key is down
    ctrlKey: boolean;
    ctrlKeyTime: number;
    ctrlKeyCheck(): boolean;
    decryptCache: { [key: string]: string };

    // function cache accessor
    getNodeFunc(func: (id: string) => void, name: string, id: string): () => void;

    setOverlay(showOverlay: boolean): void;
    rebuildIndexes(): void;
    shutdownServerNode(string): void;
    sendTestEmail(string): void;
    showSystemNotification(title: string, message: string): void;
    refresh(state: AppState): void;
    selectTab(pageName: string, clickEvent?: boolean): void;
    getSelNodeUidsArray(state: AppState): string[];
    getSelNodeIdsArray(state: AppState): string[];
    getSelNodesAsMapById(state: AppState): Object;
    getSelNodesArray(state: AppState): J.NodeInfo[];
    clearSelNodes(state: AppState);
    selectAllNodes(nodeIds: string[]);
    updateNodeInfo(node: J.NodeInfo);
    getHighlightedNode(state?: AppState): J.NodeInfo;
    highlightRowById(id, scroll, state: AppState): boolean;
    highlightNode(node: J.NodeInfo, scroll: boolean, state: AppState): void;
    getSingleSelectedNode(state: AppState): J.NodeInfo;
    initApp(): Promise<void>;
    processUrlParams(state: AppState): void;
    displaySignupMessage(): void
    loadAnonPageHome(state: AppState): void;
    saveUserPreferences(state: AppState): void;
    openSystemFile(fileName: string);
    setStateVarsUsingLoginResponse(res: J.LoginResponse, state: AppState): void;
    updateNodeMap(node: J.NodeInfo, state: AppState): void;
    removeRedundantFeedItems(feedResults: J.NodeInfo[]): J.NodeInfo[];
    getNodeByName(node: J.NodeInfo, name: string, state: AppState): J.NodeInfo;
    findNodeById(state: AppState, nodeId: string): J.NodeInfo;
    fullscreenViewerActive(state: AppState): boolean;
}
