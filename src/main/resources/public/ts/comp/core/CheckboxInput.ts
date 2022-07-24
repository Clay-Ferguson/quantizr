import { ReactNode } from "react";
import { ValueIntf } from "../../Interfaces";
import { State } from "../../State";
import { Comp } from "../base/Comp";

interface LS { // Local State
    checked: boolean;
}

export class CheckboxInput extends Comp {

    constructor(attribs: Object = {}, s?: State, private valueIntf?: ValueIntf) {
        super(attribs, s || new State());

        this.attribs.onChange = (evt) => {
            // let checked = this.getRef().state.checked; // <-- I think this would work too, to get state.
            this.mergeState<LS>({ checked: evt.target.checked });
            if (this.valueIntf) {
                this.valueIntf.setValue(evt.target.checked);
            }
        };
        if (this.valueIntf) {
            this.mergeState<LS>({ checked: !!valueIntf.getValue() })
        }
    }

    compRender = (): ReactNode => {
        this.attribs.checked = this.getState<LS>().checked;
        return this.tag("input");
    }
}
