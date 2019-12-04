console.log("User.ts");

import * as I from "./Interfaces";
import { LoginDlg } from "./dlg/LoginDlg";
import { SignupDlg } from "./dlg/SignupDlg";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { Constants as cnst } from "./Constants";
import { UserIntf } from "./intf/UserIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class User implements UserIntf {

    private logoutResponse = (res: I.LogoutResponse): void => {
        /* reloads browser with the query parameters stripped off the path */
        window.location.href = window.location.origin;
    }

    closeAccountResponse = (res: I.CloseAccountResponse): void => {
        /* Remove warning dialog to ask user about leaving the page */
        window.onbeforeunload = null;

        /* reloads browser with the query parameters stripped off the path */
        window.location.href = window.location.origin;
    }

    closeAccount = (): void => {
        new ConfirmDlg("Close your Account?<p> Are you sure?", "Oh No!",
            () => {
                new ConfirmDlg("Your data will be deleted and can never be recovered.<p> Are you sure?", "Last Chance... One more Click",
                    () => {
                        this.deleteAllUserCookies();
                        S.util.ajax<I.CloseAccountRequest, I.CloseAccountResponse>("closeAccount", {}, this.closeAccountResponse);
                    }
                ).open();
            }
        ).open();
    }

    /*
     * for testing purposes, I want to allow certain users additional privileges. A bit of a hack because it will go
     * into production, but on my own production these are my "testUserAccounts", so no real user will be able to
     * use these names
     */
    isTestUserAccount = (): boolean => {
        return S.meta64.userName.toLowerCase() === "adam" || //
            S.meta64.userName.toLowerCase() === "bob" || //
            S.meta64.userName.toLowerCase() === "cory" || //
            S.meta64.userName.toLowerCase() === "dan";
    }

    setTitleUsingLoginResponse = (res): void => {
        var title = "";
        if (!S.meta64.isAnonUser) {
            title += "User: " + res.userName;
        }

        S.util.setInnerHTMLById("headerAppName", title);
    }

    /* TODO-3: move this into meta64 module */
    setStateVarsUsingLoginResponse = (res: I.LoginResponse): void => {
        if (res.rootNode) {
            S.meta64.homeNodeId = res.rootNode.id;
            S.meta64.homeNodePath = res.rootNode.path;
        }
        S.meta64.userName = res.userName;
        S.meta64.isAdminUser = res.userName === "admin";

        //bash scripting is an experimental feature, and i'll only enable for admin for now, until i'm
        //sure i'm keeping this feature.
        S.meta64.allowBashScripting = false; // res.userName === "admin";

        S.meta64.isAnonUser = res.userName === "anonymous";

        console.log("isAnonUser = " + S.meta64.isAnonUser);

        S.meta64.anonUserLandingPageNode = res.anonUserLandingPageNode;
        S.meta64.allowFileSystemSearch = res.allowFileSystemSearch;

        S.meta64.userPreferences = res.userPreferences;

        //todo-1: admin user had bug where it wasn't loading this at login, so i did this hack for now to make admin logins
        //always set to what settings i prefer.
        if (S.meta64.isAdminUser) {
            S.meta64.editModeOption = S.meta64.MODE_SIMPLE;
            S.meta64.showMetaData = false;
            S.meta64.showPath = false;
        }
        else {
            S.meta64.editModeOption = res.userPreferences.advancedMode ? S.meta64.MODE_ADVANCED : S.meta64.MODE_SIMPLE;
            S.meta64.showMetaData = res.userPreferences.showMetaData;
            S.meta64.showPath = res.userPreferences.showPath;
        }

        console.log("from server: meta64.editModeOption=" + S.meta64.editModeOption);
    }

    openSignupPg = (): void => {
        new SignupDlg().open();
    }

    /*
     * This method is ugly. It is the button that can be login *or* logout.
     */
    openLoginPg = (): void => {
        let dlg = new LoginDlg(null);
        dlg.populateFromCookies();
        dlg.open();
    }

    refreshLogin = (): void => {
        console.log("refreshLogin.");

        let callUsr: string;
        let callPwd: string;
        let usingCookies: boolean = false;

        /* todo-1: stop using cookies and use Local Store instead ? Will any modern browsers fail on this? */
        // is holding login state in a cookie insane or good idea?
        let loginState: string = S.util.getCookie(cnst.COOKIE_LOGIN_STATE);

        /* if we have known state as logged out, then do nothing here */
        if (loginState === "0") {
            console.log("loginState known as logged out. Sending to anon home page. [no, new logic overriding this now]");
            S.meta64.loadAnonPageHome();
            return;
        }
        
        let usr = S.util.getCookie(cnst.COOKIE_LOGIN_USR);
        let pwd = S.util.getCookie(cnst.COOKIE_LOGIN_PWD);

        usingCookies = !S.util.emptyString(usr) && !S.util.emptyString(pwd);
        console.log("cookieUser=" + usr + " usingCookies = " + usingCookies);

        /*
         * empyt credentials causes server to try to log in with any active session credentials.
         */
        callUsr = usr || "";
        callPwd = pwd || "";

        console.log("refreshLogin with name: " + callUsr);

        if (!callUsr) {
            //alert('loadAnonPageHome');
            S.meta64.loadAnonPageHome();
        } else {
            //alert('calling login: currently at: '+location.href);
            S.util.ajax<I.LoginRequest, I.LoginResponse>("login", {
                "userName": callUsr,
                "password": callPwd,
                "tzOffset": new Date().getTimezoneOffset(),
                "dst": S.util.daylightSavingsTime
            }, (res: I.LoginResponse) => {
                if (usingCookies) {
                    this.loginResponse(res, callUsr, callPwd, usingCookies);
                } else {
                    this.refreshLoginResponse(res);
                }
            });
        }
    }

    logout = (updateLoginStateCookie: any) => {
        if (S.meta64.isAnonUser) {
            return;
        }

        /* Remove warning dialog to ask user about leaving the page */
        window.onbeforeunload = null;

        if (updateLoginStateCookie) {
            S.util.setCookie(cnst.COOKIE_LOGIN_STATE, "0");
        }

        S.util.ajax<I.LogoutRequest, I.LogoutResponse>("logout", {}, this.logoutResponse);
    }

    login = (loginDlg: any, usr: string, pwd: string) => {
        S.util.ajax<I.LoginRequest, I.LoginResponse>("login", {
            "userName": usr,
            "password": pwd,
            "tzOffset": new Date().getTimezoneOffset(),
            "dst": S.util.daylightSavingsTime
        }, (res: I.LoginResponse) => {
            this.loginResponse(res, usr, pwd, null, loginDlg);
        });
    }

    deleteAllUserCookies = () => {
        S.util.deleteCookie(cnst.COOKIE_LOGIN_USR);
        S.util.deleteCookie(cnst.COOKIE_LOGIN_PWD);
        S.util.deleteCookie(cnst.COOKIE_LOGIN_STATE);
    }

    loginResponse = (res?: I.LoginResponse, usr?: string, pwd?: string, usingCookies?: boolean, loginDlg?: LoginDlg) => {
        if (S.util.checkSuccess("Login", res)) {
            console.log("loginResponse: usr=" + usr + " homeNodeOverride: " + res.homeNodeOverride);

            if (usr !== "anonymous") {
                S.util.setCookie(cnst.COOKIE_LOGIN_USR, usr);
                S.util.setCookie(cnst.COOKIE_LOGIN_PWD, pwd);
                S.util.setCookie(cnst.COOKIE_LOGIN_STATE, "1");
            }

            if (loginDlg) {
                loginDlg.close();
            }

            this.setStateVarsUsingLoginResponse(res);

            /* set ID to be the page we want to show user right after login */
            let id: string = null;

            if (!S.util.emptyString(res.homeNodeOverride)) {
                console.log("loading homeNodeOverride=" + res.homeNodeOverride);
                id = res.homeNodeOverride;
                S.meta64.homeNodeOverride = id;
            } else {
                let lastNode = localStorage.getItem("lastNode");
                if (lastNode) {
                    console.log("loading lastNode=" + lastNode);
                    id = lastNode;
                } else {
                    console.log("loading homeNodeId=" + S.meta64.homeNodeId);
                    id = S.meta64.homeNodeId;
                }
            }

            // alert("refreshTree: id="+id);
            S.view.refreshTree(id, false, null, true);
            this.setTitleUsingLoginResponse(res);
        } else {
            if (usingCookies) {
                S.util.showMessage("Cookie login failed.");

                /*
                 * blow away failed cookie credentials and reload page, should result in brand new page load as anon
                 * this.
                 */
                S.util.deleteCookie(cnst.COOKIE_LOGIN_USR);
                S.util.deleteCookie(cnst.COOKIE_LOGIN_PWD);
                S.util.setCookie(cnst.COOKIE_LOGIN_STATE, "0");

                // alert("calling location.reload");
                location.reload();
            }
        }

        S.meta64.refreshAllGuiEnablement();
    }

    private refreshLoginResponse = (res: I.LoginResponse): void => {
        console.log("refreshLoginResponse");

        if (res.success) {
            this.setStateVarsUsingLoginResponse(res);
            this.setTitleUsingLoginResponse(res);
        }

        S.meta64.loadAnonPageHome();
        S.meta64.refreshAllGuiEnablement();
    }
}
