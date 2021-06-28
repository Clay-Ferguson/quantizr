import { store } from "../AppRedux";
import { DialogBase } from "../DialogBase";
import { DialogMode } from "../enums/DialogMode";
import { MenuPanel } from "../MenuPanel";
import { CompIntf } from "../widget/base/CompIntf";

export class MainMenuDlg extends DialogBase {

    constructor() {
        super(null, "app-modal-menu", true, store.getState(), DialogMode.POPUP, true);
    }

    renderDlg(): CompIntf[] {
        // need a variable to hold "Tabs" (it's used two places)
        return [
            new MenuPanel(this.appState)
        ];
    }
}
