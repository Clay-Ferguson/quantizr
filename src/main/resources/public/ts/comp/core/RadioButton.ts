import { ReactNode } from "react";
import { CompValueHolder } from "../../CompValueHolder";
import { ValueIntf } from "../../Interfaces";
import { State } from "../../State";
import { Comp } from "../base/Comp";
import { CheckboxInput } from "./CheckboxInput";
import { Label } from "./Label";

export class RadioButton extends Comp {

    constructor(public label: string, public checked: boolean, public groupName: string, attribs: any, private valueIntf: ValueIntf) {
        super(attribs, new State());
        valueIntf = this.valueIntf || new CompValueHolder<string>(this, "val");
    }

    compRender = (): ReactNode => {
        let cbInput: CheckboxInput = null;
        return this.tag("span", {
            className: "form-check"
        }, [
            cbInput = new CheckboxInput({
                name: this.groupName,
                type: "radio",
                label: this.label,
                value: this.getId("val-"),
                className: "form-check-input clickable"
            }, null, this.valueIntf),
            new Label(this.label || "", {
                htmlFor: cbInput.getId(),
                className: "form-check-label radioLabel"
            })
        ]);
    }
}
