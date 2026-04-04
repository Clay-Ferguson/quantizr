import { Comp } from "../base/Comp";
import { Icon } from "./Icon";
import { Ul } from "./Ul";

// NOTE: I converted this to tailwind before noticing it's not even being used, so these tailwind classes are untested.
export class DropdownMenu extends Comp {
    constructor(private items: Comp[], moreClasses: string = "") {
        super(null);
        this.attribs.className = "relative inline-block text-left " + moreClasses;
        this.tag = "span";
    }

    override preRender(): boolean | null {
        const id = "ddMenu-" + this.getId();
        this.children = [
            new Icon({
                className: "fa fa-ellipsis-h fa-lg cursor-pointer",
                id,
                "data-bs-toggle": "dropdown",
                "aria-expanded": "false"
            }),
            new Ul(null, {
                className: "absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none",
                "aria-labelledby": id,
            }, this.items)
        ];
        return true;
    }
}
