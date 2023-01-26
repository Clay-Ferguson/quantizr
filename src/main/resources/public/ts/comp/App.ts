import { getAs } from "../AppContext";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Img } from "../comp/core/Img";
import { Constants as C } from "../Constants";
import { DialogMode } from "../DialogBase";
import { NavPanelDlg } from "../dlg/NavPanelDlg";
import { FullScreenType } from "../Interfaces";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Button } from "./core/Button";
import { Heading } from "./core/Heading";
import { Progress } from "./core/Progress";
import { FullScreenCalendar } from "./FullScreenCalendar";
import { FullScreenControlBar } from "./FullScreenControlBar";
import { FullScreenGraphViewer } from "./FullScreenGraphViewer";
import { FullScreenImgViewer } from "./FullScreenImgViewer";
import { LeftNavPanel } from "./LeftNavPanel";
import { Main } from "./Main";
import { RightNavPanel } from "./RightNavPanel";
import { TabPanel } from "./TabPanel";

declare const g_requireCrypto: string;
declare const g_brandingAppName: string;

export class App extends Main {

    constructor() {
        super(null, { id: "appPanelId", role: "main" });
    }

    preRender(): void {
        const ast = getAs();
        if (!ast.appInitComplete) {
            this.setChildren([new Progress()]);
            return;
        }

        /* For mobile mode we render just the topmost dialog, if dialogs exist, and don't render anything else at all */
        if (ast.mobileMode && ast.dialogStack.length > 0) {
            // eventually ONLY mobile will do this 'top-only' display, and desktop mode will have all dialog
            // divs simultaneously onscreen in background of top one.
            const dialog = ast.dialogStack[ast.dialogStack.length - 1];
            if (dialog && dialog.mode !== DialogMode.POPUP) {
                this.setChildren([dialog]);
                return;
            }
        }

        const fullScreenViewer = this.getFullScreenViewer();
        const mobileTopBar = this.getTopMobileBar();
        this.attribs.className = "container-fluid " + (ast.mobileMode ? "mainContainerMobile" : "mainContainer");

        if (fullScreenViewer) {
            this.setChildren([
                ast.fullScreenConfig.type !== FullScreenType.CALENDAR ? new FullScreenControlBar() : null,
                new Clearfix(),
                fullScreenViewer
            ]);
        }
        else {
            if (g_requireCrypto === "true" && (!crypto || !crypto.subtle)) {
                this.setChildren([new Heading(4, g_brandingAppName + " requires a browser with crypto features.")]);
                return;
            }

            this.setChildren([
                new Div(null, {
                    className: "row mainAppRow",
                    id: "appMainContainer"
                }, [
                    ast.mobileMode ? null : new LeftNavPanel(),
                    new TabPanel(mobileTopBar),
                    ast.mobileMode ? null : new RightNavPanel()
                ])
            ]);
        }

        if (ast.dialogStack?.length > 0) {
            this.addChildren(ast.dialogStack);
        }
    }

    /* This is where we send an event that lets code hook into the render cycle to process whatever needs
        to be done AFTER the main render is complete, like doing scrolling for example */
    domUpdateEvent = () => {
        PubSub.pub(C.PUBSUB_mainWindowScroll);
        PubSub.pub(C.PUBSUB_postMainWindowScroll);
    };

    getFullScreenViewer = (): CompIntf => {
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

    getTopMobileBar = (): CompIntf => {
        const ast = getAs();
        if (ast.mobileMode) {
            const menuButton = new IconButton("fa-bars", "Menu", {
                onClick: S.nav.showMainMenu,
                id: "mainMenu"
            }, "btn-primary menuButton", "off");

            const navButton = new IconButton("fa-sitemap", "Nav", {
                onClick: () => new NavPanelDlg().open(),
                id: "navMenu"
            }, "btn-primary menuButton", "off");

            // let fullScreenViewer = S.util.fullscreenViewerActive(state);

            // Not needed now that we have the NAV button
            // let prefsButton = !fullScreenViewer
            //     ? new Checkbox("Info", { className: "marginLeft" }, {
            //         setValue: (checked: boolean) => S.edit.toggleShowMetaData(state),
            //         getValue: (): boolean => state.userPrefs.showMetaData
            //     }, "form-switch form-check-inline") : null;

            const loginButton = ast.isAnonUser ? new Button("Login", S.user.userLogin, {
                className: "menuButton"
            }, "btn-primary") : null;

            const logo = new Img({
                className: "marginRight smallLogoButton",
                src: "/branding/logo-50px-tr.jpg",
                onClick: () => S.nav.navPublicHome(),
                title: "Main application Landing Page"
            });

            // let messagesSuffix = state.newMessageCount > 0
            //     ? " (" + state.newMessageCount + ")" : "";
            // let appName = new Span(g_brandingAppName + messagesSuffix, {
            //     className: "logo-text",
            //     onClick: () => { S.util.loadAnonPageHome(null); },
            //     title: "Go to Portal Home Node"
            // });

            // let title = !state.isAnonUser ? new Button("@" + state.userName, () => S.nav.navHome(state), null, "btn-secondary") : null;
            return new Div(null, { className: "mobileHeaderBar" }, [logo, menuButton, navButton, loginButton]);
        }
        return null;
    }

    domPreUpdateEvent = (): void => {
        const elm = this.getRef();
        if (!elm) return;

        const ast = getAs();

        if (ast.highlightText) {
            S.domUtil.highlightText(elm /* document.body */, ast.highlightText);
        }
    }
}
