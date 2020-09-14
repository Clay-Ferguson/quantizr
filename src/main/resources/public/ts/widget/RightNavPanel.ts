import { Constants as C } from "../Constants";
import { Div } from "./Div";

export class RightNavPanel extends Div {

    constructor() {
        super();
        this.attribs.className = "col-" + C.rightNavPanelCols + " offset-" + (C.leftNavPanelCols + C.mainPanelCols) + " rightNavPanel position-fixed";
    }

    preRender(): void {
        // const state: AppState = useSelector((state: AppState) => state);

        this.setChildren([
        ]);
    }
}
