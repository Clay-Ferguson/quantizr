import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import clientInfo from "../ClientInfo";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { Div } from "./Div";
import { FullScreenCalendar } from "./FullScreenCalendar";
import { FullScreenControlBar } from "./FullScreenControlBar";
import { FullScreenGraphViewer } from "./FullScreenGraphViewer";
import { FullScreenImgViewer } from "./FullScreenImgViewer";
import { IconButton } from "./IconButton";
import { Img } from "./Img";
import { LeftNavPanel } from "./LeftNavPanel";
import { Main } from "./Main";
import { RightNavPanel } from "./RightNavPanel";
import { Span } from "./Span";
import { TabPanel } from "./TabPanel";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class App extends Div {
    tabPanel: TabPanel = null;

    constructor(attribs: Object = {}) {
        super(null, attribs);

        // Since we only instantiate ONE App ever we don't need an 'unsubscribe' and also
        // our pubsub doesn't even HAVE any unsubscribe function yet.
        PubSub.sub(C.PUBSUB_ClearComponentCache, () => {
            this.tabPanel = null;
        });
    }

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);

        if (!state.guiReady) {
            this.setChildren([new Div("Loading...")]);
            return;
        }

        let fullScreenViewer: Comp = null;

        if (state.fullScreenViewId) {
            fullScreenViewer = new FullScreenImgViewer();
        }
        else if (state.fullScreenGraphId) {
            fullScreenViewer = new FullScreenGraphViewer(state);
        }
        else if (state.fullScreenCalendarId) {
            fullScreenViewer = new FullScreenCalendar();
        }

        let mobileTopBar = null;
        if (clientInfo.isMobile) {
            let menuButton = null;
            menuButton = new IconButton("fa-bars", "Menu", {
                onClick: e => {
                    S.nav.showMainMenu(state);
                },
                id: "mainMenu"
                // only applies to mobile. just don't show title for now.
                // title: "Show Main Menu"
            }, "btn-secondary marginRight", "off");

            let signupButton = state.isAnonUser ? new IconButton("fa-user-plus", "Signup", {
                onClick: e => { S.nav.signup(state); },
                title: "Create new Account"
            }, "btn-primary marginRight", "off") : null;

            let loginButton = state.isAnonUser ? new IconButton("fa-sign-in", "Login", {
                onClick: e => { S.nav.login(state); },
                title: "Login to Quanta"
            }, "btn-primary marginRight", "off") : null;

            let logo = new Img(this.getId() + "_logo", {
                className: "marginRight smallLogoButton",
                src: "/images/eagle-logo-50px-tr.jpg",
                onClick: () => { window.location.href = window.location.origin; }
            });
            let title = new Span(state.title);
            mobileTopBar = new Div(null, null, [logo, menuButton, signupButton, loginButton, title]);
        }

        let main: Main = null;
        let allowEditMode = state.node && !state.isAnonUser;

        let floatingControlBar = null;
        if (!clientInfo.isMobile) {
            let topScrollUpButton = new IconButton("fa-angle-double-up", null, {
                onClick: e => {
                    window.scrollTo(0, 0);
                },
                title: "Scroll to Top"
            }, "btn-secondary floatingControlBarItem", "off");

            let editButton = (allowEditMode && !fullScreenViewer) ? new IconButton("fa-pencil", null, {
                onClick: e => { S.edit.toggleEditMode(state); },
                title: "Turn edit mode " + (state.userPreferences.editMode ? "off" : "on")
            }, "btn-secondary floatingControlBarItem", state.userPreferences.editMode ? "on" : "off") : null;

            let prefsButton = !state.isAnonUser ? new IconButton("fa-gear", null, {
                onClick: e => { S.edit.editPreferences(state); },
                title: "Edit user preferences"
            }, "btn-secondary floatingControlBarItem", "off") : null;

            let rootButton = !state.isAnonUser ? new IconButton("fa-database", null, {
                onClick: e => { S.nav.navHome(state); },
                title: "Your Root Node"
            }, "btn-secondary floatingControlBarItem", "off") : null;

            let homeButton = new IconButton("fa-home", null, {
                onClick: e => { S.meta64.loadAnonPageHome(state); },
                title: "Portal Home"
            }, "btn-secondary floatingControlBarItem", "off");

            let clipboardPasteButton = !state.isAnonUser ? new IconButton("fa-clipboard", null, {
                onClick: e => {
                    S.edit.saveClipboardToChildNode();
                },
                title: "Save Clipboard"
            }, "btn-secondary floatingControlBarItem", "off") : null;

            // these are the buttons at the upper right of the page.
            if (topScrollUpButton || rootButton || homeButton || prefsButton || editButton) {
                floatingControlBar = new Div(null, { className: "floatingControlBar" }, [topScrollUpButton, rootButton, homeButton, prefsButton, clipboardPasteButton, editButton]);
            }
        }

        this.setChildren([
            mobileTopBar,

            // calendar has close button itself, and doesn't need any control bar showing.
            (fullScreenViewer && !state.fullScreenCalendarId) ? new FullScreenControlBar() : null,

            fullScreenViewer ? new Div(null, { className: "clearfix" }) : null,
            // For 'Main' using 'container-fluid instead of 'container' makes the left and right panels
            // both get sized right with no overlapping.
            fullScreenViewer ||
            (main = new Main({ role: "main", className: clientInfo.isMobile ? "container" : "container-fluid" }, [
                new Div(null, {
                    className: "row",
                    role: "banner"
                }, [
                    clientInfo.isMobile ? null : new LeftNavPanel(),
                    this.tabPanel || (this.tabPanel = new TabPanel()),
                    clientInfo.isMobile ? null : new RightNavPanel()
                ])
            ])),

            fullScreenViewer ? null : floatingControlBar,

            (clientInfo.isMobile || fullScreenViewer) ? null : new IconButton("fa-angle-double-up", null, {
                onClick: e => {
                    window.scrollTo(0, 0);
                },
                title: "Scroll to Top"
            }, "btn-secondary scrollTopButton", "off")
        ]);

        if (main) {
            /* This is where we send an event that lets code hook into the render cycle to process whatever needs
            to be done AFTER the main render is complete, like doing scrolling for example */
            main.domUpdateEvent = () => {
                PubSub.pub(C.PUBSUB_mainWindowScroll);
                PubSub.pub(C.PUBSUB_postMainWindowScroll);
            };
        }
        else if (fullScreenViewer) {
            fullScreenViewer.domUpdateEvent = () => {
                S.view.docElm.scrollTop = 0;
            };
        }
    }
}
