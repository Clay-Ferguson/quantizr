import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { CompIntf } from "../widget/base/CompIntf";
import { DialogBaseImpl } from "../DialogBaseImpl";

export interface NavIntf {
    _UID_ROWID_PREFIX: string;

    mainMenuPopupDlg: DialogBaseImpl;

    mainOffset: number;
    endReached: boolean;

    ROWS_PER_PAGE: number;

    editMode(): void;
    login(): void;
    logout(): void;
    signup(): void;
    preferences(): void;
    openContentNode(nodePathOrId: string): void;
    geoLocation(): void;
    displayingHome(): boolean;
    displayingRepositoryRoot(): boolean;
    parentVisibleToUser(): boolean;
    upLevelResponse(res: J.RenderNodeResponse, id): void;
    navUpLevel(): void;
    navOpenSelectedNode(): void;
    getSelectedDomElement(): HTMLElement;
    clickOnNodeRow(id: string): void;
    openNodeById(id: string, mstate: any): void;
    toggleNodeSel(selected: boolean, id: string): void;
    navPageNodeResponse(res: J.RenderNodeResponse): void;
    navHome(): void;
    navPublicHome(): void;
    showMainMenu(nodesToMove: string[], mstate: any): void;
    navToSibling(siblingOffset: number): void;
}

