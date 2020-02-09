import * as J from "../JavaIntf";
import { GraphPanel } from "../widget/GraphPanel";

export interface Meta64Intf {

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

    isAdminUser: boolean;
    allowBashScripting: boolean;

    isAnonUser: boolean;
    anonUserLandingPageNode: any;
    allowFileSystemSearch: boolean;

    treeDirty: boolean;

    idToNodeMap: { [key: string]: J.NodeInfo };

    nextUid: number;
    parentIdToFocusNodeMap: { [key: string]: J.NodeInfo };
    
    showProperties: boolean;
    showMetaData: boolean;

    simpleModePropertyBlackList: any;

    readOnlyPropertyList: any;

    binaryPropertyList: any;
    selectedNodes: any;

    expandedAbbrevNodeIds: any;

    currentNodeData: J.RenderNodeResponse;

    userPreferences: J.UserPreferences;
    navBarHeight: number;

    graphPanel: GraphPanel;

    setOverlay(showOverlay: boolean): void;
    refresh(): void;
    rebuildIndexes(): void;
    shutdownServerNode(string): void;
    sendTestEmail(string): void;
    goToMainPage(rerender?: boolean, forceServerRefresh?: boolean): void;
    selectTab(pageName): void;
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
    anonPageLoadResponse(res: J.AnonPageLoadResponse): void;
    removeBinaryById(id: string): void;
    initNode(node: J.NodeInfo, updateMaps?: boolean): void;
    initConstants();
    initApp(): Promise<void>;
    processUrlParams(): void;
    tabChangeEvent(tabName): void
    displaySignupMessage(): void
    loadAnonPageHome(): void;
    saveUserPreferences(): void;
    openSystemFile(fileName: string);
    onSignIn(googleUser);
}

