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

        S.dom.whenElm(this.getId(), (elm : HTMLElement) => {
            S.meta64.refreshAllGuiEnablement();
            elm.style.display = "inline-block";
        });
    }
}
