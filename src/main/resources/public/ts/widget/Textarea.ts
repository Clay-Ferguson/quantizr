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

    constructor(private label: string, attribs: any = null, private valueIntf: ValueIntf = null) {
        super(attribs);
        S.util.mergeProps(this.attribs, {
            className: "form-control pre-textarea"
        });

        if (!this.attribs.rows) {
            this.attribs.rows = "1";
        }

        this.setWordWrap(true);

        /* If we weren't passed a delegated value interface, then construct one */
        if (!this.valueIntf) {
            this.valueIntf = {
                setValue: (val: string): void => {
                    this.mergeState({ value: val || "" }, true);
                },

                getValue: (): string => {
                    return this.getState().value;
                }
            }
        }

        // todo-1: need this on ACE editor and also TextField (same with updateValFunc)
        this.attribs.onChange = (evt: any) => {
            //console.log("e.target.value=" + evt.target.value);
            this.updateValFunc(evt.target.value);
        }

        this.attribs.defaultValue = this.valueIntf.getValue();
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

        if (state.value) {
            _attribs.value = this.valueIntf.getValue(); 
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
