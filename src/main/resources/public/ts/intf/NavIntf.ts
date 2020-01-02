import * as I from "../Interfaces";

export interface NavIntf {
    _UID_ROWID_PREFIX: string;

    mainMenuPopupDlg: any;

    mainOffset: number;
    endReached: boolean;

    ROWS_PER_PAGE: number;

    search(): void;
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
    upLevelResponse(res: I.RenderNodeResponse, id): void;
    navUpLevel(): void;
    navOpenSelectedNode(): void;
    getSelectedDomElement(): HTMLElement;
    clickOnNodeRow(uid: string): void;
    openNode(uid: string, scrollToFirstChild: boolean): void;
    toggleNodeSel(selected: boolean, uid: string): void;
    navPageNodeResponse(res: I.RenderNodeResponse): void;
    navHome(): void;
    navPublicHome(): void;
    showMainMenu(): void;
    navToSibling(siblingOffset: number): void;
}

