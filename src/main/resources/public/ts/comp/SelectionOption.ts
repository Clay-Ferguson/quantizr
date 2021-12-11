import { ReactNode } from "react";
import { Comp } from "./base/Comp";

export class SelectionOption extends Comp {
    constructor(public key: string, public val : string) {
        super(null);
        this.attribs.value = this.key;

        // React prints this warning if you use 'selected' on an option
        // Use the `defaultValue` or `value` props on <select> instead of setting `selected` on <option> in option
        // if (selected) {
        //     this.attribs.selected = "selected";
        // }
    }

    compRender(): ReactNode {
        return this.e("option", this.attribs, this.val);
    }
}
