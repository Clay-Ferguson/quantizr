import { ReactNode } from "react";
import { getAppState } from "../../AppRedux";
import { Comp } from "../base/Comp";
import { Tag } from "./Tag";

interface LS { // Local State
    text?: string;
    enabled?: boolean;
}

export class Button extends Comp {

    // *********************** DO NOT DELETE
    // #dynamic-styling-example
    // To enable this Classes custom CSS, just uncomment this code, and that's all that's required
    // to get the proof-of-concept back working. For now we use only SCSS, but this example was 
    // an experiment, and works great.
    static cssPrefix = null;
    // static cssPrefix = Comp.getCssPrefix();
    // static cssObj = Comp.createCss(Button.cssPrefix, `
    // .$$testClass {
    //     border: 2px solid red;
    // }`);
    // *********************** DO NOT DELETE

    constructor(text: string, callback: Function, attribs: Object = null, moreClasses: string = "btn-secondary",
        private iconClass: string = null) {
        super(attribs, null, Button.cssPrefix);
        moreClasses = moreClasses || "btn-secondary";
        this.attribs.type = "button";
        this.attribs.onClick = callback;
        this.attribs.className = this.attribs.className || "";

        // #dynamic-styling-example (do not delete)
        // this.attribs.className += " btn $$testClass clickable " + moreClasses;
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
                className: "fa " + this.iconClass + (text ? " buttonIconWithText" : " buttonIconNoText")
            }) : null, text]);
    }
}
