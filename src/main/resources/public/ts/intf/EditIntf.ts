import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { AppState } from "../AppState";

export interface EditIntf {
    showReadOnlyProperties: boolean;
    parentOfNewNode: J.NodeInfo;
    nodeInsertTarget: any;

    saveClipboardToNode(): void;
    splitNode(splitType: string, delimiter: string, state: AppState): void;
    openChangePasswordDlg(state: AppState): void;
    openManageAccountDlg(state: AppState): void;
    editPreferences(state: AppState): void;
    openImportDlg(state: AppState): void;
    openExportDlg(state: AppState): void;
    isEditAllowed(node: any, state: AppState): boolean;
    isInsertAllowed(node: any, state: AppState): boolean;
    startEditingNewNode(typeName: string, createAtTop: boolean, state: AppState): void;
    insertNodeResponse(res: J.InsertNodeResponse, state: AppState): void;
    createSubNodeResponse(res: J.CreateSubNodeResponse, state: AppState): void;
    saveNodeResponse(node: J.NodeInfo, res: J.SaveNodeResponse, state: AppState): void;
    toggleEditMode(state: AppState): void;
    moveNodeUp(id: string, state: AppState): void;
    moveNodeDown(id: string, state: AppState): void;
    moveNodeToTop(id: string, state: AppState): void;
    moveNodeToBottom(id: string, state: AppState): void;
    getNodeAbove(node: J.NodeInfo, state: AppState): any;
    getNodeBelow(node: J.NodeInfo, state: AppState): J.NodeInfo;
    getFirstChildNode(state: AppState): any;
    runEditNode(id: any, state: AppState): void;
    insertNode(id: any, typeName: string, ordinalOffset: number, state: AppState): void;
    createSubNode(id: any, typeName: string, createAtTop: boolean, state: AppState): void;
    selectAllNodes(state: AppState) : void;
    deleteSelNodes(node: J.NodeInfo, hardDelete: boolean, state: AppState): void;
    getBestPostDeleteSelNode(state: AppState): J.NodeInfo;
    cutSelNodes(node: J.NodeInfo, state: AppState): void;
    undoCutSelNodes(state: AppState): void;
    pasteSelNodes(node: J.NodeInfo, location: string, nodesToMove: string[], state: AppState): void;
    insertBookWarAndPeace(state: AppState): void;
    emptyTrash(state: AppState): void;
}

