import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";
import { Ul } from "./Ul";
import { Icon } from "./Icon";

export class DropdownMenu extends Comp {
    constructor(private items: CompIntf[]) {
        super(null);
        this.attribs.className = "dropdown"
    }

    override compRender = (): ReactNode => {
        const id = "ddMenu-" + this.getId();
        return this.tag("span", null, [
            new Icon({
                className: "fa fa-ellipsis-h fa-lg clickable",
                id,
                "data-bs-toggle": "dropdown",
                "aria-expanded": "false"
            }),
            new Ul(null, {
                className: "dropdown-menu",
                "aria-labelledby": id,
            }, this.items)
        ]);
    }
}
