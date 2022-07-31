import { ReactNode } from "react";
import { CompValueHolder } from "../../CompValueHolder";
import { ValueIntf } from "../../Interfaces";
import { State } from "../../State";
import { Comp } from "../base/Comp";
import { CheckboxInput } from "./CheckboxInput";
import { Label } from "./Label";

export class Checkbox extends Comp {
    outterClassName: string;

    /* To turn this into a slider switch, just add 'form-switch' to layoutClass style */
    constructor(public label: string = null, attribs: Object = null, private valueIntf: ValueIntf, private layoutClass: string = null) {
        super(attribs, new State());

        if (!valueIntf) {
            this.valueIntf = new CompValueHolder<string>(this, "val");
        }

        this.outterClassName = this.attribs.className || "";
        this.layoutClass = this.layoutClass || "form-check-inline";
    }

    compRender = (): ReactNode => {
        let cbInput: CheckboxInput = null;
        return this.tag("span", {
            // there is also a 'custom-control-inline' that could be used instead of 'inline-checkbox' but it adds space to the right
            // NOTE: custom-switch or custom-checkbox will work here with all other things being identical! The custom-switch shows
            // a little slider switch button instead of a box with a check.
            className: "form-check " + this.layoutClass + " " + this.outterClassName + " clickable"
        }, [
            cbInput = new CheckboxInput({
                type: "checkbox",
                className: "form-check-input clickable"
            }, null, this.valueIntf),
            // warning without this label element the entire control fails to render, and this is apparently related to bootstrap itself.
            new Label(this.label || "", {
                // key: this.getId("l_"),
                className: "form-check-label clickable " + (this.label ? "checkboxLabel" : ""),
                htmlFor: cbInput.getId(),
                title: this.attribs.title
            })
        ]);
    }
}
