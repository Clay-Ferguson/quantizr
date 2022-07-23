import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { Icon } from "./Icon";
import { PlainString } from "./PlainString";

interface LS { // Local State
    text?: string;
    enabled?: boolean;
}

export class Button extends Comp {

    constructor(text: string, public callback: Function, attribs: Object = null, moreClasses: string = "btn-secondary") {
        super(attribs);
        if (!this.attribs.className) {
            this.attribs.className = "";
        }

        // somehow this 'clickable' class seems to have no effect
        this.attribs.className += " btn clickable " + moreClasses;
        this.attribs.type = "button";
        this.attribs.onClick = callback;
        this.setText(text);
        this.setEnabled(true);
    }

    setEnabled = (enabled: boolean): void => {
        this.mergeState({ enabled });
    }

    setText(text: string): void {
        this.mergeState<LS>({ text });
    }

    compRender = (): ReactNode => {
        let text: string = this.getState<LS>().text;
        let icon: Icon;
        if (this.attribs.iconclass) {
            icon = new Icon({
                key: "s_" + this.getId(),
                className: this.attribs.iconclass,
                style: {
                    marginRight: text ? "6px" : "0px"
                }
            });
        }

        if (this.getState<LS>().enabled) {
            delete this.attribs.disabled;
        }
        else {
            this.attribs.disabled = "disabled";
        }

        // todo-0: Should we go with the pattern where we ALWAYS call only 'this.tag()' in cases like this
        //         This will require that all children are specified as Comp-derived components too.
        //         NOTE: Ultimately we'll also end up with only one creatElement in the code and it's in Comp.
        return this.tag("button", null, this.attribs, [icon, new PlainString(text)]);
    }
}
