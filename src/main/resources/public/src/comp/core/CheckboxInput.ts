import { ValueIntf } from "../../Interfaces";
import { State } from "../../State";
import { Comp } from "../base/Comp";

interface LS { // Local State
    checked: boolean;
}

export class CheckboxInput extends Comp {
    constructor(attribs: any = {}, s?: State<LS>, private valueIntf?: ValueIntf) {
        super(attribs, s || new State<LS>(null));

        this.attribs.onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
            this.mergeState<LS>({ checked: evt.target.checked });
            this.valueIntf?.setValue(evt.target.checked);
        }
        if (this.valueIntf) {
            this.mergeState<LS>({ checked: !!valueIntf.getValue() });
        }
        this.tag = "input";
    }

    override preRender(): boolean | null {
        this.attribs.checked = this.getState<LS>().checked;
        return true;
    }
}
