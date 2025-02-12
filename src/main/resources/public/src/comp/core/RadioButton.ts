import { ValueIntf } from "../../Interfaces";
import { Value } from "../../Value";
import { Comp } from "../base/Comp";
import { CheckboxInput } from "./CheckboxInput";
import { Label } from "./Label";

export class RadioButton extends Comp {

    constructor(public label: string, public checked: boolean, public groupName: string, attribs: any, private valueIntf: ValueIntf,
        private layoutClass: string = null) {
        super(attribs);
        this.attribs.className += " relative flex items-start " + (this.layoutClass || "");
        valueIntf = this.valueIntf || new Value<string>(this, "val");
        this.tag = "span";
    }

    override preRender(): boolean | null {
        let cbInput = null;
        this.children = [
            cbInput = new CheckboxInput({
                name: this.groupName,
                type: "radio",
                label: this.label,
                value: "val-" + this.getId(),
                className: "w-6 h-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            }, null, this.valueIntf),
            new Label(this.label || "", {
                htmlFor: cbInput.getId(),
                className: "ml-2 text-sm text-white radioLabel"
            })
        ];
        return true;
    }
}
