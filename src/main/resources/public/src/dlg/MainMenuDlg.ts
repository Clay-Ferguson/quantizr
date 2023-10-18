import { Comp } from "../comp/base/Comp";
import { DialogBase, DialogMode } from "../DialogBase";
import { MenuPanel } from "../MenuPanel";

export class MainMenuDlg extends DialogBase {

    constructor() {
        super(null, "appModalMenu", true, DialogMode.POPUP, true);
    }

    renderDlg(): Comp[] {
        return [
            new MenuPanel()
        ];
    }
}
