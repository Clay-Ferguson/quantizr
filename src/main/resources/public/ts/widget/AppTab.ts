import { AppState } from "../AppState";
import { Div } from "./Div";
import { Li } from "./Li";

export class AppTab extends Div {
    constructor(attribs: Object = {}) {
        super(null, attribs);
    }

    /* Should be overridden by concrete clases */
    public getTabButton(state: AppState): Li {
        return null;
    }
}
