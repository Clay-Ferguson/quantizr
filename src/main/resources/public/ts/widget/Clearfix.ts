import { Div } from "./Div";

export class Clearfix extends Div {
    constructor(id: string = null) {
        super(null, { className: "clearfix", id });
    }
}
