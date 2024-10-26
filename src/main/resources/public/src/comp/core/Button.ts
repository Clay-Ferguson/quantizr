import { getAs } from "../../AppContext";
import { Comp } from "../base/Comp";
import { Progress } from "./Progress";
import { Tag } from "./Tag";

interface LS { // Local State
    text?: string;
    enabled?: boolean;
    waiting?: boolean;
}

export class Button extends Comp {
    constructor(text: string, callback: (evt?: Event, id?: string) => void, attribs: object | null = null, moreClasses: string = "",
        private iconClass: string = null) {
        super(attribs);

        moreClasses = moreClasses || "";

        moreClasses += " tw-px-4 tw-py-2 tw-border tw-border-gray-400 tw-border-solid cursor-pointer";
        if (moreClasses.indexOf("-primary") != -1) {
            moreClasses = moreClasses.replace("-primary", "");
            moreClasses += " tw-bg-sky-800 hover:tw-bg-sky-900 tw-text-white";
        }
        else if (moreClasses.indexOf("-danger") != -1) {
            moreClasses = moreClasses.replace("-danger", "");
            moreClasses += " tw-bg-red-500 hover:tw-bg-red-600 tw-text-white";
        }
        else {
            moreClasses += " tw-bg-gray-700 hover:tw-bg-gray-800 tw-text-white";
        }

        this.attribs.type = "button";
        this.attribs.onClick = callback;
        this.attribs.className = (this.attribs.className || "") +
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

    replaceWithWaitIcon(): void {
        this.mergeState({ waiting: true });
    }

    override preRender(): boolean | null {
        const state = this.getState<LS>();

        // this gets activated when the user clicks an infinite scrolling button, so it turns into a spinner
        // while loading more records
        if (state.waiting) {
            this.attribs.className = "";
            this.children = [new Progress()];
            return true;
        }
        const text: string = state.text;

        if (state.enabled) {
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
