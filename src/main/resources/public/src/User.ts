import { dispatch, getAs, promiseDispatch } from "./AppContext";
import { Constants as C } from "./Constants";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { FriendsDlg } from "./dlg/FriendsDlg";
import { LoginDlg } from "./dlg/LoginDlg";
import { ProgressDlg } from "./dlg/ProgressDlg";
import { SignupDlg } from "./dlg/SignupDlg";
import * as J from "./JavaIntf";
import { NodeInfo, PrincipalName } from "./JavaIntf";
import { S } from "./Singletons";

export class User {
    _closeAccount = async () => {
        let dlg = new ConfirmDlg("Are you sure you want to close your account?", "Close Account");
        await dlg.open();
        if (!dlg.yes) {
            return;
        }

        dlg = new ConfirmDlg("Are you sure? Your data will be deleted and can never be recovered.", "Close Account");
        await dlg.open();
        if (dlg.yes) {
            await S.localDB.clearStores();
            await S.rpcUtil.rpc<J.CloseAccountRequest, J.CloseAccountResponse>("closeAccount");

            /* Remove warning dialog to ask user about leaving the page */
            window.onbeforeunload = null;

            /* reloads browser with the query parameters stripped off the path */
            window.location.href = window.location.origin;
        }
    }

    /*
     * for testing purposes, I want to allow certain users additional privileges. A bit of a hack
     * because it will go into production, but on my own production these are my "testUserAccounts",
     * so no real user will be able to use these names
     */
    isTestUserAccount = (): boolean => {
        const lcUserName = getAs().userName.toLowerCase();
        return lcUserName === "adam" || //
            lcUserName === "bob" || //
            lcUserName === "cory" || //
            lcUserName === "dan";
    }

    initLoginState = async () => {
        const loginState: string = await S.localDB.getVal(C.LOCALDB_LOGIN_STATE);
        const usr = await S.localDB.getVal(C.LOCALDB_LOGIN_USR);
        const pwd = await S.localDB.getVal(C.LOCALDB_LOGIN_PWD);

        const callUsr: string = usr || "";
        const callPwd: string = pwd || "";

        /* if we have *known* state as logged out, then do nothing here */
        if (loginState === "0" || !callUsr) {
            if (!S.quanta.config.initialNodeId) {
                S.quanta.config.initialNodeId = "/r/public/home";
            }
            return;
        }

        // console.log("refreshLogin: user=" + usr);
        const usingCredentials: boolean = usr && pwd;

        try {
            await S.quanta.initKeys(callUsr);

            const res = await S.rpcUtil.rpc<J.LoginRequest, J.LoginResponse>("login", {
                userName: callUsr,
                password: callPwd,
                tzOffset: new Date().getTimezoneOffset(),
                dst: S.util._daylightSavingsTime,
                asymEncKey: S.crypto.asymEncKey
            }, false, true);
            S.quanta.authToken = res.authToken;

            // console.log("Login response: " + S.util.prettyPrint(res));

            if (res?.code == C.RESPONSE_CODE_OK) {
                await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");
            }

            if (usingCredentials) {
                // Note: If user entered wrong case-sentitivity string on login dialog they can
                // still login but this res.userName however will have the correct name
                // (case-sensitive) here now.
                await this.loginResponse(res, res.userProfile.userName, callPwd, false);
            } else {
                if (res.code == C.RESPONSE_CODE_OK) {
                    S.util.setInitialStateVars(res);
                }
            }
        }
        catch (e) {
            S.util.logErr(e);
            await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");
        }
    }

    addAccountCredit = async () => {
        if (!S.quanta.config.paymentLink) {
            S.util.showMessage("No payment link configured.");
            return;
        }

        const dlg = new ConfirmDlg("### IMPORTANT \n\nOn the payments page, use the email address associated with your Quanta account.\n\n " +
            "It may take a minute or two for the funds to become available, so refresh your brower to see your new funds, under `Menu -> AI -> Settings`. \n\n##### Proceed to Payments Page?",
            "Payment Instructions", null, "[markdown]");

        await dlg.open();
        if (dlg.yes) {
            window.open(S.quanta.config.paymentLink, "_blank");
        }
    }

