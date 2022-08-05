import { useAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Img } from "../comp/core/Img";
import { Constants as C } from "../Constants";
import { NavPanelDlg } from "../dlg/NavPanelDlg";
import { FullScreenType } from "../Interfaces";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Button } from "./core/Button";
import { FullScreenCalendar } from "./FullScreenCalendar";
import { FullScreenControlBar } from "./FullScreenControlBar";
import { FullScreenGraphViewer } from "./FullScreenGraphViewer";
import { FullScreenImgViewer } from "./FullScreenImgViewer";
import { LeftNavPanel } from "./LeftNavPanel";
import { Main } from "./Main";
import { RightNavPanel } from "./RightNavPanel";
import { TabPanel } from "./TabPanel";

declare var g_brandingAppName: string;

export class App extends Main {

    constructor() {
        super(null, { id: "appPanelId", role: "main" });
    }

    preRender(): void {
        const state = useAppState();

        if (!state.guiReady) {
            this.setChildren(null);
            return;
        }

        if (state.dialogStack.length > 0) {
            const dialog = state.dialogStack[state.dialogStack.length - 1];
            if (dialog) {
                this.setChildren([dialog]);
                return;
            }
        }

        const fullScreenViewer = this.getFullScreenViewer(state);
        const mobileTopBar = this.getTopMobileBar(state);
        this.attribs.className = "container-fluid " + (state.mobileMode ? "mainContainerMobile" : "mainContainer");

        if (fullScreenViewer) {
            this.setChildren([
                state.fullScreenConfig.type !== FullScreenType.CALENDAR ? new FullScreenControlBar() : null,
                new Clearfix(),
                fullScreenViewer
            ]);
        }
        else {
            this.setChildren([
                new Div(null, {
                    className: "row mainAppRow",
                    id: "appMainContainer"
                }, [
                    state.mobileMode ? null : new LeftNavPanel(),
                    new TabPanel(mobileTopBar),
                    state.mobileMode ? null : new RightNavPanel()
                ]),

                // I don't like this clutter. Leaving as an example for now.
                // new IconButton("fa-angle-double-up", null, {
                //     onClick: () => {
                //         S.view.scrollAllTop(state);
                //     },
                //     title: "Scroll to Top"
                // }, "btn-secondary scrollTopButtonUpperRight", "off"),

                state.mobileMode ? null : new IconButton("fa-angle-double-up", null, {
                    onClick: () => {
                        S.view.scrollAllTop(state);
                    },
                    title: "Scroll to Top"
                }, "btn-secondary scrollTopButtonLowerRight", "off")
            ]);
        }
    }

    /* This is where we send an event that lets code hook into the render cycle to process whatever needs
        to be done AFTER the main render is complete, like doing scrolling for example */
    domUpdateEvent = () => {
        // todo-2: based on current scrolling architecture do we still need these pub/sub events?
        PubSub.pub(C.PUBSUB_mainWindowScroll);
        PubSub.pub(C.PUBSUB_postMainWindowScroll);
    };

    getFullScreenViewer = (state: AppState): CompIntf => {

        switch (state.fullScreenConfig.type) {
            case FullScreenType.IMAGE:
                return new FullScreenImgViewer();
            case FullScreenType.GRAPH:
                // inconsistent to pass state here. try not to. todo-1
                return new FullScreenGraphViewer(state);
            case FullScreenType.CALENDAR:
                return new FullScreenCalendar();
            default:
                return null;
        }
    }

    getTopMobileBar = (state: AppState): CompIntf => {
        if (state.mobileMode) {
            const menuButton = new IconButton("fa-bars", "Menu", {
                onClick: () => S.nav.showMainMenu(state),
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

            const loginButton = state.isAnonUser ? new Button("Login", S.user.userLogin, {
                className: "menuButton"
            }, "btn-primary") : null;

            const logo = new Img(this.getId("logo_"), {
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
}
