import * as J from "../JavaIntf";
import { GraphPanel } from "../widget/GraphPanel";
import { MainTabPanelIntf } from "../Interfaces";
import { CompIntf } from "../widget/base/CompIntf";

export interface Meta64Intf {

    mainTabPanel: MainTabPanelIntf;
    app: CompIntf;

    //change to AppState type ?
    state: any; //todo-1: create an interface for State properties

    appInitialized: boolean;
    pendingLocationHash: string;

    isMobile: boolean;
    isMobileOrTablet: boolean;

    curUrlPath: string;
    urlCmd: string;
    homeNodeOverride: string;

    nextGuid: number;

    userName: string;

    deviceWidth: number;
    deviceHeight: number;

    homeNodeId: string;
    homeNodePath: string;

    isAdminUser: boolean;
    allowBashScripting: boolean;

    isAnonUser: boolean;
    anonUserLandingPageNode: any;
    allowFileSystemSearch: boolean;

    idToNodeMap: { [key: string]: J.NodeInfo };

    nextUid: number;
    parentIdToFocusNodeMap: { [key: string]: J.NodeInfo };
    
    showProperties: boolean;
    showMetaData: boolean;

    selectedNodes: any;

    expandedAbbrevNodeIds: any;

    //todo-1: rename this to nodeData
    currentNodeData: J.RenderNodeResponse;

    userPreferences: J.UserPreferences;
    navBarHeight: number;

    graphPanel: GraphPanel;

    setOverlay(showOverlay: boolean): void;
    rebuildIndexes(): void;
    shutdownServerNode(string): void;
    sendTestEmail(string): void;
    refresh(): void;
    selectTab(pageName: string, clickEvent?: boolean): void;
    getSelectedNodeUidsArray(): string[];
    getSelectedNodeIdsArray(): string[];
    getSelectedNodesAsMapById(): Object;
    getSelectedNodesArray(): J.NodeInfo[];
    clearSelectedNodes();
    selectAllNodes(nodeIds : string[]);
    updateNodeInfo(node: J.NodeInfo);
    getHighlightedNode(): J.NodeInfo;
    highlightRowById(id, scroll): Promise<void>;
    highlightNode(node: J.NodeInfo, scroll: boolean): Promise<void>;
    updateState();
    refreshAllGuiEnablement();
    getSingleSelectedNode(): J.NodeInfo;
    getOrdinalOfNode(node: J.NodeInfo): number;
    getNumChildNodes(): number;
    setCurrentNodeData(data: J.RenderNodeResponse): void;
    removeBinaryById(id: string): void;
    initApp(): Promise<void>;
    processUrlParams(): void;
    displaySignupMessage(): void
    loadAnonPageHome(): void;
    saveUserPreferences(): void;
    openSystemFile(fileName: string);
    onSignIn(googleUser);
    setStateVarsUsingLoginResponse(res: J.LoginResponse): void;
    updateNodeMap(node: J.NodeInfo): void;
}

