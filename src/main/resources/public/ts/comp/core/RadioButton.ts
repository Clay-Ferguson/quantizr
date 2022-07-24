import { ReactNode } from "react";
import { CompValueHolder } from "../../CompValueHolder";
import { ValueIntf } from "../../Interfaces";
import { State } from "../../State";
import { Comp } from "../base/Comp";
import { CheckboxInput } from "./CheckboxInput";
import { Label } from "./Label";

export class RadioButton extends Comp {

    constructor(public label: string, public checked: boolean, groupName: string, attribs: any, private valueIntf: ValueIntf) {
        super(attribs, new State());

        if (!valueIntf) {
            this.valueIntf = new CompValueHolder<string>(this, "val");
        }

        this.attribs.name = groupName;
        this.attribs.type = "radio";
        this.attribs.label = label;
        this.attribs.value = this.getId("val-");
        this.attribs.className = "form-check-input";
    }

    compRender = (): ReactNode => {
        let attribsClone = { ...this.attribs };
        delete attribsClone.ref;

        return this.tag("span", {
            key: this.getId("s_"),
            className: "form-check",
            ref: this.attribs.ref
        }, [
            new CheckboxInput(attribsClone, null, this.valueIntf),
            new Label(this.label || "", {
                key: this.getId("l_"),
                htmlFor: this.getId(),
                className: "form-check-label radioLabel"
            })
        ]);
    }
}
