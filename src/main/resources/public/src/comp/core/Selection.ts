import { ValueIntf } from "../../Interfaces";
import { State } from "../../State";
import { Tailwind } from "../../Tailwind";
import { Comp } from "../base/Comp";
import { Label } from "./Label";
import { Select } from "./Select";
export class Selection extends Comp {

    constructor(attribs: any, private label: string = null, public selectionOptions: any[] = null, private outterClasses: string, private valueIntf: ValueIntf) {
        super(attribs, (valueIntf?.getState ? valueIntf?.getState() : null) || new State<any>(null));
    }

    override preRender(): boolean | null {
        const children = [];

        const select = new Select({
            value: this.valueIntf.getValue(),
            className: Tailwind.formControlFit
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
