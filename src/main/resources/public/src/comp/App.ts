import { getAs } from "../AppContext";
import { Clearfix } from "../comp/core/Clearfix";
import { Constants as C } from "../Constants";
import { DialogMode } from "../DialogBase";
import { NavPanelDlg } from "../dlg/NavPanelDlg";
import { FullScreenType } from "../Interfaces";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";
import { Comp } from "./base/Comp";
import { Button } from "./core/Button";
import { Div } from "./core/Div";
import { Heading } from "./core/Heading";
import { Progress } from "./core/Progress";
import { TourPanel } from "./core/TourPanel";
import { FullScreenCalendar } from "./FullScreenCalendar";
import { FullScreenControlBar } from "./FullScreenControlBar";
import { FullScreenGraphViewer } from "./FullScreenGraphViewer";
import { FullScreenImgViewer } from "./FullScreenImgViewer";
import { LeftNavPanel } from "./LeftNavPanel";
import { Main } from "./Main";
import { RightNavPanel } from "./RightNavPanel";
import { TabPanel } from "./TabPanel";

export class App extends Main {

    constructor() {
        super(null, { id: "appPanelId", role: "main" });
    }

    override preRender(): boolean | null {
        const ast = getAs();

        if (!ast.appInitComplete) {
            this.children = [new Progress()];
            return true;
        }

        /* For mobile mode we render just the topmost dialog, if dialogs exist, and don't render
        anything else at all */
        if (ast.mobileMode && ast.dialogStack.length > 0) {
            // eventually ONLY mobile will do this 'top-only' display, and desktop mode will have
            // all dialog divs simultaneously onscreen in background of top one.
            const dialog = ast.dialogStack[ast.dialogStack.length - 1];
            if (dialog && dialog.mode !== DialogMode.POPUP) {
                this.children = [dialog];
                return true;
            }
        }

        const fullScreenViewer = this.getFullScreenViewer();
        const mobileTopBar = this.getTopMobileBar();
        this.attribs.className = "container-fluid " + (ast.mobileMode ? "mainContainerMobile" : "mainContainer");

        if (fullScreenViewer) {
            this.children = [
                ast.fullScreenConfig.type !== FullScreenType.CALENDAR ? new FullScreenControlBar() : null,
                new Clearfix(),
                fullScreenViewer
            ];
        }
        else {
            if (S.quanta.config.requireCrypto && !S.crypto.avail) {
                this.children = [new Heading(4, S.quanta.config.brandingAppName + " requires a browser with crypto features.")];
                return true;
            }

            this.children = [
                new Div(null, {
                    className: Tailwind.row + " mainAppRow",
                    id: "appMainContainer"
                }, [
                    ast.tour ? new TourPanel() : null,
                    ast.mobileMode ? null : new LeftNavPanel(),
                    new TabPanel(mobileTopBar),
                    ast.mobileMode || !ast.showRhs ? null : new RightNavPanel()
                ])
            ];
        }

        if (ast.dialogStack?.length > 0) {
            this.addChildren(ast.dialogStack);
        }
        return true;
    }

    /* This is where we send an event that lets code hook into the render cycle to process whatever
        needs to be done AFTER the main render is complete, like doing scrolling for example */
    override _domUpdateEvent = () => {
        PubSub.pub(C.PUBSUB_mainWindowScroll);
        PubSub.pub(C.PUBSUB_postMainWindowScroll);
    };

    getFullScreenViewer(): Comp {
        switch (getAs().fullScreenConfig.type) {
            case FullScreenType.IMAGE:
                return new FullScreenImgViewer();
            case FullScreenType.GRAPH:
                return new FullScreenGraphViewer();
            case FullScreenType.CALENDAR:
                return new FullScreenCalendar();
            default:
                return null;
        }
    }

    getTopMobileBar(): Comp {
        const ast = getAs();
        if (ast.mobileMode) {
            // DO NOT DELETE:
            // Currently we have no need to show the menu to anonymous users, but I want to keep
            // this here for future purposes in case we eventually do need this menu.
            const menuButton = new Button(null, S.nav._showMainMenu, {
                id: "mainMenu"
            }, "-primary menuButton", "fa-bars fa-lg");

            const navButton = new Button(null, () => new NavPanelDlg().open(), {
                id: "navMenu"
            }, "-primary menuButton", "fa-sitemap fa-lg");

            const loginButton = ast.isAnonUser ? new Div("Login", {
                className: "mt-3 mr-3 cursor-pointer",
                id: "loginButton",
                onClick: S.user.userLogin
            }) : null;

            // for mobile mode don't try to fit the signup button in the header bar, because the
            // header bar needs to be fixed height and signup won't fit. There's a signup button on
            // the Login so users can signup
            const signupButton = ast.isAnonUser && !ast.mobileMode ? new Div("Signup", {
                className: "mt-3 mr-3 cursor-pointer",
                id: "loginButton",
                onClick: S.user.userSignup
            }) : null;

            const floatRightDiv = new Div(null, { className: "float-right" }, [
                loginButton, signupButton,
                !ast.isAnonUser ? new Div(ast.userName, {
                    className: "cursor-pointer mr-3 mt-3",
                    // NOTE: No data attribute here. Null opens our own profile
                    onClick: S.nav._clickToOpenUserProfile
                }) : null
            ]);

            return new Div(null, { className: "mobileHeaderBar" }, [menuButton, navButton, floatRightDiv]);
        }
        return null;
    }

    override _domPreUpdateEvent = (): void => {
        const elm = this.getRef();
        if (!elm) return;

        const ast = getAs();

        if (ast.highlightText) {
            S.domUtil.highlightText(elm /* document.body */, ast.highlightText);
        }
    }
}
