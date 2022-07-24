import { ReactNode } from "react";
import { ValueIntf } from "../../Interfaces";
import { State } from "../../State";
import { Comp } from "../base/Comp";
import { Label } from "./Label";
import { Select } from "./Select";

export class Selection extends Comp {

    constructor(attribs: any, private label: string = null, public selectionOptions: Object[] = null, moreClasses: string, private outterClasses: string, private valueIntf: ValueIntf) {
        super(attribs, new State());
        // w-25 = width 25%
        // https://hackerthemes.com/bootstrap-cheatsheet/#m-1
        this.attribs.className = "form-select " + moreClasses;
    }

    compRender = (): ReactNode => {
        this.attribs.value = this.valueIntf.getValue();
        let children = [];

        let attribsClone = { ...this.attribs };
        delete attribsClone.ref;

        if (this.label) {
            children.push(new Label(this.label, {
                id: this.getId() + "_label",
                key: this.getId() + "_label",
                htmlFor: this.getId(),
                className: "selectLabel"
            }));
        }

        children.push(new Select(attribsClone, this.selectionOptions, this.valueIntf));
        this.setChildren(children);

        return this.tag("div", {
            id: this.getId() + "_sel",
            key: this.getId() + "_sel",
            className: this.outterClasses || "",
            ref: this.attribs.ref
        });
    }
}
