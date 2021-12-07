import { Div } from "./Div";

// note: class not in use yet
export class DlgContainer extends Div {

    constructor(attribs: Object = {}) {
        super(null, attribs);
    }

    preRender(): void {
        this.setChildren([
            new Div("This is a test")
        ]);
    }
}
