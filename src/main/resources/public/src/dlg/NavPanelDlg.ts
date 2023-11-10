import { Comp } from "../comp/base/Comp";
import { RightNavPanel } from "../comp/RightNavPanel";
import { Constants as C } from "../Constants";
import { DialogBase, DialogMode } from "../DialogBase";
import { PubSub } from "../PubSub";

export class NavPanelDlg extends DialogBase {
    static inst: NavPanelDlg = null;
    constructor() {
        super("Navigation", "appModalNavPanel", C.ID_RHS, DialogMode.POPUP, true);
        NavPanelDlg.inst = this;
    }

    renderDlg(): Comp[] {
        return [new RightNavPanel()];
    }
}

PubSub.sub(C.PUBSUB_closeNavPanel, (_payload: string) => {
    if (NavPanelDlg.inst) {
        NavPanelDlg.inst.close();
        NavPanelDlg.inst = null;
    }
});
