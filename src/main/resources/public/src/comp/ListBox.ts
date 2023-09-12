import { Div } from "../comp/core/Div";
import { ValueIntf } from "../Interfaces";

export class ListBox extends Div {

    constructor(public valueIntf: ValueIntf = null) {
        super(null);
        this.setClass("list-group marginBottom");

        if (this.valueIntf) {
            this.mergeState({ value: valueIntf.getValue() });
        }
    }

    // Handler to update state
    updateVal(value: string): void {
        /* For list boxes that just present a list and don't have the goal of letting the user 'choose' one, we won't have a valueIntf */
        if (this.valueIntf) {
            this.valueIntf.setValue(value);
            this.mergeState({ value });
        }
    }
}
