import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { MenuPanel } from "../MenuPanel";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "../widget/base/CompIntf";
import { store } from "../AppRedux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

//todo-0: rename to MainMenuDlg
export class MainMenuPopupDlg extends DialogBase {

    constructor() {
        super(null, "app-modal-menu", true, store.getState());
    }

    renderDlg(): CompIntf[] {
        return [
            new MenuPanel(this.appState)
        ];
    }
}
