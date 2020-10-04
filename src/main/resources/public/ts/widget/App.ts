import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import clientInfo from "../ClientInfo";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { Div } from "./Div";
import { FullScreenCalendar } from "./FullScreenCalendar";
import { FullScreenGraphViewer } from "./FullScreenGraphViewer";
import { FullScreenImgViewer } from "./FullScreenImgViewer";
import { LeftNavPanel } from "./LeftNavPanel";
import { Main } from "./Main";
import { MainNavPanel } from "./MainNavPanel";
import { RightNavPanel } from "./RightNavPanel";
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
        const appState: AppState = useSelector((state: AppState) => state);

        if (!appState.guiReady) {
            this.setChildren([new Div("Loading...")]);
            return;
        }

        let fullScreenViewer: Comp = null;
        if (appState.fullScreenViewId) {
            fullScreenViewer = new FullScreenImgViewer();
        }
        else if (appState.fullScreenGraphId) {
            fullScreenViewer = new FullScreenGraphViewer();
        }
        else if (appState.fullScreenCalendarId) {
            fullScreenViewer = new FullScreenCalendar();
        }

        let main: Main = null;
        this.setChildren([
            new Div(null, { role: "toolbar" }, [
                new MainNavPanel(null)
            ]),
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
            ]))
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
