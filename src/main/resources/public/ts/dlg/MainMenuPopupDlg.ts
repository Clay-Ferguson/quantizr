import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { MenuPanel } from "../MenuPanel";
import { DialogBase } from "../DialogBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class MainMenuPopupDlg extends DialogBase {

    constructor(public nodesToMove: string[]) {
        super(null, "app-modal-menu", true, true);
        let menu = new MenuPanel(nodesToMove);
        this.setChildren([
            menu
        ]);
    }
}
