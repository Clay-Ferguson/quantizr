import { Div } from "./Div";

export class Divc extends Div {
    constructor(attribs: any, children: any[] = null) {
        super(null, attribs);
        this.setChildren(children);
    }
}
