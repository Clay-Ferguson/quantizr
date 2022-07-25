import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Button } from "../comp/core/Button";
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Img } from "../comp/core/Img";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { FullScreenCalendar } from "./FullScreenCalendar";
import { FullScreenControlBar } from "./FullScreenControlBar";
import { FullScreenGraphViewer } from "./FullScreenGraphViewer";
import { FullScreenImgViewer } from "./FullScreenImgViewer";
import { LeftNavPanel } from "./LeftNavPanel";
import { Main } from "./Main";
import { RightNavPanel } from "./RightNavPanel";
import { TabPanel } from "./TabPanel";

declare var g_brandingAppName;

export class App extends Main {

    constructor() {
        super(null, { role: "main" });
    }

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);

        if (!state.guiReady) {
            this.setChildren(null);
            return;
        }

        if (state.dialogStack.length > 0) {
            let dialog = state.dialogStack[state.dialogStack.length - 1];
            if (dialog) {
                this.setChildren([dialog]);
                return;
            }
        }

        let fullScreenViewer = this.getFullScreenViewer(state);
        let mobileTopBar = this.getTopMobileBar(state);
        this.attribs.className = "container-fluid mainContainer";

        if (fullScreenViewer) {
            this.setChildren([
                !state.fullScreenCalendarId ? new FullScreenControlBar() : null,
                new Clearfix(),
                fullScreenViewer
            ]);
        }
        else {
            if (state.mobileMode) {
                this.setChildren([
                    new Div(null, {
                        className: "row mainAppRow customScrollBar"
                    }, [
                        new TabPanel(mobileTopBar)
                    ])
                ]);
            }
            else {
                this.setChildren([
                    new Div(null, {
                        className: "row mainAppRow"
                    }, [
                        new LeftNavPanel(),
                        new TabPanel(),
                        new RightNavPanel()
                    ]),

                    // I don't like this clutter. Leaving as an example for now.
                    // new IconButton("fa-angle-double-up", null, {
                    //     onClick: e => {
                    //         S.view.scrollAllTop(state);
                    //     },
                    //     title: "Scroll to Top"
                    // }, "btn-secondary scrollTopButtonUpperRight", "off"),

                    new IconButton("fa-angle-double-up", null, {
                        onClick: () => {
                            S.view.scrollAllTop(state);
                        },
                        title: "Scroll to Top"
                    }, "btn-secondary scrollTopButtonLowerRight", "off")
                ]);
            }
        }
    }

    /* This is where we send an event that lets code hook into the render cycle to process whatever needs
        to be done AFTER the main render is complete, like doing scrolling for example */
    domUpdateEvent = (): void => {
        // todo-2: based on current scrolling architecture do we still need these pub/sub events?
        PubSub.pub(C.PUBSUB_mainWindowScroll);
        PubSub.pub(C.PUBSUB_postMainWindowScroll);
    };

    getFullScreenViewer = (state: AppState): CompIntf => {
        let comp: CompIntf = null;
        if (state.fullScreenViewId) {
            comp = new FullScreenImgViewer();
        }
        else if (state.fullScreenGraphId) {
            comp = new FullScreenGraphViewer(state);
        }
        else if (state.fullScreenCalendarId) {
            comp = new FullScreenCalendar();
        }

        return comp;
    }

    getTopMobileBar = (state: AppState): CompIntf => {
        let comp: CompIntf = null;
        if (state.mobileMode) {
            let menuButton = null;
            menuButton = new IconButton("fa-bars", "Menu", {
                onClick: () => {
                    S.nav.showMainMenu(state);
                },
                id: "mainMenu"
                // only applies to mobile. just don't show title for now.
                // title: "Show Main Menu"
            }, "btn-secondary menuButton", "off");

            let fullScreenViewer = S.util.fullscreenViewerActive(state);

            let prefsButton = !fullScreenViewer
                ? new Checkbox("Info", { className: "marginLeft" }, {
                    setValue: (checked: boolean): void => {
                        S.edit.toggleShowMetaData(state);
                    },
                    getValue: (): boolean => {
                        return state.userPreferences.showMetaData;
                    }
                }, "form-switch form-check-inline") : null;

            let loginButton = state.isAnonUser ? new IconButton("fa-sign-in", "", {
                onClick: () => { S.nav.login(state); }
            }, "btn-primary marginRight", "off") : null;

            let logo = new Img(this.getId("logo_"), {
                className: "marginRight smallLogoButton",
                src: "/branding/logo-50px-tr.jpg",
                onClick: () => { window.location.href = window.location.origin; },
                title: "Main application Landing Page"
            });

            // let messagesSuffix = state.newMessageCount > 0
            //     ? " (" + state.newMessageCount + ")" : "";
            // let appName = new Span(g_brandingAppName + messagesSuffix, {
            //     className: "logo-text",
            //     onClick: e => { S.util.loadAnonPageHome(null); },
            //     title: "Go to Portal Home Node"
            // });

            let title = !state.isAnonUser ? new Button("@" + state.userName, () => S.nav.navHome(state), null, "btn-secondary") : null;
            comp = new Div(null, { className: "mobileHeaderBar" }, [logo, menuButton, loginButton, title, prefsButton]);
        }
        return comp;
    }
}
