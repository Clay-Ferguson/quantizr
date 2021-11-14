import { AppState } from "../AppState";
import * as J from "../JavaIntf";

export interface UserIntf {
    closeAccountResponse(): void;
    closeAccount(): Promise<void>;
    isTestUserAccount(state: AppState): boolean;
    openSignupPg(state: AppState): void;
    refreshLogin(state: AppState): void;
    logout(updateLocalDb: boolean, state: AppState): any;
    deleteAllUserLocalDbEntries(): any;
    loginResponse(res: J.LoginResponse, usr: string, pwd: string, usingLocalDb: boolean, state: AppState): any;
    queryUserProfile(userId: string): void;
    checkMessages(): void;
}
