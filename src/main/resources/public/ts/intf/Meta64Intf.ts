console.log("Meta64Intf.ts");

import * as I from "../Interfaces";
import { TypeHandlerIntf } from "./TypeHandlerIntf";
import { GraphPanel } from "../widget/GraphPanel";

export interface Meta64Intf {

    state: any; //todo-1: create an interface for State properties
    appInitialized: boolean;

    isMobile: boolean;
    isMobileOrTablet: boolean;

    curUrlPath: string;
    urlCmd: string;
    homeNodeOverride: string;

    codeFormatDirty: boolean;

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

    treeDirty: boolean;

    uidToNodeMap: { [key: string]: I.NodeInfo };

    uidToNodeDataMap: { [key: string]: Object };

    idToNodeMap: { [key: string]: I.NodeInfo };

    nextUid: number;
    identToUidMap: { [key: string]: string };
    parentUidToFocusNodeMap: { [key: string]: I.NodeInfo };
    MODE_ADVANCED: string;
    MODE_SIMPLE: string;
    editModeOption: string;
    showProperties: boolean;
    showMetaData: boolean;
    showPath: boolean;

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
    setNodeData(uid: string, data: Object): any;
    getNodeData(uid: string, prop: string): any;
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
    updateNodeInfoResponse(res, node);
    updateNodeInfo(node: I.NodeInfo);
    getNodeFromId(id: string): I.NodeInfo;
    getPathOfUid(uid: string): string;
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
    removeBinaryByUid(uid): void;
    initNode(node: I.NodeInfo, updateMaps?: boolean): void;
    initConstants();
    initApp(): void;
    addTypeHandler(typeName: string, typeHandler : TypeHandlerIntf): void;
    processUrlParams(): void;
    tabChangeEvent(tabName): void
    displaySignupMessage(): void
    loadAnonPageHome(): void;
    saveUserPreferences(): void;
    openSystemFile(fileName: string);
    clickOnNodeRow(uid): void;
    replyToComment(uid: any): void;
    createSubNode(uid?: any, typeName?: string, createAtTop?: boolean): void;
    insertNode(uid?: any, typeName?: string): void;
    runEditNode(uid: any): void;
    moveNodeUp(uid?: string): void;
    moveNodeDown(uid?: string): void;
    clickOnSearchResultRow(uid: string);
    clickSearchNode(uid: string);
    onSignIn(googleUser);
    openManageKeysDlg();
}

