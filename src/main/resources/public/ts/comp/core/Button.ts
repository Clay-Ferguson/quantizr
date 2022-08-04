import { ReactNode } from "react";
import { getAppState } from "../../AppRedux";
import { Comp } from "../base/Comp";
import { Tag } from "./Tag";

interface LS { // Local State
    text?: string;
    enabled?: boolean;
}

// #dynamic-styling-example (do not delete, yet)
// const scope = "Button";

export class Button extends Comp {
    constructor(text: string, callback: Function, attribs: Object = null, moreClasses: string = "btn-secondary",
        private iconClass: string = null) {
        super(attribs);
        moreClasses = moreClasses || "btn-secondary";
        this.attribs.type = "button";
        this.attribs.onClick = callback;
        this.attribs.className = this.attribs.className || "";

        // #dynamic-styling-example (do not delete, yet)
        // this.attribs.className += ` btn testClass_${scope} clickable ` + moreClasses;

        this.attribs.className += " btn clickable " + moreClasses;
        this.attribs.className += getAppState().mobileMode ? " mobileButton" : "";
        this.mergeState<LS>({ text, enabled: true });
    }

    setEnabled = (enabled: boolean) => {
        this.mergeState<LS>({ enabled });
    }

    setText(text: string): void {
        this.mergeState<LS>({ text });
    }

    compRender = (): ReactNode => {
        const text: string = this.getState<LS>().text;

        if (this.getState<LS>().enabled) {
            delete this.attribs.disabled;
        }
        else {
            this.attribs.disabled = "disabled";
        }

        return this.tag("button", null, [
            // We use Tag here instead of Icon, because Icon renders larger in size for mobile mode and that
            // would conflict with this button already itself sizing larger for mobile
            this.iconClass ? new Tag("i", {
                className: "fa " + this.iconClass,
                style: {
                    marginRight: text ? "6px" : "0px"
                }
            }) : null, text]);
    }
}

// #dynamic-styling-example (do not delete, yet)
// CssUtil.create(`
// .testClass_${scope} {
//     border: 2px solid red;
// }`);
