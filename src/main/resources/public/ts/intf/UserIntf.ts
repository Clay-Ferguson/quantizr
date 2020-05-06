import * as J from "../JavaIntf";

import { LoginDlg } from "../dlg/LoginDlg";
import { AppState } from "../AppState";

export interface UserIntf {
    closeAccountResponse(res: J.CloseAccountResponse, state: AppState): void;
    closeAccount(state: AppState): void;
    isTestUserAccount(state: AppState): boolean;
    openSignupPg(state: AppState): void;
    openLoginPg(state: AppState): void;
    refreshLogin(state: AppState): void;
    logout(updateLocalDb: boolean, state: AppState): any;
    login(loginDlg, usr: string, pwd: string, state: AppState): any;
    deleteAllUserLocalDbEntries(): any;
    loginResponse(res: J.LoginResponse, usr: string, pwd: string, usingLocalDb: boolean, loginDlg: LoginDlg, state: AppState): any;
    transferNode(recursive: boolean, nodeId: string, fromUser: string, toUser: string, state: AppState): void;
}
