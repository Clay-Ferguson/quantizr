import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { CompIntf } from "../widget/base/CompIntf";
import { DialogBaseImpl } from "../DialogBaseImpl";
import { AppState } from "../AppState";

export interface NavIntf {
    _UID_ROWID_PREFIX: string;

    mainMenuPopupDlg: DialogBaseImpl;

    mainOffset: number;

    ROWS_PER_PAGE: number;

    login(state: AppState): void;
    logout(state: AppState): void;
    signup(state: AppState): void;
    preferences(state: AppState): void;
    openContentNode(nodePathOrId: string, state: AppState): void;
    geoLocation(state: AppState): void;
    displayingHome(state: AppState): boolean;
    displayingRepositoryRoot(state: AppState): boolean;
    parentVisibleToUser(state: AppState): boolean;
    upLevelResponse(res: J.RenderNodeResponse, id: string, scrollToTop: boolean, state: AppState): void;
    navUpLevel(event?: any): void;
    navOpenSelectedNode(state: AppState): void;
    getSelectedDomElement(state: AppState): HTMLElement;
    cached_clickNodeRow(nodeId: string, state?: AppState): void;
    cached_openNodeById(id: string, state?: AppState): void;
    cached_toggleNodeSel(id: string, state?: AppState): void;
    setNodeSel(selected: boolean, id: string, state: AppState): void;
    navPageNodeResponse(res: J.RenderNodeResponse, state: AppState): void;
    navHome(state: AppState): void;
    navPublicHome(state: AppState): void;
    showMainMenu(state: AppState): void;
    navToSibling(siblingOffset: number, state?: AppState): void;
    navToPrev(): void;
    navToNext(): void;
    runSearch(): void;
    runTimeline(): void;
}

