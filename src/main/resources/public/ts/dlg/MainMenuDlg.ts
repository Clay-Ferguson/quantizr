import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { MenuPanel } from "../MenuPanel";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "../widget/base/CompIntf";
import { store } from "../AppRedux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

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
