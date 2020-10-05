import { Comp } from "./base/Comp";
import { Div } from "./Div";

export class FormGroup extends Div {

    constructor(attribs: Object = null, public initialChildren: Comp[] = null) {
        super(null, attribs);
        this.attribs.className = "form-group";
        this.setChildren(this.initialChildren);
    }
}
