import * as J from "./JavaIntf";
import { LoginDlg } from "./dlg/LoginDlg";
import { SignupDlg } from "./dlg/SignupDlg";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { UserIntf } from "./intf/UserIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { AppState } from "./AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class User implements UserIntf {

    private logoutResponse = (res: J.LogoutResponse): void => {
        /* reloads browser with the query parameters stripped off the path */
        window.location.href = window.location.origin;
    }

    closeAccountResponse = (res: J.CloseAccountResponse): void => {
        /* Remove warning dialog to ask user about leaving the page */
        window.onbeforeunload = null;

        /* reloads browser with the query parameters stripped off the path */
        window.location.href = window.location.origin;
    }

    closeAccount = (state: AppState): void => {
        new ConfirmDlg("Are you sure you want to close your account?", "Close Account",
            () => {
                new ConfirmDlg("Your data will be deleted and can never be recovered.<p> Are you sure?", "Last Chance... One more Click",
                    () => {
                        this.deleteAllUserLocalDbEntries();
                        S.util.ajax<J.CloseAccountRequest, J.CloseAccountResponse>("closeAccount", {}, this.closeAccountResponse);
                    }, null, null, null, state
                ).open();
            }, null, null, null, state
        ).open();
    }

    /*
     * for testing purposes, I want to allow certain users additional privileges. A bit of a hack because it will go
     * into production, but on my own production these are my "testUserAccounts", so no real user will be able to
     * use these names
     */
    isTestUserAccount = (state: AppState): boolean => {
        return state.userName.toLowerCase() === "adam" || //
            state.userName.toLowerCase() === "bob" || //
            state.userName.toLowerCase() === "cory" || //
            state.userName.toLowerCase() === "dan";
    }

    openSignupPg = (state: AppState): void => {
        new SignupDlg(state).open();
    }

    /*
     * This method is ugly. It is the button that can be login *or* logout.
     */
    openLoginPg = (state: AppState): void => {
        let dlg = new LoginDlg(null, state);
        dlg.populateFromLocalDb();
        dlg.open();
    }

    refreshLogin = async (state: AppState): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                console.log("refreshLogin.");

                let callUsr: string;
                let callPwd: string;

                let loginState: string = await S.localDB.getVal(C.LOCALDB_LOGIN_STATE);

                /* if we have known state as logged out, then do nothing here */
                if (loginState === "0") {
                    console.log("loginState known as logged out. Sending to anon home page. [no, new logic overriding this now]");
                    S.meta64.loadAnonPageHome(state);
                    return;
                }

                let usr = await S.localDB.getVal(C.LOCALDB_LOGIN_USR);
                let pwd = await S.localDB.getVal(C.LOCALDB_LOGIN_PWD);

                let usingCredentials: boolean = usr && pwd;

                /*
                 * empyt credentials causes server to try to log in with any active session credentials.
                 */
                callUsr = usr || "";
                callPwd = pwd || "";

                console.log("refreshLogin with name: " + callUsr);

                if (!callUsr) {
                    S.meta64.loadAnonPageHome(state);
                } else {
                    S.util.ajax<J.LoginRequest, J.LoginResponse>("login", {
                        userName: callUsr,
                        password: callPwd,
                        tzOffset: new Date().getTimezoneOffset(),
                        dst: S.util.daylightSavingsTime
                    }, (res: J.LoginResponse) => {
                        if (usingCredentials) {
                            this.loginResponse(res, callUsr, callPwd, usingCredentials, null, state);
                        } else {
                            this.refreshLoginResponse(res, state);
                        }
                    });
                }
            }
            finally {
                resolve();
            }
        });
    }

    logout = async (updateLocalDb: any, state: AppState): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                if (state.isAnonUser) {
                    return;
                }

                /* Remove warning dialog to ask user about leaving the page */
                window.onbeforeunload = null;

                if (updateLocalDb) {
                    await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");
                }

                S.util.ajax<J.LogoutRequest, J.LogoutResponse>("logout", {}, this.logoutResponse);
            }
            //todo-1: everywhere in the app that I have a resolve() that isn't in a finally block needs to be checked for correctness.
            finally {
                resolve();
            }
        });
    }

    login = (loginDlg: any, usr: string, pwd: string, state: AppState) => {
        S.util.ajax<J.LoginRequest, J.LoginResponse>("login", {
            userName: usr,
            password: pwd,
            tzOffset: new Date().getTimezoneOffset(),
            dst: S.util.daylightSavingsTime
        }, (res: J.LoginResponse) => {
            this.loginResponse(res, usr, pwd, null, loginDlg, state);
        });
    }

    deleteAllUserLocalDbEntries = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                await S.localDB.setVal(C.LOCALDB_LOGIN_USR, null);
                await S.localDB.setVal(C.LOCALDB_LOGIN_PWD, null);
                await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, null);
            }
            finally {
                resolve();
            }
        });
    }

    loginResponse = async (res: J.LoginResponse, usr: string, pwd: string, usingCredentials: boolean, loginDlg: LoginDlg,
        state: AppState): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                if (S.util.checkSuccess("Login", res)) {

                    if (usr !== J.PrincipalName.ANON) {
                        await S.localDB.setVal(C.LOCALDB_LOGIN_USR, usr);
                        await S.localDB.setVal(C.LOCALDB_LOGIN_PWD, pwd);
                        await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "1");
                    }

                    if (loginDlg) {
                        loginDlg.close();
                    }

                    S.meta64.setStateVarsUsingLoginResponse(res, state);

                    /* set ID to be the page we want to show user right after login */
                    let id: string = null;
                    let childId: string = null;

                    if (res.homeNodeOverride) {
                        id = res.homeNodeOverride;
                    } //
                    else {
                        let lastNode = await S.localDB.getVal(C.LOCALDB_LAST_PARENT_NODEID);

                        if (lastNode) {
                            id = lastNode;
                            childId = await S.localDB.getVal(C.LOCALDB_LAST_CHILD_NODEID);
                        } else {
                            id = state.homeNodeId;
                        }
                    }

                    S.view.refreshTree(id, true, childId, true, false, true, true, state);

                    setTimeout(() => {
                        S.encryption.initKeys();
                    }, 500);
                } else {
                    if (usingCredentials) {
                        console.log("LocalDb login failed.");

                        /*
                         * blow away failed credentials and reload page, should result in brand new page load as anon
                         * this.
                         */
                        await S.localDB.setVal(C.LOCALDB_LOGIN_USR, null);
                        await S.localDB.setVal(C.LOCALDB_LOGIN_PWD, null);
                        await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");

                        //todo-0: can't we do the equivalent of a load with the USR, PWD, and STATE set right in this page
                        //without forcing a location.reload, which could go into a loop and create an accidental
                        //self-inflicted denial of service attack!
                        location.reload();
                    }
                }
            }
            finally {
                resolve();
            }
        });
    }

    private refreshLoginResponse = (res: J.LoginResponse, state: AppState): void => {
        if (res.success) {
            S.meta64.setStateVarsUsingLoginResponse(res, state);
        }

        S.meta64.loadAnonPageHome(state);
    }

    transferNode = (recursive: boolean, nodeId: string, fromUser: string, toUser: string, state: AppState): void => {
        S.util.ajax<J.TransferNodeRequest, J.TransferNodeResponse>("transferNode", {
            recursive,
            nodeId,
            fromUser,
            toUser,
        }, (res: J.TransferNodeResponse) => {
            S.view.refreshTree(null, false, null, false, false, true, true, state);
            S.util.showMessage(res.message, "Success");
        });
    }
}
