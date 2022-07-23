import { createElement, ReactNode } from "react";
import { Comp } from "../base/Comp";
import { RadioButton } from "./RadioButton";

export class RadioButtonGroup extends Comp {

    constructor(initialButtons: RadioButton[] = null, moreClasses: string = "") {
        super(null);
        this.attribs.className = moreClasses;
        this.setChildren(initialButtons);

        initialButtons.forEach(function(row: RadioButton) {
            if (row && row.attribs && row.attribs.checked === "checked") {
                this.attribs.selected = (<any>row.attribs).name;
            }
        }, this);
    }

    compRender = (): ReactNode => {
        return createElement("div", this.attribs, this.buildChildren());
    }
}
