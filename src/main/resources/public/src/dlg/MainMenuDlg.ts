import { Comp } from "../comp/base/Comp";
import { DialogBase, DialogMode } from "../DialogBase";
import { MenuPanel } from "../MenuPanel";
import { Constants as C } from "../Constants";

export class MainMenuDlg extends DialogBase {

    constructor() {
        super(null, "appModalMenu", C.ID_MENU, DialogMode.POPUP, true);
    }

    renderDlg(): Comp[] {
        return [
            new MenuPanel()
        ];
    }
}
