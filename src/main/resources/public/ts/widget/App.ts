import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { Button } from "./Button";
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

declare var g_brandingAppName;

export class App extends Div {

    constructor(attribs: Object = {}) {
        super(null, attribs);
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
        if (state.mobileMode) {
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
                onClick: e => { S.nav.signup(state); }
            }, "btn-primary marginRight", "off") : null;

            let loginButton = state.isAnonUser ? new IconButton("fa-sign-in", "Login", {
                onClick: e => { S.nav.login(state); }
            }, "btn-primary marginRight", "off") : null;

            let logo = new Img(this.getId() + "_logo", {
                className: "marginRight smallLogoButton",
                src: "/branding/logo-50px-tr.jpg",
                onClick: () => { window.location.href = window.location.origin; },
                title: "Main application Landing Page"
            });

            let appName = new Span(g_brandingAppName, {
                className: "logo-text",
                onClick: e => { S.meta64.loadAnonPageHome(null); },
                title: "Go to Portal Home Node"
            });

            let title = state.title ? new Button("@" + state.title, e => { S.nav.navHome(state); }) : null;
            mobileTopBar = new Div(null, null, [menuButton, logo, appName, signupButton, loginButton, title]);
        }

        let main: Main = null;
        let allowEditMode = state.node && !state.isAnonUser;

        let floatingControlBar = null;
        if (!state.mobileMode) {
            let topScrollUpButton = new IconButton("fa-angle-double-up", null, {
                onClick: e => {
                    window.scrollTo(0, 0);
                },
                title: "Scroll to Top"
            }, "btn-secondary floatingControlBarItem", "off");

            floatingControlBar = new Div(null, { className: "floatingControlBar" }, [topScrollUpButton]);
        }

        let mainClass = null;
        if (state.userPreferences.editMode) {
            mainClass = state.mobileMode ? "container-mobile-edit" : "container-fluid";
        }
        else {
            mainClass = state.mobileMode ? "container-mobile" : "container-fluid";
        }

        this.setChildren([
            mobileTopBar,

            // calendar has close button itself, and doesn't need any control bar showing.
            (fullScreenViewer && !state.fullScreenCalendarId) ? new FullScreenControlBar() : null,

            fullScreenViewer ? new Div(null, { className: "clearfix" }) : null,
            /* For 'Main' using 'container-fluid instead of 'container' makes the left and right panels
             both get sized right with no overlapping. */
            fullScreenViewer ||
            (main = new Main({ role: "main", className: mainClass }, [
                new Div(null, {
                    className: "row main-app-row"
                }, [
                    state.mobileMode ? null : new LeftNavPanel(),
                    new TabPanel(),
                    state.mobileMode ? null : new RightNavPanel()
                ])
            ])),

            fullScreenViewer ? null : floatingControlBar,

            (state.mobileMode || fullScreenViewer) ? null : new IconButton("fa-angle-double-up", null, {
                onClick: e => {
                    // Log.log("scrollTop by button");
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
                // Log.log("Restore ScrollPos fs top");
                S.view.docElm.scrollTop = 0;
            };
        }
    }
}
