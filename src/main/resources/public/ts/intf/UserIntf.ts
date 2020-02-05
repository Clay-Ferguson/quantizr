import * as J from "../JavaIntf";

import { LoginDlg } from "../dlg/LoginDlg";

export interface UserIntf {
    closeAccountResponse(res: J.CloseAccountResponse): void;
    closeAccount(): void;
    isTestUserAccount(): boolean;
    setTitleUsingLoginResponse(res): void;
    setStateVarsUsingLoginResponse(res: J.LoginResponse): void;
    openSignupPg(): void;
    openLoginPg(): void;
    refreshLogin(): void;
    logout(updateLocalDb: boolean);
    login(loginDlg, usr, pwd);
    deleteAllUserLocalDbEntries();
    loginResponse(res?: J.LoginResponse, usr?: string, pwd?: string, usingLocalDb?: boolean, loginDlg?: LoginDlg);
}
