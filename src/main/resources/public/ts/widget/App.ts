import { useSelector } from "react-redux";
import { fastDispatch } from "../AppRedux";
import { AppState } from "../AppState";
import clientInfo from "../ClientInfo";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { Log } from "../Log";
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

            // todo-0: do we still need this?
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
                onClick: () => { window.location.href = window.location.origin; }
            });

            let title = new Span(state.title);
            mobileTopBar = new Div(null, null, [menuButton, logo, signupButton, loginButton, title]);
        }

        let main: Main = null;
        let allowEditMode = state.node && !state.isAnonUser;

        let floatingControlBar = null;
        if (!state.mobileMode) {
            let topScrollUpButton = new IconButton("fa-angle-double-up", null, {
                onClick: e => {
                    // Log.log("scrollTop by button");
                    window.scrollTo(0, 0);
                },
                title: "Scroll to Top"
            }, "btn-secondary floatingControlBarItem", "off");

            let editButton = (allowEditMode && !fullScreenViewer) ? new IconButton("fa-pencil", null, {
                onClick: e => { S.edit.toggleEditMode(state); },
                title: "Turn edit mode " + (state.userPreferences.editMode ? "off" : "on")
            }, "btn-secondary floatingControlBarItem", state.userPreferences.editMode ? "on" : "off") : null;

            let prefsButton = !fullScreenViewer ? new IconButton("fa-certificate", null, {
                onClick: e => { S.edit.toggleShowMetaData(state); },
                title: state.userPreferences.showMetaData ? "Hide Avatars and Metadata" : "Show Avatars and Metadata"
            }, "btn-secondary floatingControlBarItem", state.userPreferences.showMetaData ? "on" : "off") : null;

            let rootButton = !state.isAnonUser ? new IconButton("fa-database", null, {
                onClick: e => { S.nav.navHome(state); },
                title: "Account Node"
            }, (state.pageMessage ? "btn-primary" : "btn-secondary") + " floatingControlBarItem", "off") : null;

            let homeButton = new IconButton("fa-home", null, {
                onClick: e => { S.meta64.loadAnonPageHome(state); },
                title: "Portal Home"
            }, (state.pageMessage ? "btn-primary" : "btn-secondary") + " floatingControlBarItem", "off");

            let clipboardPasteButton = !state.isAnonUser ? new IconButton("fa-clipboard", null, {
                onClick: e => {
                    S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
                },
                title: "Save clipboard text to my NOTES node"
            }, "btn-secondary floatingControlBarItem", "off") : null;

            let addNoteButton = !state.isAnonUser ? new IconButton("fa-sticky-note", null, {
                onClick: e => {
                    S.edit.addNode("~" + J.NodeType.NOTES, null, state);
                },
                title: "Save new note to my NOTES node"
            }, "btn-secondary floatingControlBarItem", "off") : null;

            // these are the buttons at the upper right of the page.
            if (topScrollUpButton || rootButton || homeButton || prefsButton || editButton) {
                floatingControlBar = new Div(null, { className: "floatingControlBar" }, [topScrollUpButton, rootButton, homeButton, addNoteButton, clipboardPasteButton, prefsButton, editButton]);
            }
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
                    className: "row",
                    role: "banner"
                }, [
                    state.mobileMode ? null : new LeftNavPanel(),
                    this.tabPanel || (this.tabPanel = new TabPanel()),
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
            /* This will run if for example the user closed a fullscreen viewer and we need to pop the main window back to
            it's previous scroll position */
            if (state.savedScrollPosition !== -1) {
                let restoreScrollPos = state.savedScrollPosition;
                // Log.log("Restore ScrollPos (x): " + restoreScrollPos);
                S.view.docElm.scrollTop = restoreScrollPos;
                setTimeout(() => {
                    fastDispatch({
                        type: "Action_FastRefresh",
                        updateNew: (s: AppState): AppState => {
                            state.savedScrollPosition = -1;
                            // console.log("reset ScrollPos");
                            return { ...state };
                        }
                    });
                    // Log.log("Restore ScrollPos (y): " + restoreScrollPos);
                    S.view.docElm.scrollTop = restoreScrollPos;
                }, 250);
            }
            else {
                /* This is where we send an event that lets code hook into the render cycle to process whatever needs
                to be done AFTER the main render is complete, like doing scrolling for example */
                main.domUpdateEvent = () => {
                    PubSub.pub(C.PUBSUB_mainWindowScroll);
                    PubSub.pub(C.PUBSUB_postMainWindowScroll);
                };
            }
        }
        else if (fullScreenViewer) {
            fullScreenViewer.domUpdateEvent = () => {
                // Log.log("Restore ScrollPos fs top");
                S.view.docElm.scrollTop = 0;
            };
        }
    }
}
