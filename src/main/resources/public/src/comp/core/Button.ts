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

        moreClasses += " px-4 py-2 border border-gray-400 border-solid cursor-pointer";
        if (moreClasses.indexOf("-primary") != -1) {
            moreClasses = moreClasses.replace("-primary", "");
            moreClasses += " bg-sky-800 hover:bg-sky-900 text-white";
        }
        else if (moreClasses.indexOf("-danger") != -1) {
            moreClasses = moreClasses.replace("-danger", "");
            moreClasses += " bg-red-500 hover:bg-red-600 text-white";
        }
        else {
            moreClasses += " bg-gray-700 hover:bg-gray-800 text-white";
        }

        this.attribs.type = "button";
        this.attribs.onClick = callback;
        this.attribs.className = (this.attribs.className || "") + moreClasses;
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
            this.iconClass ? new Tag("i", {
                className: "fa " + this.iconClass + (text ? " buttonIconWithText" : " buttonIconNoText")
            }) : null, text];

        return true;
    }
}
