import { State } from "../../State";
import { Comp } from "../base/Comp";

interface LS { // Local State
    error: string;
}

export class ErrorDiv extends Comp {

    constructor(s: State<LS>) {
        super(null, s);
        this.attribs.className = "validationError";
    }

    override preRender(): boolean | null {
        this.content = this.getState<LS>().error;
        return true;
    }
}
