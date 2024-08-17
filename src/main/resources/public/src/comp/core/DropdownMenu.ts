import { Comp } from "../base/Comp";
import { Icon } from "./Icon";
import { Ul } from "./Ul";

export class DropdownMenu extends Comp {
    constructor(private items: Comp[], moreClasses: string = "") {
        super(null);
        this.attribs.className = "dropdown " + moreClasses;
        this.tag = "span";
    }

    override preRender = (): boolean => {
        const id = "ddMenu-" + this.getId();
        this.children = [
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
        ];
        return true;
    }
}
