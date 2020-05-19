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
    cached_moveNodeUp(id: string, state?: AppState): void;
    cached_moveNodeDown(id: string, state?: AppState): void;
    moveNodeToTop(id: string, state: AppState): void;
    moveNodeToBottom(id: string, state: AppState): void;
    getFirstChildNode(state: AppState): any;
    cached_runEditNode(id: any, state?: AppState): void;
    insertNode(id: string, typeName: string, ordinalOffset: number, state?: AppState): void;
    cached_toolbarInsertNode(id: string): void;
    createSubNode(id: any, typeName: string, createAtTop: boolean, state: AppState): void;
    selectAllNodes(state: AppState) : void;
    cached_softDeleteSelNodes(nodeId: string);
    deleteSelNodes(nodeId: string, hardDelete: boolean, state?: AppState): void;
    getBestPostDeleteSelNode(state: AppState): J.NodeInfo;
    cached_cutSelNodes(nodeId: string, state?: AppState): void;
    undoCutSelNodes(state: AppState): void;
    cached_pasteSelNodesInside(nodeId: string);
    pasteSelNodes(nodeId: string, location: string, state?: AppState): void;
    cached_pasteSelNodes_InlineEnd(nodeId: string);
    cached_pasteSelNodes_InlineAbove(nodeId: string);
    cached_pasteSelNodes_Inline(nodeId: string);
    insertBookWarAndPeace(state: AppState): void;
    emptyTrash(state: AppState): void;
    cached_newSubNode(id: any);
}

