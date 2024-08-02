import { State } from "../../State";
import { Comp } from "../base/Comp";

interface LS { // Local State
    value: string;
}

export class Input extends Comp {

    constructor(attribs: any = null, s?: State<LS>) {
        super(attribs, s || new State<LS>(null));

        this.attribs.onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
            this.mergeState<LS>({ value: evt.target.value });
        };
        this.tag = "input";
    }

    override preRender = (): boolean => {
        this.attribs.value = this.getState<LS>().value || "";
        return true;
    }
}
