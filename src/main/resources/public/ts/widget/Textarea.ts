import * as I from "../Interfaces";
import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Textarea extends Comp implements I.TextEditorIntf {

    /* If parent needs to update state based on content entered by user the updateValFunc can be passed in
    to capture all changes user entered. */
    constructor(private label: string, attribs: any = null, private updateValFunc: (value: string) => void = null) {
        super(attribs);
        S.util.mergeProps(this.attribs, {
            className: "form-control pre-textarea"
        });

        if (!this.attribs.rows) {
            this.attribs.rows = "1";
        }

        this.setWordWrap(true);
    }

    insertTextAtCursor = (text: string) => {
        //should we implement this ? todo-1
    }

    setMode(mode: string): void {
    }

    getValue = (): string => {
        let elm = this.getElement();
        if (elm) {
            return (<any>elm).value.trim();
        }
        /* we just resort to returning the value the object was originally created to have if the gui elmement doesn't exist yet on the DOM
        when we got into here */
        else {
            return this.getState().value;
        }
    }

    setValue = (value: string): void => {
        this.mergeState({ value });
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

        if (state.value) {
            _attribs.value = state.value;
        }

        // todo-1: need this on ACE editor and also TextField (same with updateValFunc)
        _attribs.onChange = (evt: any) => {
            //console.log("e.target.value=" + evt.target.value);
            this.mergeState({ value: evt.target.value });
        }

        if (this.updateValFunc) {
            /* Warning: Do not try to use onChange here. That's overkill AND won't work well */
            _attribs.onBlur = (evt: any) => {
                /* save value off 'evt' here, because if we don't JavaScript is smart enough to bark if we use the even later in the timer
                when it knows the target dom element is dead/gone, because of a re-render */
                let value = evt.target.value;

                /* React is tricky when you do something in an event that an cause a state change (plus a re-render), because 
                when that re-render happens it will blow up the eventing that was underway (like an onBlur+onClick when clicking a button while an 
                edit field has focus), so we delay the processing of the blur to always give any pending onClicks to run first. It's not a clean solution
                but works.
                To clarify: if you remove this timer then some 'onClick' events will get ignored. Buttons not working.
                */
                setTimeout(() => {
                    this.updateValFunc(value);
                }, 500);
            }
        }

        _attribs.style = { fontFamily: "monospace" };

        children.push(S.e('textarea', _attribs));
        return S.e("div", {
            id: this.getId() + "_textfield",
            key: this.getId() + "_textfield",
            //NOTE: Yes we set font on the PARENT and then use 'inherit' to get it
            //to the component, or elase there's a react-rerender flicker.
            style: { fontFamily: "monospace" }
        }, children);
    }
}