    logout = async () => {
        new ProgressDlg();

        /* Remove warning dialog to ask user about leaving the page */
        window.onbeforeunload = null;

        if (getAs().isAnonUser) {
            return;
        }

        S.quanta.loggingOut = true;
        S.push.close();
        await S.rpcUtil.rpc<J.LogoutRequest, J.LogoutResponse>("logout");

        // set user to know they're logged out
        await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");

        // set anon user to know they're logged out
        await S.localDB.setUser(PrincipalName.ANON);
        await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");

        window.location.href = window.location.origin;
    }

    loginResponse = async (res: J.LoginResponse, usr: string, pwd: string, calledFromLoginDlg: boolean) => {
        if (S.util.checkSuccess("Login", res)) {

            // if login was successful and we're an authenticated user
            if (usr !== PrincipalName.ANON) {

                // Setting CREDS on 'anon' user means when user comes back to this page it automatically can log them in
                await S.localDB.setUser(PrincipalName.ANON);
                await this.setLoginVars(usr, pwd, "1");

                // Setting CREDS after switching DB user
                await S.localDB.setUser(usr);
                await this.setLoginVars(usr, pwd, "1"); // <-- note this is NOT a redundant line.

                S.quanta.userName = usr;
                console.log("Logged in as: " + usr);

                setTimeout(() => {
                    S.push.init(res.authToken);

                    // NOTE: All these are async methods, but we don't use 'await' because we can
                    // let them execute in parallel and not wait for any of them to complete before
                    // any of the others.
                    if (usr !== PrincipalName.ADMIN) {
                        this.checkMessages();
                    }
                    S.util._loadBookmarks();
                    S.util._loadSearchDefs();
                    S.histUtil.loadHistoryData();
                }, 500);

                // todo-2: technically this delay is a bit of a hack because we really need a way to be SURE
                // the main app layout has already loaded before we even try to resume editing.
                setTimeout(S.util._resumeEditingOfAbandoned, 1500);
            }

            await S.util.setInitialStateVars(res);
        } else {
            console.log("LocalDb login failed.");

            // if we tried a login and it wasn't from a login dialog then just blow away the login state
            // so that any kind of page refresh is guaranteed to just show login dialog and not try to login
            S.localDB.setVal(C.LOCALDB_LOGIN_STATE, "0");

            if (!calledFromLoginDlg) {
                this.userLogin();
            }
        }
    }

    setLoginVars = async (usr: string, pwd: string, loginState: string) => {
        if (usr) {
            await S.localDB.setVal(C.LOCALDB_LOGIN_USR, usr);
        }
        if (pwd) {
            await S.localDB.setVal(C.LOCALDB_LOGIN_PWD, pwd);
        }
        await S.localDB.setVal(C.LOCALDB_LOGIN_STATE, loginState);
    }

    checkMessages = async () => {
        const res = await S.rpcUtil.rpc<J.CheckMessagesRequest, J.CheckMessagesResponse>("checkMessages", null, true);
        if (res) {
            dispatch("SetNewMessageCount", s => {
                s.myNewMessageCount = res.numNew;
            });
        }
    }

    queryUserProfile = async (userId: string) => {
        const res = await S.rpcUtil.rpc<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
            userId
        });

        if (res?.userProfile) {
            await promiseDispatch("SetUserProfile", s => {
                s.userProfile = res.userProfile;
            });
        }
    }

    userLogin = async () => {
        new LoginDlg().open();
    }

    userSignup = () => {
        new SignupDlg().open();
    }

    showUsersList = (node: NodeInfo) => {
        const friendsDlg = new FriendsDlg("User Shares", node.id, true, false);
        friendsDlg.open();
    }
}
