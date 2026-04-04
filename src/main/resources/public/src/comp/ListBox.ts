import { ValueIntf } from "../Interfaces";
import { Comp } from "./base/Comp";

export class ListBox extends Comp {

    constructor(public valueIntf: ValueIntf = null) {
        super();
        this.setClass("mb-3");

        if (this.valueIntf) {
            this.mergeState({ value: valueIntf.getValue() });
        }
    }

    // Handler to update state
    updateVal(value: string): void {
        /* For list boxes that just present a list and don't have the goal of letting the user
        'choose' one, we won't have a valueIntf */
        if (this.valueIntf) {
            this.valueIntf.setValue(value);
            this.mergeState({ value });
        }
    }
}
