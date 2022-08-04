import { useAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { Button } from "../comp/core/Button";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { Pre } from "../comp/core/Pre";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";

export class ServerInfoView extends AppTab {

    constructor(data: TabIntf) {
        super(data);
        data.inst = this;
    }

    preRender(): void {
        const state = useAppState();
        this.attribs.className = this.getClass(state);
        this.setChildren([
            new Div(null, { className: "marginTop" }, [

                state.serverInfoCommand === "getServerInfo" ? new Button("Refresh", () => {
                    S.view.runServerCommand("getServerInfo", null, "Info View", null, state);
                }, { className: "float-end" }) : null,

                new Heading(3, state.serverInfoTitle),
                new Pre(state.serverInfoText, { className: "serverInfoText" })
            ])
        ]);
    }
}
