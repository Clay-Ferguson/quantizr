import { getAs } from "../../AppContext";
import { Comp } from "../base/Comp";
import { Tag } from "./Tag";

interface LS { // Local State
    text?: string;
    enabled?: boolean;
}

export class Button extends Comp {
    constructor(text: string, callback: (evt?: Event, id?: string) => void, attribs: any = null, moreClasses: string = "",
        private iconClass: string = null) {
        super(attribs);

        moreClasses = moreClasses || "";
        moreClasses = moreClasses.replace("btn ", "");

        moreClasses += " tw-px-4 tw-py-2 tw-border tw-border-gray-400 tw-border-solid";
        if (moreClasses.indexOf("-primary") != -1) {
            moreClasses = moreClasses.replace("-primary", "");
            moreClasses += " tw-bg-blue-600 hover:tw-bg-blue-700 tw-text-white";
        }
        else if (moreClasses.indexOf("-danger") != -1) {
            moreClasses = moreClasses.replace("-danger", "");
            moreClasses += " tw-bg-red-500 hover:tw-bg-red-600 tw-text-white";
        }
        else {
            moreClasses += " tw-bg-gray-600 hover:tw-bg-gray-700 tw-text-white";
        }

        this.attribs.type = "button";
        this.attribs.onClick = callback;
        this.attribs.className = (this.attribs.className || "") + " clickable " + //
            moreClasses + (getAs().mobileMode ? " mobileButton" : "");
        this.mergeState<LS>({ text, enabled: true });
        this.tag = "button";
    }

    setEnabled(enabled: boolean) {
        this.mergeState<LS>({ enabled });
    }

    setText(text: string): void {
        this.mergeState<LS>({ text });
    }

    override preRender(): boolean | null {
        const text: string = this.getState<LS>().text;

        if (this.getState<LS>().enabled) {
            delete this.attribs.disabled;
        }
        else {
            this.attribs.disabled = "disabled";
        }

        this.children = [
            // We use Tag("i") here instead of Icon(), because Icon renders larger in size for mobile mode and that
            // would conflict with this button already itself sizing larger for mobile
            this.iconClass ? new Tag("i", {
                className: "fa " + this.iconClass + (text ? " buttonIconWithText" : " buttonIconNoText")
            }) : null, text];

        return true;
    }
}
