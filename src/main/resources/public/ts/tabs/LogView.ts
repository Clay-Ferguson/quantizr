import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { LogViewIntf } from "../intf/LogViewIntf";
import { TabDataIntf } from "../intf/TabDataIntf";
import { Log } from "../Log";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { AppTab } from "../widget/AppTab";
import { Heading } from "../widget/Heading";
import { Html } from "../widget/Html";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LogView extends AppTab implements LogViewIntf {
    static logs: string = "";

    constructor(data: TabDataIntf) {
        super(data);
        Log.logView = this;

        // For some reason I can't get the console.log override to work.
        // (function() {
        //     let oldLog = console.log;
        //     console.log = function (msg) {
        //         LogView.logs += msg;
        //         LogView.logs += "\n";
        //         oldLog.apply(console, arguments);
        //     };
        // })();
    }

    log = (msg: string): any => {
        LogView.logs += msg;
        LogView.logs += "\n";
    }

    preRender(): void {
        const state: AppState = store.getState();

        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab === this.getId()) {
            this.attribs.className += " show active";
        }

        this.setChildren([
            new Heading(3, "Log", { className: "logView" }),
            new Html("<pre>" + LogView.logs + "</pre>")
        ]);
    }

    // Opens the tab, querying the info from the server to update
    open = (readOnly: boolean, userId: string): any => {
    }

    close = (): void => {
        // const state: AppState = store.getState();
        // dispatch({
        //     type: "Action_InitUserProfile",
        //     state,
        //     update: (s: AppState): void => {
        //         s.activeTab = C.TAB_MAIN;
        //         s.userProfile = null;
        //     }
        // });
    }
}
