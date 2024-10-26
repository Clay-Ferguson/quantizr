import { Comp } from "../base/Comp";
import { Icon } from "./Icon";
import { Ul } from "./Ul";

// NOTE: I converted this to tailwind before noticing it's not even being used, so these tailwind classes are untested.
export class DropdownMenu extends Comp {
    constructor(private items: Comp[], moreClasses: string = "") {
        super(null);
        this.attribs.className = "tw-relative tw-inline-block tw-text-left " + moreClasses;
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
                className: "tw-absolute tw-right-0 tw-z-10 tw-mt-2 tw-w-56 tw-origin-top-right tw-rounded-md tw-bg-white tw-shadow-lg tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none",
                "aria-labelledby": id,
            }, this.items)
        ];
        return true;
    }
}
