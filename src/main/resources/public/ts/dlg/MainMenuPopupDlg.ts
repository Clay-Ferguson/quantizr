import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { MenuPanel } from "../MenuPanel";
import { DialogBase } from "../DialogBase";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class MainMenuPopupDlg extends DialogBase {

    constructor(state: AppState) {
        super(null, "app-modal-menu", true, true, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new MenuPanel(this.appState)
        ];
    }
}
