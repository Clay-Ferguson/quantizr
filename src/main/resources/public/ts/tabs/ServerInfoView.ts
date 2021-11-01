import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { AppTab } from "../widget/AppTab";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { Pre } from "../widget/Pre";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ServerInfoView extends AppTab {

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        data.inst = this;
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        this.attribs.className = this.getClass(state);
        this.setChildren([
            new Div(null, { className: "marginTop" }, [

                state.serverInfoCommand === "getServerInfo" ? new Button("Refresh", () => {
                    S.view.runServerCommand("getServerInfo", "Server Info", null, state);
                }, { className: "float-end" }) : null,

                new Heading(3, state.serverInfoTitle),
                new Pre(state.serverInfoText, { className: "serverInfoText" })
            ])
        ]);
    }
}
