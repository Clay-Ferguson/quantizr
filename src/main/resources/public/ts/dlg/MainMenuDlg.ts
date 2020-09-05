import { store } from "../AppRedux";
import { DialogBase } from "../DialogBase";
import { MenuPanel } from "../MenuPanel";
import { CompIntf } from "../widget/base/CompIntf";

export class MainMenuDlg extends DialogBase {

    constructor() {
        super(null, "app-modal-menu", true, store.getState());
    }

    renderDlg(): CompIntf[] {
        if (this.appState.isAnonUser) {
            //anon users don't get the menu
            return [];
        } else {
            return [
                new MenuPanel(this.appState)
            ];
        }
    }

    renderButtons(): CompIntf {
        return null;
    }
}
