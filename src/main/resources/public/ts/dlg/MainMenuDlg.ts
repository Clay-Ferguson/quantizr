import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { DialogBase } from "../DialogBase";
import { DialogMode } from "../enums/DialogMode";
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
