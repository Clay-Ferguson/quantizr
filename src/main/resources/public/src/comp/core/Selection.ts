import { ValueIntf } from "../../Interfaces";
import { State } from "../../State";
import { Comp } from "../base/Comp";
import { Label } from "./Label";
import { Select } from "./Select";

export class Selection extends Comp {

    constructor(attribs: any, private label: string = null, public selectionOptions: any[] = null, public moreClasses: string, private outterClasses: string, private valueIntf: ValueIntf) {
        super(attribs, (valueIntf?.getState ? valueIntf?.getState() : null) || new State<any>(null));
    }

    override preRender(): boolean | null {
        const children = [];

        const formSelect = "tw-bg-gray-100 tw-block tw-w-full tw-px-3 tw-py-2 tw-text-base tw-border tw-rounded-md focus:tw-outline-none focus:tw-ring-1 focus:tw-ring-blue-500 focus:tw-border-blue-500";
        const select = new Select({
            value: this.valueIntf.getValue(),
            className: formSelect + " formSelect " + (this.moreClasses || "")
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
