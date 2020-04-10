import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface EditIntf {
    showReadOnlyProperties: boolean;
    nodesToMove: any;
    nodesToMoveSet: Object;
    parentOfNewNode: J.NodeInfo;
    nodeInsertTarget: any;

    createNode(): void;
    saveClipboardToNode(): void;
    splitNode(splitType: string, delimiter: string): void;
    openChangePasswordDlg(): void;
    openManageAccountDlg(): void;
    editPreferences(): void;
    openImportDlg(): void;
    openExportDlg(): void;
    isEditAllowed(node: any): boolean;
    isInsertAllowed(node: any): boolean;
    startEditingNewNode(typeName?: string, createAtTop?: boolean): void;
    insertNodeResponse(res: J.InsertNodeResponse): void;
    createSubNodeResponse(res: J.CreateSubNodeResponse): void;
    saveNodeResponse(node: J.NodeInfo, res: J.SaveNodeResponse): void;
    editMode(modeVal?: boolean): void;
    moveNodeUp(id?: string): void;
    moveNodeDown(id?: string): void;
    moveNodeToTop(id?: string): void;
    moveNodeToBottom(id?: string): void;
    getNodeAbove(node: J.NodeInfo): any;
    getNodeBelow(node: J.NodeInfo): J.NodeInfo;
    getFirstChildNode(): any;
    runEditNode(id: any): void;
    insertNode(id?: any, typeName?: string): void;
    createSubNode(id?: any, typeName?: string, createAtTop?: boolean): void;
    clearSelections(): void;
    selectAllNodes() : void;
    deleteSelNodes(selNodesArray : string[], hardDelete: boolean): void;
    getBestPostDeleteSelNode(): J.NodeInfo;
    cutSelNodes(): void;
    undoCutSelNodes(): void;
    pasteSelNodes(location: string): void;
    insertBookWarAndPeace(): void;
}

