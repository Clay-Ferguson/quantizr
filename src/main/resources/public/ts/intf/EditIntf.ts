import * as I from "../Interfaces";

export interface EditIntf {
    importTargetNode: any;
    showReadOnlyProperties: boolean;
    nodesToMove: any;
    nodesToMoveSet: Object;
    parentOfNewNode: I.NodeInfo;
    nodeInsertTarget: any;

    createNode(): void;
    splitNode(splitType: string): void;
    openChangePasswordDlg(): void;
    openManageAccountDlg(): void;
    editPreferences(): void;
    openImportDlg(): void;
    openExportDlg(): void;
    isEditAllowed(node: any): boolean;
    isInsertAllowed(node: any): boolean;
    startEditingNewNode(typeName?: string, createAtTop?: boolean): void;
    insertNodeResponse(res: I.InsertNodeResponse): void;
    createSubNodeResponse(res: I.CreateSubNodeResponse): void;
    saveNodeResponse(res: I.SaveNodeResponse, payload: any): void;
    editMode(modeVal?: boolean): void;
    moveNodeUp(uid?: string): void;
    moveNodeDown(uid?: string): void;
    moveNodeToTop(uid?: string): void;
    moveNodeToBottom(uid?: string): void;
    getNodeAbove(node: I.NodeInfo): any;
    getNodeBelow(node: I.NodeInfo): I.NodeInfo;
    getFirstChildNode(): any;
    runEditNode(uid: any): void;
    insertNode(uid?: any, typeName?: string): void;
    createSubNode(uid?: any, typeName?: string, createAtTop?: boolean): void;
    replyToComment(uid: any): void;
    clearSelections(): void;
    selectAllNodes() : void;
    deleteSelNodes(selNodesArray : string[]): void;
    getBestPostDeleteSelNode(): I.NodeInfo;
    cutSelNodes(): void;
    undoCutSelNodes(): void;
    pasteSelNodes(location: string): void;
    insertBookWarAndPeace(): void;
}

