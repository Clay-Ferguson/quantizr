import { ValueIntf } from "../../Interfaces";
import { Value } from "../../Value";
import { Comp } from "../base/Comp";
import { CheckboxInput } from "./CheckboxInput";
import { Label } from "./Label";

export class Checkbox extends Comp {
    outterClassName: string;

    /* To turn this into a slider switch, just add 'form-switch' to layoutClass style */
    constructor(public label: string = null, attribs: any = null, private valueIntf: ValueIntf, private layoutClass: string = null) {
        super(attribs);

        this.valueIntf = this.valueIntf || new Value<string>(this, "val");
        this.outterClassName = this.attribs.className || "";
        this.layoutClass = this.layoutClass || "form-check-inline";
        this.tag = "span";
    }

    override preRender(): boolean | null {
        let cbInput = null;
        // there is also a 'custom-control-inline' that could be used instead of 'inline-checkbox'
        // but it adds space to the right NOTE: custom-switch or custom-checkbox will work here with
        // all other things being identical! The custom-switch shows a little slider switch button
        // instead of a box with a check.
        this.attribs.className = "form-check " + this.layoutClass + " " + this.outterClassName + " clickable";
        this.children = [
            cbInput = new CheckboxInput({
                type: "checkbox",
                className: "form-check-input clickable"
            }, null, this.valueIntf),
            new Label(this.label || "", {
                className: "form-check-label clickable " + (this.label ? "checkboxLabel" : ""),
                htmlFor: cbInput.getId(),
                title: this.attribs.title
            })
        ];
        return true;
    }
}
