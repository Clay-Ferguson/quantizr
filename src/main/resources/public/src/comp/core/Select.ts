import { ValueIntf } from "../../Interfaces";
import { Comp } from "../base/Comp";
import { SelectionOption } from "./SelectionOption";

interface LS { // Local State
    value: string
}

export class Select extends Comp {

    constructor(attribs: any, public selectionOptions: any[], private valueIntf: ValueIntf) {
        super(attribs);
        this.mergeState({ value: valueIntf.getValue() });

        this.attribs.onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
            this.valueIntf.setValue(evt.target.value);
            this.mergeState({ value: evt.target.value });
        };

        this.children = this.selectionOptions.map((row: any) => {
            return new SelectionOption(row.key, row.val);
        });
        this.tag = "select";
    }

    override preRender(): boolean | null {
        this.attribs.value = this.getState<LS>().value;
        return true;
    }
}
