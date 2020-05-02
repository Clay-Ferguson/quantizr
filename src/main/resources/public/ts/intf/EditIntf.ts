import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface EditIntf {
    showReadOnlyProperties: boolean;
    parentOfNewNode: J.NodeInfo;
    nodeInsertTarget: any;

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
    insertNode(id?: any, typeName?: string, ordinalOffset?: number): void;
    createSubNode(id?: any, typeName?: string, createAtTop?: boolean): void;
    clearSelections(): void;
    selectAllNodes() : void;
    deleteSelNodes(node: J.NodeInfo, hardDelete: boolean): void;
    getBestPostDeleteSelNode(): J.NodeInfo;
    cutSelNodes(node: J.NodeInfo): void;
    undoCutSelNodes(): void;
    pasteSelNodes(node: J.NodeInfo, location: string, nodesToMove: string[]): void;
    insertBookWarAndPeace(): void;
    emptyTrash(): void;
}

