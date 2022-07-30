import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { RightNavPanel } from "../comp/RightNavPanel";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { DialogMode } from "../enums/DialogMode";
import { PubSub } from "../PubSub";

export class NavPanelDlg extends DialogBase {
    static inst: NavPanelDlg = null;
    constructor() {
        super("Navigation", "app-modal-nav-panel", true, DialogMode.POPUP, true);
        NavPanelDlg.inst = this;
    }

    renderDlg(): CompIntf[] {
        return [new RightNavPanel()];
    }

    super_close = this.close;
    close = () => {
        NavPanelDlg.inst = null;

        // It's helpful in mobile mode (NavPanel in this Popup) for users to be able to see the visual feedback of the
        // style changing on the panel to the new selection when they click something, so we use this timer for that.
        if (getAppState().mobileMode) {
            setTimeout(() => {
                this.super_close();
            }, 600);
        }
    }

    domRemoveEvent = () => {
        NavPanelDlg.inst = null;
    }
}

PubSub.sub(C.PUBSUB_navAction, () => {
    NavPanelDlg.inst?.close();
});
