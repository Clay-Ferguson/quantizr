import * as J from "../JavaIntf";
import { CompIntf } from "../widget/base/CompIntf";
import { AppState } from "../AppState";

export interface Meta64Intf {

    app: CompIntf;

    appInitialized: boolean;

    isMobile: boolean;
    isMobileOrTablet: boolean;

    curUrlPath: string;

    deviceWidth: number;
    deviceHeight: number;

    navBarHeight: number;
    parentIdToFocusNodeMap: { [key: string]: J.NodeInfo };
    curHighlightNodeCompRow: CompIntf;

    //function cache accessor
    getNodeFunc(func: (id: string) => void, name: string, id: string): () => void;

    setOverlay(showOverlay: boolean): void;
    rebuildIndexes(): void;
    shutdownServerNode(string): void;
    sendTestEmail(string): void;
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
    highlightRowById(id, scroll, state: AppState): void;
    highlightNode(node: J.NodeInfo, scroll: boolean, state: AppState): void;
    getSingleSelectedNode(state: AppState): J.NodeInfo;
    removeBinaryById(id: string, state: AppState): void;
    initApp(): Promise<void>;
    processUrlParams(state: AppState): void;
    displaySignupMessage(): void
    loadAnonPageHome(state: AppState): void;
    saveUserPreferences(state: AppState): void;
    openSystemFile(fileName: string);
    setStateVarsUsingLoginResponse(res: J.LoginResponse, state: AppState): void;
    updateNodeMap(node: J.NodeInfo, level: number, state: AppState): void;
}

