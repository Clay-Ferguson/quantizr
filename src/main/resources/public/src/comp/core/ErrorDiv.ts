import { State } from "../../State";
import { Comp, CompT } from "../base/Comp";

interface LS { // Local State
    error: string;
}

export class ErrorDiv extends Comp {

    constructor(s: State<LS>) {
        super(null, s);
        this.attribs.className = "validationError";
    }

    override preRender(): CompT[] | boolean | null {
        return [this.getState<LS>().error];
    }
}
