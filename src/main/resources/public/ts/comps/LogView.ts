import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { LogViewIntf } from "../intf/LogViewIntf";
import { Log } from "../Log";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { AppTab } from "../widget/AppTab";
import { Html } from "../widget/Html";
import { Li } from "../widget/Li";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LogView extends AppTab implements LogViewIntf {
    static logs: string = "";
    static showLogs: boolean = false;

    constructor() {
        super({
            id: "logTab"
        });
        Log.logView = this;
    }

    log = (msg: string): any => {
        if (LogView.showLogs) {
            LogView.logs += msg;
            LogView.logs += "\n";
        }
    }

    preRender(): void {
        const state: AppState = store.getState();

        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab === this.getId()) {
            this.attribs.className += " show active";
        }

        this.setChildren([
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
        //         s.activeTab = "mainTab";
        //         s.userProfile = null;
        //     }
        // });
    }
}
