import * as J from "../JavaIntf";

import { LoginDlg } from "../dlg/LoginDlg";

export interface UserIntf {
    closeAccountResponse(res: J.CloseAccountResponse): void;
    closeAccount(): void;
    isTestUserAccount(): boolean;
    openSignupPg(): void;
    openLoginPg(): void;
    refreshLogin(): void;
    logout(updateLocalDb: boolean): any;
    login(loginDlg, usr: string, pwd: string): any;
    deleteAllUserLocalDbEntries(): any;
    loginResponse(res?: J.LoginResponse, usr?: string, pwd?: string, usingLocalDb?: boolean, loginDlg?: LoginDlg): any;
    transferNode(recursive: boolean, nodeId: string, fromUser: string, toUser: string): void;
}
