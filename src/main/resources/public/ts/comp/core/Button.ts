import { ReactNode } from "react";
import { getAppState } from "../../AppRedux";
import { Comp } from "../base/Comp";
import { Tag } from "./Tag";

interface LS { // Local State
    text?: string;
    enabled?: boolean;
}

export class Button extends Comp {

    constructor(text: string, callback: Function, attribs: Object = null, moreClasses: string = "btn-secondary") {
        super(attribs);
        this.attribs.type = "button";
        this.attribs.onClick = callback;
        this.attribs.className = this.attribs.className || "";
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
        let text: string = this.getState<LS>().text;

        if (this.getState<LS>().enabled) {
            delete this.attribs.disabled;
        }
        else {
            this.attribs.disabled = "disabled";
        }

        return this.tag("button", null, [
            // We use Tag here instead of Icon, because Icon renders larger in size for mobile mode and that
            // would conflict wiht this button already sizing larger for mobile itself
            this.attribs.iconclass ? new Tag("i", {
                className: this.attribs.iconclass,
                style: {
                    marginRight: text ? "6px" : "0px"
                }
            }) : null, text]);
    }
}
