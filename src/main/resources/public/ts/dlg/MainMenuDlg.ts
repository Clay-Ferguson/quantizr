import { getAppState } from "../AppContext";
import { CompIntf } from "../comp/base/CompIntf";
import { DialogBase, DialogMode } from "../DialogBase";
import { MenuPanel } from "../MenuPanel";

export class MainMenuDlg extends DialogBase {

    constructor() {
        super(null, "app-modal-menu", true, DialogMode.POPUP, true);
    }

    renderDlg(): CompIntf[] {
        return [
            new MenuPanel(getAppState())
        ];
    }
}
