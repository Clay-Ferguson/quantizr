import { ValueIntf } from "../../Interfaces";
import { Value } from "../../Value";
import { Comp } from "../base/Comp";
import { CheckboxInput } from "./CheckboxInput";
import { Label } from "./Label";

export class RadioButton extends Comp {

    constructor(public label: string, public checked: boolean, public groupName: string, attribs: any, private valueIntf: ValueIntf,
        private layoutClass: string = null) {
        super(attribs);
        this.attribs.className += " tw-relative tw-flex tw-items-start " + (this.layoutClass || "");
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
                className: "tw-w-6 tw-h-6 tw-rounded tw-border-gray-300 tw-text-blue-600 focus:tw-ring-blue-500 cursor-pointer"
            }, null, this.valueIntf),
            new Label(this.label || "", {
                htmlFor: cbInput.getId(),
                className: "tw-ml-2 tw-text-sm tw-text-white radioLabel"
            })
        ];
        return true;
    }
}
