import * as I from "../Interfaces";
import { TypeHandlerIntf } from "./TypeHandlerIntf";
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

    idToNodeMap: { [key: string]: I.NodeInfo };

    nextUid: number;
    parentIdToFocusNodeMap: { [key: string]: I.NodeInfo };
    MODE_ADVANCED: string;
    MODE_SIMPLE: string;
    editModeOption: string;
    showProperties: boolean;
    showMetaData: boolean;

    simpleModeNodePrefixBlackList: any;

    simpleModePropertyBlackList: any;

    readOnlyPropertyList: any;

    binaryPropertyList: any;
    selectedNodes: any;

    expandedAbbrevNodeIds: any;

    currentNodeData: I.RenderNodeResponse;

    typeHandlers: { [key: string]: TypeHandlerIntf };

    userPreferences: I.UserPreferences;
    navBarHeight: number;

    graphPanel: GraphPanel;

    setOverlay(showOverlay: boolean): void;
    inSimpleMode(): boolean;
    refresh(): void;
    rebuildIndexes(): void;
    shutdownServerNode(string): void;
    sendTestEmail(string): void;
    goToMainPage(rerender?: boolean, forceServerRefresh?: boolean): void;
    selectTab(pageName): void;
    isNodeBlackListed(node): boolean;
    getSelectedNodeUidsArray(): string[];
    getSelectedNodeIdsArray(): string[];
    getSelectedNodesAsMapById(): Object;
    getSelectedNodesArray(): I.NodeInfo[];
    clearSelectedNodes();
    selectAllNodes(nodeIds : string[]);
    updateNodeInfo(node: I.NodeInfo);
    getHighlightedNode(): I.NodeInfo;
    highlightRowById(id, scroll): Promise<void>;
    highlightNode(node: I.NodeInfo, scroll: boolean): Promise<void>;
    updateState();
    refreshAllGuiEnablement();
    getSingleSelectedNode(): I.NodeInfo;
    getOrdinalOfNode(node: I.NodeInfo): number;
    getNumChildNodes(): number;
    setCurrentNodeData(data: I.RenderNodeResponse): void;
    anonPageLoadResponse(res: I.AnonPageLoadResponse): void;
    removeBinaryById(id: string): void;
    initNode(node: I.NodeInfo, updateMaps?: boolean): void;
    initConstants();
    initApp(): Promise<void>;
    addTypeHandler(typeName: string, typeHandler : TypeHandlerIntf): void;
    processUrlParams(): void;
    tabChangeEvent(tabName): void
    displaySignupMessage(): void
    loadAnonPageHome(): void;
    saveUserPreferences(): void;
    openSystemFile(fileName: string);
    onSignIn(googleUser);
    openManageKeysDlg();
}

