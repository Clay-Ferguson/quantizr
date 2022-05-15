import { dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { SignupDlg } from "./dlg/SignupDlg";
import * as J from "./JavaIntf";
import { S } from "./Singletons";

export class User {
    closeAccountResponse = (): void => {
        /* Remove warning dialog to ask user about leaving the page */
        window.onbeforeunload = null;

        /* reloads browser with the query parameters stripped off the path */
        window.location.href = window.location.origin;
    }

    closeAccount = async (): Promise<void> => {
        let state = store.getState();
        let dlg: ConfirmDlg = new ConfirmDlg("Are you sure you want to close your account?", "Close Account",
            null, null, state);
        await dlg.open();
        if (!dlg.yes) {
            return;
        }

        dlg = new ConfirmDlg("Your data will be deleted and can never be recovered. Are you sure?", "Close Account",
            null, null, state);
        await dlg.open();
        if (dlg.yes) {
            await this.deleteAllUserLocalDbEntries();
            await S.util.ajax<J.CloseAccountRequest, J.CloseAccountResponse>("closeAccount");
            this.closeAccountResponse();
        }
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
        // S.util.showMessage("Signups are temporarily unavailable. Check back in a few hours.", "Note");
        new SignupDlg(state).open();
    }

    refreshLogin = async (state: AppState): Promise<void> => {
        console.log("refreshLogin.");

        const loginState: string = await S.localDB.getVal(C.LOCALDB_LOGIN_STATE);
        console.log("got loginState");

        /* if we have *known* state as logged out, then do nothing here */
        if (loginState && loginState === "0") {
            console.log("loginState known as logged out.");
            S.util.loadAnonPageHome(null);
            return;
        }

        console.log("checking for credentials");
        const usr = await S.localDB.getVal(C.LOCALDB_LOGIN_USR);
        const pwd = await S.localDB.getVal(C.LOCALDB_LOGIN_PWD);
        const usingCredentials: boolean = usr && pwd;

        /*
         * empyt credentials causes server to try to log in with any active session credentials.
         */
        const callUsr: string = usr || "";
        const callPwd: string = pwd || "";

        console.log("refreshLogin with name: " + callUsr);

        if (!callUsr) {
            S.util.loadAnonPageHome(null);
        } else {
            try {
                let res: J.LoginResponse = await S.util.ajax<J.LoginRequest, J.LoginResponse>("login", {
                    userName: callUsr,
                    password: callPwd,
                    tzOffset: new Date().getTimezoneOffset(),
                    dst: S.util.daylightSavingsTime
                });
                S.quanta.authToken = res.authToken;

                if (res && !res.success) {
                    await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");
                    await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0", J.PrincipalName.ANON);
                }

                if (usingCredentials) {
                    // console.log("calling loginResponse()");
                    // Note: If user entered wrong case-sentitivity string on login dialog they can still login
                    // but this res.userName however will have the correct name (case-sensitive) here now.
                    this.loginResponse(res, res.userName, callPwd, false, state);
                } else {
                    if (res.success) {
                        S.util.setStateVarsUsingLoginResponse(res);
                    }

                    S.util.loadAnonPageHome(null);
                }
            }
            catch (e) {
                await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");
                await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0", J.PrincipalName.ANON);
                S.util.loadAnonPageHome(null);
            }
        }
    }

    logout = async (updateLocalDb: any, state: AppState): Promise<void> => {
        if (state.isAnonUser) {
            return;
        }

        /* Remove warning dialog to ask user about leaving the page */
        window.onbeforeunload = null;

        if (updateLocalDb) {
            await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");

            /* Setting logged in state for non-user also */
            await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0", J.PrincipalName.ANON);
        }

        S.quanta.loggingOut = true;
        try {
            await S.util.ajax<J.LogoutRequest, J.LogoutResponse>("logout");
        }
        finally {
            this.logoutResponse();
        }
    }

    logoutResponse = (): void => {
        S.push.close();
        S.quanta.authToken = null;
        S.quanta.userName = null;
        window.location.href = window.location.origin;
    }

    deleteAllUserLocalDbEntries = (): Promise<any> => {
        return Promise.all([
            // S.localDB.setVal(C.LOCALDB_LOGIN_USR, null),
            S.localDB.setVal(C.LOCALDB_LOGIN_PWD, null),
            S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0"),
            S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0", J.PrincipalName.ANON)
        ]);
    }

    loginResponse = async (res: J.LoginResponse, usr: string, pwd: string, calledFromLoginDlg: boolean,
        state: AppState): Promise<void> => {
        if (S.util.checkSuccess("Login", res)) {

            // if login was successful and we're an authenticated user
            if (usr !== J.PrincipalName.ANON) {
                S.localDB.userName = usr;
                if (usr) {
                    await S.localDB.setVal(C.LOCALDB_LOGIN_USR, usr);
                    // set this user for the 'anon' case also meaning it'll be default when user it not logged in
                    await S.localDB.setVal(C.LOCALDB_LOGIN_USR, usr, J.PrincipalName.ANON);
                }

                if (pwd) {
                    await S.localDB.setVal(C.LOCALDB_LOGIN_PWD, pwd);
                    // set this pwd for the 'anon' case also meaning it'll be default when user it not logged in
                    await S.localDB.setVal(C.LOCALDB_LOGIN_PWD, pwd, J.PrincipalName.ANON);
                }
                await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "1");
                await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "1", J.PrincipalName.ANON);

                S.quanta.userName = usr;
                console.log("Logged in as: " + usr);

                this.queryUserProfile(res.rootNode);

                this.checkMessages();
                setTimeout(() => {
                    S.util.loadBookmarks();
                    S.push.init();
                }, 600);
            }

            S.util.setStateVarsUsingLoginResponse(res);

            // we just processed a dispatch so we need to get the current state now.
            state = store.getState();

            /* set ID to be the page we want to show user right after login */
            let id: string = null;
            let childId: string = null;
            let renderLeafIfParent = true;

            if (res.homeNodeOverride) {
                id = res.homeNodeOverride;
                // console.log("homeNodeOverride=" + id);
                if (id && id.startsWith("~")) {
                    renderLeafIfParent = false;
                }
            } //
            else {
                const lastNode = await S.localDB.getVal(C.LOCALDB_LAST_PARENT_NODEID);

                if (lastNode) {
                    id = lastNode;
                    // console.log("Node selected from local storage: id=" + id);
                    childId = await S.localDB.getVal(C.LOCALDB_LAST_CHILD_NODEID);
                } else {
                    // todo-2: note... this path is now untested due to recent refactoring.
                    id = state.homeNodeId;
                    // console.log("Node selected from homeNodeId: id=" + id);
                }
            }
            // console.log("loginResponse final refresh id chosen: " + id);
            S.view.refreshTree(id, true, renderLeafIfParent, childId, false, false, true, true, false, state);
        } else {
            console.log("LocalDb login failed.");

            // if we tried a login and it wasn't from a login dialog then just blow away the login state
            // so that any kind of page refresh is guaranteed to just show login dialog and not try to login
            S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");
            S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0", J.PrincipalName.ANON);

            // location.reload();
            if (!calledFromLoginDlg) {
                S.nav.login(state);
            }
        }
    }

    checkMessages = async (): Promise<void> => {
        let res: J.CheckMessagesResponse = await S.util.ajax<J.CheckMessagesRequest, J.CheckMessagesResponse>("checkMessages");
        if (res) {
            dispatch("Action_SetNewMessageCount", (s: AppState): AppState => {
                s.newMessageCount = res.numNew;
                return s;
            });
        }
    }

    queryUserProfile = async (userId: string): Promise<void> => {
        let res: J.GetUserProfileResponse = await S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
            userId
        });

        // console.log("queryUserProfile Response: " + S.util.prettyPrint(res));
        if (res?.userProfile) {
            dispatch("Action_SetUserProfile", (s: AppState): AppState => {
                s.userProfile = res.userProfile;
                return s;
            });
        }
    }
}
