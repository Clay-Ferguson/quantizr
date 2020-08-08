import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { TabPanel } from "./TabPanel";
import { MainNavPanel } from "./MainNavPanel";
import { Div } from "./Div";
import { Main } from "./Main";
import { LeftNavPanel } from "./LeftNavPanel";
import { RightNavPanel } from "./RightNavPanel";
import clientInfo from "../ClientInfo";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";
import { FullScreenImgViewer } from "./FullScreenImgViewer";

//todo-1: everywhere in the app that calls 'store.getState()' is highly suspicious becasue userSelector should be used most of the time

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class App extends Div {
    tabPanel: TabPanel = null;

    constructor(attribs: Object = {}) {
        super(null, attribs);

        //Since we only instantiate ONE App ever we don't need an 'unsubscribe' and also
        //our pubsub doesn't even HAVE any unsubscribe function yet.
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

        this.setChildren([
            new Div(null, { role: "toolbar" }, [new MainNavPanel(null)]),
            //For 'Main' using 'container-fluid instead of 'container' makes the left and right panels
            //both get sized right with no overlapping.
            appState.fullScreenViewId ? //

            new FullScreenImgViewer() :
            new Main({ role: "main", className: clientInfo.isMobile ? "container" : "container-fluid" }, [
                new Div(null, {
                    className: "row",
                    role: "banner"
                }, [
                    clientInfo.isMobile ? null : new LeftNavPanel(),
                    this.tabPanel || (this.tabPanel = new TabPanel()),
                    clientInfo.isMobile ? null : new RightNavPanel()
                ])
            ])
        ]);
    }
}
