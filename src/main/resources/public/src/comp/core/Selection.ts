import { ValueIntf } from "../../Interfaces";
import { State } from "../../State";
import { Comp } from "../base/Comp";
import { Label } from "./Label";
import { Select } from "./Select";

export class Selection extends Comp {

    constructor(attribs: any, private label: string = null, public selectionOptions: any[] = null, public moreClasses: string, private outterClasses: string, private valueIntf: ValueIntf) {
        super(attribs, (valueIntf?.getState ? valueIntf?.getState() : null) || new State<any>(null));
        // w-25 = width 25%
        // https://hackerthemes.com/bootstrap-cheatsheet/#m-1
    }

    override preRender(): boolean | null {
        const children = [];

        const select = new Select({
            value: this.valueIntf.getValue(),
            className: "form-select formSelect " + (this.moreClasses || "")
        }, this.selectionOptions, this.valueIntf);

        if (this.label) {
            children.push(new Label(this.label, {
                htmlFor: select.getId(),
                className: "selectLabel"
            }));
        }

        children.push(select);
        this.children = children;
        this.attribs.className = this.outterClasses || "";
        return true;
    }
}
