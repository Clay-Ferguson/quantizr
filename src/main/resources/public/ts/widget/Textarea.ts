import * as I from "../Interfaces";
import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ReactNode } from "react";
import { ValueIntf } from "../Interfaces";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Textarea extends Comp implements I.TextEditorIntf {

    constructor(private label: string, attribs: any, private valueIntf: ValueIntf, customClass: string=null) {
        super(attribs);
        S.util.mergeProps(this.attribs, {
            className: customClass || "form-control pre-textarea"
        });

        if (!this.attribs.rows) {
            this.attribs.rows = "1";
        }

        this.setWordWrap(true);

        // todo-1: need this on ACE editor and also TextField (same with updateValFunc)
        this.attribs.onChange = (evt: any) => {
            Comp.renderCachedChildren = true;

            try {
                //console.log("e.target.value=" + evt.target.value);
                this.updateValFunc(evt.target.value);
            }
            finally {
                /* React doesn't have a 'global' way to know when all rendering that's about to be done HAS been done, so all we can do here, is
                use a timeout */
                setTimeout(() => {
                    Comp.renderCachedChildren = false;
                }, 250);
            }
        }
    }

    //Handler to update state if edit field looses focus
    updateValFunc(value: string): void {
        if (value != this.valueIntf.getValue()) {
            this.valueIntf.setValue(value);
        }
    }

    insertTextAtCursor = (text: string) => {
        //should we implement this ? todo-1
    }

    setMode(mode: string): void {
    }

    setValue(val: string): void {
        this.valueIntf.setValue(val);
    }

    getValue(): string {
        return this.valueIntf.getValue();
    }

    setWordWrap(wordWrap: boolean): void {
        this.mergeState({ wordWrap });
    }

    compRender(): ReactNode {
        let state = this.getState();
        let children = [];

        if (this.label) {
            children.push(S.e("label", {
                id: this.getId() + "_label",
                key: this.getId() + "_label",
                htmlFor: this.getId()
            }, this.label));
        }

        let _attribs = { ...this.attribs };
        if (!state.wordWrap) {
            _attribs.style = {
                whiteSpace: "nowrap",
                overflow: "auto",
            }
        }

        _attribs.value = this.valueIntf.getValue();
        _attribs.style = { fontFamily: "monospace" };

        children.push(S.e('textarea', _attribs));

        //changing from div to span is very new 6/30/2020. not fully vetted.
        return S.e("span" /* "div" */, {
            id: this.getId() + "_textfield",
            key: this.getId() + "_textfield",
            //NOTE: Yes we set font on the PARENT and then use 'inherit' to get it
            //to the component, or elase there's a react-rerender flicker.
            style: { fontFamily: "monospace" }
        }, children);
    }
}
