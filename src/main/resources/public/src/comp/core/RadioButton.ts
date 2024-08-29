import { ValueIntf } from "../../Interfaces";
import { Value } from "../../Value";
import { Comp } from "../base/Comp";
import { CheckboxInput } from "./CheckboxInput";
import { Label } from "./Label";

export class RadioButton extends Comp {

    constructor(public label: string, public checked: boolean, public groupName: string, attribs: any, private valueIntf: ValueIntf,
        private layoutClass: string = null) {
        super(attribs);
        valueIntf = this.valueIntf || new Value<string>(this, "val");
        this.tag = "span";
    }

    override preRender(): boolean | null {
        let cbInput = null;
        this.attribs.className = "form-check " + (this.layoutClass || "");
        this.children = [
            cbInput = new CheckboxInput({
                name: this.groupName,
                type: "radio",
                label: this.label,
                value: "val-" + this.getId(),
                className: "form-check-input clickable"
            }, null, this.valueIntf),
            new Label(this.label || "", {
                htmlFor: cbInput.getId(),
                className: "form-check-label radioLabel"
            })
        ];
        return true;
    }
}
