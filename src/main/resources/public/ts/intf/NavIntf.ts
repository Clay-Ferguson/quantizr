import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { CompIntf } from "../widget/base/CompIntf";
import { DialogBaseImpl } from "../DialogBaseImpl";

export interface NavIntf {
    _UID_ROWID_PREFIX: string;

    mainMenuPopupDlg: DialogBaseImpl;
    mainNavPanel: CompIntf;
    mainTabPanel: CompIntf;

    mainOffset: number;
    endReached: boolean;

    ROWS_PER_PAGE: number;

    editMode(): void;
    login(): void;
    logout(): void;
    signup(): void;
    preferences(): void;
    openGitHubSite(): void;
    openContentNode(nodePathOrId: string): void;
    geoLocation(): void;
    displayingHome(): boolean;
    parentVisibleToUser(): boolean;
    upLevelResponse(res: J.RenderNodeResponse, id): void;
    navUpLevel(): void;
    navOpenSelectedNode(): void;
    getSelectedDomElement(): HTMLElement;
    clickOnNodeRow(id: string): void;
    openNodeById(id: string, scrollToFirstChild: boolean): void;
    toggleNodeSel(selected: boolean, id: string): void;
    navPageNodeResponse(res: J.RenderNodeResponse): void;
    navHome(): void;
    navInbox(): void;
    navPublicHome(): void;
    showMainMenu(): void;
    navToSibling(siblingOffset: number): void;
}

