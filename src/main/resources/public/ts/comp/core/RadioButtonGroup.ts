import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { RadioButton } from "./RadioButton";

export class RadioButtonGroup extends Comp {

    constructor(initialButtons: RadioButton[] = null, moreClasses: string = "") {
        super(null);
        this.attribs.className = moreClasses;
        this.setChildren(initialButtons);

        initialButtons.forEach(function(row: RadioButton) {
            if (row?.attribs?.checked === "checked") {
                this.attribs.selected = (<any>row.attribs).name;
            }
        }, this);
    }

    compRender = (): ReactNode => {
        return this.tag("div");
    }
}
