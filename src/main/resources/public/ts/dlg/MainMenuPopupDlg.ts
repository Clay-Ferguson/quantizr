import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { MenuPanel } from "../MenuPanel";
import { DialogBase } from "../DialogBase";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class MainMenuPopupDlg extends DialogBase {

    constructor() {
        super(null, "app-modal-menu", true, true);
        let menu = new MenuPanel();
        this.setChildren([
            menu
        ]);

        this.whenElm((elm: HTMLElement) => {
            //todo-0: check the code flow once more and be sure this isn't redundat here!
            S.meta64.refreshAllGuiEnablement();
        });
    }
}
