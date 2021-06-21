import { store } from "../AppRedux";
import { DialogBase } from "../DialogBase";
import { MenuPanel } from "../MenuPanel";
import { CompIntf } from "../widget/base/CompIntf";
import { Menu } from "../widget/Menu";

export class MainMenuDlg extends DialogBase {

    constructor() {
        super(null, "app-modal-menu", true, store.getState());
    }

    renderDlg(): CompIntf[] {
        // need a variable to hold "Tabs" (it's used two places)
        Menu.activeMenu = "Tabs";
        return [
            new MenuPanel(this.appState)
        ];
    }
}
