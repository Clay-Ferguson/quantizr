import { Comp } from "../base/Comp";

export class RadioButtonGroup extends Comp {
    constructor(initialButtons: Comp[] = null, moreClasses: string = "") {
        super(null);
        this.attribs.className = moreClasses;
        this.setChildren(initialButtons);

        initialButtons.forEach(row => {
            if (row?.attribs?.checked === "checked") {
                this.attribs.selected = (<any>row.attribs).name;
            }
        });
    }
}
